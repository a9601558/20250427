const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * 用户注册
 * @route POST /users/register
 * @access Public
 */
exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 验证请求数据
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供用户名、邮箱和密码'
      });
    }

    // 检查用户是否已存在
    const userExists = await User.findOne({
      where: {
        [User.sequelize.Op.or]: [
          { username },
          { email }
        ]
      }
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已被注册'
      });
    }

    // 密码哈希
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建用户
    const user = await User.create({
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      isAdmin: false,
      progress: {},
      purchases: [],
      redeemCodes: []
    });

    // 创建JWT令牌
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    // 返回用户信息和令牌(不包含密码)
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      data: {
        user: userWithoutPassword,
        token
      },
      message: '用户注册成功'
    });
    
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 用户登录
 * @route POST /users/login
 * @access Public
 */
exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证请求数据
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供用户名和密码'
      });
    }

    // 查找用户 - 支持用户名或邮箱登录
    const user = await User.findOne({
      where: {
        [User.sequelize.Op.or]: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码不正确'
      });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码不正确'
      });
    }

    // 创建JWT令牌
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    // 返回用户信息和令牌(不包含密码)
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    };

    res.status(200).json({
      success: true,
      data: {
        user: userWithoutPassword,
        token
      },
      message: '登录成功'
    });
    
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取当前用户信息
 * @route GET /users/me
 * @access Private
 */
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
    
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 