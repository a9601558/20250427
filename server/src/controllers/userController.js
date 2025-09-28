const { User } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * AWS Cognito用户自动创建或获取
 * 当Cognito用户首次访问时，在本地数据库创建用户记录
 * @access Internal (called by authMiddleware)
 */
exports.createOrGetCognitoUser = async (cognitoUser) => {
  try {
    // 使用Cognito的sub作为用户ID
    const userId = cognitoUser.sub;
    const email = cognitoUser.email;
    const username = cognitoUser.preferred_username || cognitoUser.email?.split('@')[0] || `user_${userId.substring(0, 8)}`;

    // 查找或创建用户
    let user = await User.findByPk(userId);
    
    if (!user) {
      // 创建新用户，使用Cognito的sub作为ID
      user = await User.create({
        id: userId, // 使用Cognito sub作为主键
        username,
        email,
        password: null, // Cognito用户不需要本地密码
        isAdmin: false,
        progress: {},
        purchases: [],
        redeemCodes: []
      });
      
      console.log(`Created new Cognito user: ${username} (${userId})`);
    }

    return user;
  } catch (error) {
    console.error('Cognito用户创建/获取错误:', error);
    throw error;
  }
};

// 传统登录已移除 - 现在使用AWS Cognito认证
// 登录流程：前端Cognito UI -> AWS Cognito -> JWT token -> authMiddleware验证

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

/**
 * Update user's profile
 * @route PUT /users/:id
 * @access Private
 */
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // Check if the user is authorized to update this profile
    if (userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改其他用户的信息'
      });
    }
    
    // Extract updatable fields
    const { username, email, examCountdowns } = req.body;
    
    // Prepare update object
    const updateData = {};
    
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    
    // Handle examCountdowns data
    if (examCountdowns !== undefined) {
      // Make sure it's stored as a string in the database
      updateData.examCountdowns = typeof examCountdowns === 'string' 
        ? examCountdowns 
        : JSON.stringify(examCountdowns);
    }
    
    // Update user
    await user.update(updateData);
    
    // Return updated user (excluding password)
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });
    
    res.status(200).json({
      success: true,
      data: updatedUser,
      message: '用户信息更新成功'
    });
    
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 