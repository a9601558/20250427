import express from 'express';
import { stripePaymentIntent, verifyPaymentIntent, constructEvent } from '../services/stripe';
import { authenticateJwt } from '../middlewares/auth';
import db from '../models';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

const router = express.Router();

// 创建支付Intent
router.post('/create-intent', authenticateJwt, async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;
    
    if (!amount || !currency) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的支付金额和货币'
      });
    }
    
    // 确保用户ID与认证用户匹配
    if (metadata && metadata.userId && metadata.userId !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: '用户ID不匹配'
      });
    }
    
    // 添加用户ID到元数据
    const enhancedMetadata = {
      ...metadata,
      userId: req.user?.id
    };
    
    // 创建支付Intent
    const paymentIntent = await stripePaymentIntent({
      amount,
      currency,
      metadata: enhancedMetadata
    });
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('创建支付Intent失败:', error);
    res.status(500).json({
      success: false,
      message: '创建支付处理失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 验证支付状态
router.get('/verify/:paymentIntentId', authenticateJwt, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    
    // 验证支付Intent
    const verification = await verifyPaymentIntent(paymentIntentId);
    
    // 检查用户ID是否匹配
    if (verification.metadata?.userId && verification.metadata.userId !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: '无权访问此支付记录'
      });
    }
    
    // 如果支付成功且尚未记录，创建购买记录
    if (verification.isSuccessful && verification.metadata?.questionSetId) {
      // 检查是否已经存在此支付的购买记录
      const existingPurchase = await db.Purchase.findOne({
        where: {
          transactionId: paymentIntentId,
          userId: req.user?.id
        }
      });
      
      if (existingPurchase) {
        // 如果记录已存在但状态不是active，更新为active
        if (existingPurchase.status !== 'active') {
          console.log(`[Verify] 更新购买记录状态: ${existingPurchase.id}`);
          await existingPurchase.update({
            status: 'active',
            updatedAt: new Date()
          });
          
          // 发送购买成功事件
          if (req.app.get('io')) {
            const io = req.app.get('io');
            
            io.emit('purchase:success', {
              userId: req.user?.id,
              questionSetId: verification.metadata.questionSetId,
              purchaseId: existingPurchase.id,
              expiryDate: existingPurchase.expiryDate.toISOString()
            });
            
            // 更新访问权限
            io.emit('questionSet:accessUpdate', {
              userId: req.user?.id,
              questionSetId: verification.metadata.questionSetId,
              hasAccess: true
            });
          }
        }
      } else {
        // 计算过期时间（6个月后）
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() + 6);
        
        // 创建购买记录
        await db.Purchase.create({
          id: uuidv4(),
          userId: req.user?.id,
          questionSetId: verification.metadata.questionSetId,
          purchaseDate: now,
          expiryDate,
          amount: verification.amount / 100, // 转换回元
          transactionId: paymentIntentId,
          paymentMethod: 'card',
          status: 'active'
        });
        
        // 发送购买成功事件
        if (req.app.get('io')) {
          const io = req.app.get('io');
          
          io.emit('purchase:success', {
            userId: req.user?.id,
            questionSetId: verification.metadata.questionSetId,
            purchaseId: uuidv4(),
            expiryDate: expiryDate.toISOString()
          });
          
          // 更新访问权限
          io.emit('questionSet:accessUpdate', {
            userId: req.user?.id,
            questionSetId: verification.metadata.questionSetId,
            hasAccess: true
          });
        }
      }
    }
    
    res.json({
      success: true,
      status: verification.status,
      isSuccessful: verification.isSuccessful,
      questionSetId: verification.metadata?.questionSetId
    });
  } catch (error) {
    console.error('验证支付状态失败:', error);
    res.status(500).json({
      success: false,
      message: '验证支付失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// Stripe Webhook接收端点
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    return res.status(400).send('缺少Stripe签名');
  }
  
  try {
    // Convert request body to string for constructEvent
    const payload = req.body.toString();
    const event = constructEvent(payload, signature);
    
    // 处理不同类型的事件
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // 处理成功的支付
        console.log('支付成功:', paymentIntent.id);
        
        // 如果有元数据，创建购买记录
        if (paymentIntent.metadata?.userId && paymentIntent.metadata?.questionSetId) {
          const userId = paymentIntent.metadata.userId;
          const questionSetId = paymentIntent.metadata.questionSetId;
          
          // 检查是否已经存在此支付的购买记录
          const existingPurchase = await db.Purchase.findOne({
            where: {
              transactionId: paymentIntent.id,
              userId
            }
          });
          
          if (existingPurchase) {
            // 如果记录已存在但不是active状态，更新为active
            if (existingPurchase.status !== 'active') {
              console.log(`[Webhook] 更新购买记录状态: ${existingPurchase.id}`);
              await existingPurchase.update({
                status: 'active',
                updatedAt: new Date()
              });
              
              // 发送购买成功事件
              if (req.app.get('io')) {
                const io = req.app.get('io');
                
                io.emit('purchase:success', {
                  userId,
                  questionSetId,
                  purchaseId: existingPurchase.id,
                  expiryDate: existingPurchase.expiryDate.toISOString()
                });
                
                // 更新访问权限
                io.emit('questionSet:accessUpdate', {
                  userId,
                  questionSetId,
                  hasAccess: true
                });
              }
            }
          } else {
            // 计算过期时间（6个月后）
            const now = new Date();
            const expiryDate = new Date(now);
            expiryDate.setMonth(expiryDate.getMonth() + 6);
            
            // 创建购买记录
            const purchase = await db.Purchase.create({
              id: uuidv4(),
              userId,
              questionSetId,
              purchaseDate: now,
              expiryDate,
              amount: paymentIntent.amount / 100, // 转换回元
              transactionId: paymentIntent.id,
              paymentMethod: 'card',
              status: 'active'
            });
            
            // 发送购买成功事件
            if (req.app.get('io')) {
              const io = req.app.get('io');
              
              io.emit('purchase:success', {
                userId,
                questionSetId,
                purchaseId: purchase.id,
                expiryDate: expiryDate.toISOString()
              });
              
              // 更新访问权限
              io.emit('questionSet:accessUpdate', {
                userId,
                questionSetId,
                hasAccess: true
              });
            }
          }
        }
        break;
        
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('支付失败:', failedPaymentIntent.id, failedPaymentIntent.last_payment_error?.message);
        break;
        
      default:
        console.log(`未处理的事件类型: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook错误:', error);
    res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

export default router; 