import { Request, Response } from 'express';
import User, { UserCreationAttributes } from '../models/User';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { IUser, IPurchase, IRedeemCode } from '../types';

// 生成JWT令牌函数
const generateToken = (id: string | number) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: '30d',
  });
};

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

// @desc    Register a new user
// @route   POST /api/v1/users/register
// @access  Public
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // 验证必填字段
    if (!username || !email || !password) {
      return sendError(res, 400, '请提供用户名、邮箱和密码');
    }

    // 验证密码长度
    if (password.length < 6) {
      return sendError(res, 400, '密码长度至少为6个字符');
    }

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      where: { email }
    });
    
    if (existingUser) {
      return sendError(res, 400, '该邮箱已被注册');
    }

    // 打印密码确保它存在并且有效（仅在开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log('Password before creation:', password ? 'Password exists (not showing value)' : 'Password is empty');
    }

    // 创建新用户 - 不需要在此处加密密码，密码会在User模型的beforeSave钩子中自动加密
    // 使用unscoped()确保所有字段都包含在模型中，防止默认scope排除了password字段
    const userData: UserCreationAttributes = {
      username,
      email,
      password,
      purchases: [] as IPurchase[],
      redeemCodes: [] as IRedeemCode[],
      progress: {},
      socket_id: null,
      isAdmin: false
    };

    const user = await User.unscoped().create(userData);

    // 生成 JWT token
    const token = generateToken(user.id);

    // 返回用户信息（不包含密码）
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isAdmin: user.isAdmin
    };

    sendResponse(res, 201, {
      user: userResponse,
      token
    }, '注册成功');
  } catch (error) {
    console.error('注册用户时出错:', error);
    sendError(res, 500, '服务器错误，请稍后重试', error);
  }
};

// @desc    Login user & get token
// @route   POST /api/v1/users/login
// @access  Public
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    // 检查输入是否为空
    if (!username || !password) {
      return sendError(res, 400, '用户名/邮箱和密码不能为空');
    }

    // 先尝试按用户名查找，使用withPassword作用域以包含密码字段
    let user = await User.scope('withPassword').findOne({
      where: { username: username }
    });

    // 如果按用户名找不到，再按邮箱查找
    if (!user) {
      user = await User.scope('withPassword').findOne({
        where: { email: username }
      });
    }

    // 如果用户不存在，返回错误
    if (!user) {
      return sendError(res, 401, '用户名/邮箱或密码错误');
    }

    // 检查密码是否存在
    if (!user.password) {
      console.error('用户密码字段为空:', username);
      console.error('用户对象:', JSON.stringify(user, null, 2));
      return sendError(res, 500, '账户数据异常，请联系管理员或重置密码');
    }

    // 比较密码
    try {
      console.log('准备比较密码，用户密码字段存在:', !!user.password);
      const isPasswordMatch = await user.comparePassword(password);
      
      if (isPasswordMatch) {
        // 密码正确，返回用户信息和令牌
        const userResponse = {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isAdmin: user.isAdmin
        };

        sendResponse(res, 200, {
          user: userResponse,
          token: generateToken(user.id)
        }, '登录成功');
      } else {
        // 密码不匹配
        sendError(res, 401, '用户名/邮箱或密码错误');
      }
    } catch (passwordError) {
      console.error('密码比较过程出错:', passwordError);
      sendError(res, 500, '登录时发生错误，请稍后再试', passwordError);
    }
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 500, '登录失败，请稍后再试', error);
  }
};

// @desc    Get user profile
// @route   GET /api/v1/users/profile
// @access  Private
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    // 使用附加包括关联数据的查询选项，确保返回完整用户数据
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      // 记录请求信息以帮助调试跨设备同步问题
      logging: (sql) => {
        console.log(`[用户资料] 获取用户(${req.user.id})资料, 设备: ${req.headers['user-agent']}`);
      },
    });

    if (user) {
      // 确保返回的数据结构完整
      const userData = user.toJSON();
      
      // 确保purchases字段是数组
      if (!userData.purchases) {
        userData.purchases = [];
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
        user: userResponse,
        token: generateToken(updatedUser.id)
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