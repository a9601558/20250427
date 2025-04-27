/**
 * 该脚本用于将MongoDB数据迁移到MySQL数据库
 * 使用方法：
 * 1. 确保.env文件中配置了MongoDB和MySQL的连接信息
 * 2. 运行命令：npx ts-node src/scripts/migrateMongoDB.ts
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../config/db';
import { User, QuestionSet, Question, Option, Purchase, RedeemCode } from '../models';

dotenv.config();

// MongoDB连接URL (从旧系统获取)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exam_practice_app';

// 定义映射表接口
interface IdMappings {
  users: { [key: string]: string };
  questionSets: { [key: string]: string };
  questions: { [key: string]: string };
}

async function migrateData() {
  console.log('开始数据迁移...');
  
  // 连接MongoDB
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('MongoDB连接成功');
    
    const db = mongoClient.db();
    
    // 确保MySQL数据库已连接
    await sequelize.authenticate();
    console.log('MySQL连接成功');
    
    // 同步模型到MySQL (谨慎使用，会重置数据)
    if (process.env.RESET_DB === 'true') {
      await sequelize.sync({ force: true });
      console.log('MySQL数据库已重置');
    } else {
      await sequelize.sync({ alter: true });
      console.log('MySQL数据库模型已同步');
    }
    
    // 映射MongoDB ID到MySQL UUID的映射表
    const idMappings: IdMappings = {
      users: {},
      questionSets: {},
      questions: {}
    };
    
    // 1. 迁移用户数据
    console.log('开始迁移用户数据...');
    const mongoUsers = await db.collection('users').find({}).toArray();
    
    for (const mongoUser of mongoUsers) {
      const newId = uuidv4();
      idMappings.users[mongoUser._id.toString()] = newId;
      
      await User.create({
        id: newId,
        username: mongoUser.username,
        email: mongoUser.email,
        password: mongoUser.password, // 已经加密的密码
        isAdmin: mongoUser.isAdmin || false,
        progress: mongoUser.progress || {},
        purchases: mongoUser.purchases || [],
        redeemCodes: mongoUser.redeemCodes || []
      });
    }
    console.log(`已迁移 ${mongoUsers.length} 个用户`);
    
    // 2. 迁移题库数据
    console.log('开始迁移题库数据...');
    const mongoQuestionSets = await db.collection('questionsets').find({}).toArray();
    
    for (const mongoQuestionSet of mongoQuestionSets) {
      const newId = uuidv4();
      idMappings.questionSets[mongoQuestionSet._id.toString()] = newId;
      
      await QuestionSet.create({
        id: newId,
        title: mongoQuestionSet.title,
        description: mongoQuestionSet.description,
        category: mongoQuestionSet.category,
        icon: mongoQuestionSet.icon,
        isPaid: mongoQuestionSet.isPaid || false,
        price: mongoQuestionSet.price,
        trialQuestions: mongoQuestionSet.trialQuestions
      });
      
      // 迁移题目数据
      if (mongoQuestionSet.questions && Array.isArray(mongoQuestionSet.questions)) {
        for (let i = 0; i < mongoQuestionSet.questions.length; i++) {
          const mongoQuestion = mongoQuestionSet.questions[i];
          const newQuestionId = uuidv4();
          idMappings.questions[mongoQuestion.id || i.toString()] = newQuestionId;
          
          // 创建问题
          await Question.create({
            id: newQuestionId,
            questionSetId: newId,
            text: mongoQuestion.question || mongoQuestion.text,
            questionType: mongoQuestion.questionType || 'single',
            explanation: mongoQuestion.explanation || '',
            orderIndex: i
          });
          
          // 创建选项
          if (mongoQuestion.options && Array.isArray(mongoQuestion.options)) {
            for (let j = 0; j < mongoQuestion.options.length; j++) {
              const mongoOption = mongoQuestion.options[j];
              
              // 确定选项是否正确
              let isCorrect = false;
              
              if (mongoQuestion.questionType === 'single') {
                isCorrect = mongoOption.id === mongoQuestion.correctAnswer;
              } else if (mongoQuestion.questionType === 'multiple' && Array.isArray(mongoQuestion.correctAnswer)) {
                isCorrect = mongoQuestion.correctAnswer.includes(mongoOption.id);
              }
              
              await Option.create({
                id: uuidv4(),
                questionId: newQuestionId,
                text: mongoOption.text,
                isCorrect: isCorrect,
                optionIndex: mongoOption.id
              });
            }
          }
        }
      }
    }
    console.log(`已迁移 ${mongoQuestionSets.length} 个题库`);
    
    // 3. 迁移购买记录
    console.log('开始迁移购买记录...');
    const mongoPurchases = await db.collection('purchases').find({}).toArray();
    
    for (const mongoPurchase of mongoPurchases) {
      // 查找对应的用户ID和题库ID
      const userId = idMappings.users[mongoPurchase.userId.toString()];
      const quizId = idMappings.questionSets[mongoPurchase.quizId.toString()];
      
      if (userId && quizId) {
        await Purchase.create({
          id: uuidv4(),
          userId: userId,
          quizId: quizId,
          purchaseDate: new Date(mongoPurchase.purchaseDate),
          expiryDate: new Date(mongoPurchase.expiryDate),
          transactionId: mongoPurchase.transactionId,
          amount: mongoPurchase.amount,
          paymentMethod: 'card',
          status: 'completed'
        });
      }
    }
    console.log(`已迁移 ${mongoPurchases.length} 个购买记录`);
    
    // 4. 迁移兑换码
    console.log('开始迁移兑换码...');
    const mongoRedeemCodes = await db.collection('redeemcodes').find({}).toArray();
    
    for (const mongoRedeemCode of mongoRedeemCodes) {
      // 查找对应的问题集ID和用户ID
      const questionSetId = idMappings.questionSets[mongoRedeemCode.questionSetId.toString()];
      let usedBy: string | undefined = undefined;
      
      if (mongoRedeemCode.usedBy) {
        usedBy = idMappings.users[mongoRedeemCode.usedBy.toString()];
      }
      
      if (questionSetId) {
        // 兑换码的创建者，如果不存在则使用第一个管理员
        let createdBy: string | undefined = undefined;
        
        if (mongoRedeemCode.createdBy) {
          createdBy = idMappings.users[mongoRedeemCode.createdBy.toString()];
        }
        
        if (!createdBy) {
          const adminUser = await User.findOne({
            where: { isAdmin: true }
          });
          
          if (adminUser) {
            createdBy = adminUser.id;
          }
        }
        
        if (createdBy) {
          await RedeemCode.create({
            id: uuidv4(),
            code: mongoRedeemCode.code,
            questionSetId: questionSetId,
            validityDays: mongoRedeemCode.validityDays || 30,
            expiryDate: mongoRedeemCode.expiryDate ? new Date(mongoRedeemCode.expiryDate) : undefined,
            isUsed: !!mongoRedeemCode.usedBy,
            usedBy: usedBy,
            usedAt: mongoRedeemCode.usedAt ? new Date(mongoRedeemCode.usedAt) : undefined,
            createdBy: createdBy
          });
        }
      }
    }
    console.log(`已迁移 ${mongoRedeemCodes.length} 个兑换码`);
    
    console.log('数据迁移完成！');
    
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
  } finally {
    // 关闭连接
    await mongoClient.close();
    await sequelize.close();
  }
}

// 执行迁移
migrateData()
  .then(() => {
    console.log('迁移脚本执行完毕');
    process.exit(0);
  })
  .catch((err) => {
    console.error('迁移脚本执行失败:', err);
    process.exit(1);
  }); 