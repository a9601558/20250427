import { Request, Response } from 'express';
import User, { UserCreationAttributes } from '../models/User';
import { Op } from 'sequelize';
import { IUser, IPurchase, IRedeemCode } from '../types';

// JWT token生成现在由AWS Cognito处理
// 不再需要本地JWT token生成逻辑

// 统一响应格式
const sendResponse = <T>(res: Response, status: number, data: T, message?: string) => {
  res.status(status).json({
    success: status >= 200 && status < 300,
    data,
    message
  });
};

// 统一错误响应
const sendError = (res: Response, status: number, message: string, error?: any) => {
  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined
  });
};

/**
 * AWS Cognito用户自动创建或获取 (TypeScript版本)
 * 当Cognito用户首次访问时，在本地数据库创建用户记录
 * @access Internal (called by authMiddleware)
 */
export const createOrGetCognitoUser = async (cognitoUser: any) => {
  try {
    // 使用Cognito的sub作为用户ID
    const userId = cognitoUser.sub;
    const email = cognitoUser.email;
    const username = cognitoUser.preferred_username || cognitoUser.email?.split('@')[0] || `user_${userId.substring(0, 8)}`;

    // 查找或创建用户
    let user = await User.findByPk(userId);
    
    if (!user) {
      // 创建新用户，使用Cognito的sub作为ID
      const userData: UserCreationAttributes = {
        id: userId, // 使用Cognito sub作为主键
        username,
        email,
        password: '', // Cognito用户不需要本地密码
        isAdmin: false,
        purchases: [] as IPurchase[],
        redeemCodes: [] as IRedeemCode[],
        progress: {},
        socket_id: null
      };
      
      user = await User.create(userData);
      console.log(`Created new Cognito user: ${username} (${userId})`);
    }

    return user;
  } catch (error) {
    console.error('Cognito用户创建/获取错误:', error);
    throw error;
  }
};

// 传统登录已移除 - 现在使用AWS Cognito认证 (TypeScript版本)
// 登录流程：前端Cognito UI -> AWS Cognito -> JWT token -> authMiddleware验证

// @desc    Get user profile
// @route   GET /api/v1/users/profile
// @access  Private
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    // 使用附加包括关联数据的查询选项，确保返回完整用户数据
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      // 添加include选项，确保加载purchases和redeemCodes关联数据
      include: [
        { 
          association: 'userPurchases',
          attributes: ['id', 'questionSetId', 'purchaseDate', 'expiryDate', 'status', 'paymentMethod', 'amount', 'transactionId']
        },
        {
          association: 'userRedeemCodes'
        }
      ],
      // 记录请求信息以帮助调试跨设备同步問題
      logging: (sql) => {
        console.log(`[用户资料] 获取用户(${req.user.id})资料, 设备: ${req.headers['user-agent']}`);
      },
    });

    if (user) {
      // 确保返回的数据结构完整
      const userData = user.toJSON();
      
      // 为了保持兼容性，将userPurchases映射回purchases字段
      if (userData.userPurchases) {
        userData.purchases = userData.userPurchases;
        delete userData.userPurchases; // 删除多余字段
      } else {
        userData.purchases = [];
      }
      
      // 为了保持兼容性，将userRedeemCodes映射回redeemCodes字段
      if ((userData as any).userRedeemCodes) {
        userData.redeemCodes = (userData as any).userRedeemCodes;
        delete (userData as any).userRedeemCodes; // 删除多余字段
      } else {
        userData.redeemCodes = [];
      }
      
      // 确保purchases字段是数组
      if (!userData.purchases) {
        userData.purchases = [];
      } else {
        console.log(`[用户资料] 用户购买记录详情:`, JSON.stringify(userData.purchases.slice(0, 2)));
      }
      
      // 如果examCountdowns字段是字符串，尝试解析为JSON
      if (typeof userData.examCountdowns === 'string') {
        try {
          userData.examCountdowns = JSON.parse(userData.examCountdowns);
        } catch (e) {
          console.error('解析examCountdowns失败:', e);
          // 如果解析失败，使用空数组
          userData.examCountdowns = [];
        }
      }
      
      console.log(`[用户资料] 返回用户数据，购买记录: ${userData.purchases?.length || 0}条`);
      
      // 返回完整的用户数据
      sendResponse(res, 200, userData);
    } else {
      sendError(res, 404, '用户不存在');
    }
  } catch (error) {
    console.error('Get profile error:', error);
    sendError(res, 500, '获取用户信息失败', error);
  }
};

// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (user) {
      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;
      
      // 添加对examCountdowns的处理
      if (req.body.examCountdowns !== undefined) {
        // 确保examCountdowns作为字符串存储
        user.examCountdowns = typeof req.body.examCountdowns === 'string'
          ? req.body.examCountdowns
          : JSON.stringify(req.body.examCountdowns);
      }

      const updatedUser = await user.save();

      const userResponse = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        isAdmin: updatedUser.isAdmin,
        examCountdowns: updatedUser.examCountdowns // 添加examCountdowns到响应中
      };

      sendResponse(res, 200, {
        user: userResponse
        // 不再需要token，客户端继续使用现有的Cognito token
      }, '用户信息更新成功');
    } else {
      sendError(res, 404, '用户不存在');
    }
  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, 500, '更新用户信息失败', error);
  }
};

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });
    
    sendResponse(res, 200, users);
  } catch (error) {
    console.error('Get users error:', error);
    sendError(res, 500, '获取用户列表失败', error);
  }
};

// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Private/Admin
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (user) {
      sendResponse(res, 200, user);
    } else {
      sendError(res, 404, '用户不存在');
    }
  } catch (error) {
    console.error('Get user by ID error:', error);
    sendError(res, 500, '获取用户信息失败', error);
  }
};

// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (user) {
      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;
      
      // 添加对examCountdowns的处理
      if (req.body.examCountdowns !== undefined) {
        // 确保examCountdowns作为字符串存储
        user.examCountdowns = typeof req.body.examCountdowns === 'string'
          ? req.body.examCountdowns
          : JSON.stringify(req.body.examCountdowns);
      }

      const updatedUser = await user.save();

      const userResponse = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        isAdmin: updatedUser.isAdmin,
        examCountdowns: updatedUser.examCountdowns // 添加examCountdowns到响应中
      };

      sendResponse(res, 200, userResponse, '用户信息更新成功');
    } else {
      sendError(res, 404, '用户不存在');
    }
  } catch (error) {
    console.error('Update user error:', error);
    sendError(res, 500, '更新用户信息失败', error);
  }
};

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (user) {
      await user.destroy();
      sendResponse(res, 200, null, '用户删除成功');
    } else {
      sendError(res, 404, '用户不存在');
    }
  } catch (error) {
    console.error('Delete user error:', error);
    sendError(res, 500, '删除用户失败', error);
  }
}; 