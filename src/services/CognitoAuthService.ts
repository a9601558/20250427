import { 
  getCurrentUser, 
  fetchUserAttributes, 
  signIn, 
  signUp, 
  signOut, 
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  resendSignUpCode
} from 'aws-amplify/auth';
import { User } from '../types';
// import { userApi } from '../utils/api'; // TODO: 集成现有API时启用

export interface CognitoAuthResult {
  success: boolean;
  user?: User;
  message?: string;
  needsVerification?: boolean;
  challengeName?: string;
  session?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message?: string;
  destination?: string;
}

export interface ConfirmPasswordResetResult {
  success: boolean;
  message?: string;
}

class CognitoAuthService {
  /**
   * 使用Cognito进行登录，成功后同步到本地数据库
   */
  async cognitoLogin(username: string, password: string): Promise<CognitoAuthResult> {
    try {
      const { isSignedIn } = await signIn({
        username,
        password,
      });

      if (isSignedIn) {
        // 获取用户信息
        const currentUser = await getCurrentUser();
        const attributes = await fetchUserAttributes();

        // 创建或更新本地用户记录
        const userData: Partial<User> = {
          id: currentUser.userId,
          username: currentUser.username || attributes.preferred_username || '',
          email: attributes.email || '',
          cognitoUserId: currentUser.userId, // 保存Cognito用户ID
          lastLogin: new Date().toISOString(),
        };

        // 尝试在本地数据库中创建或更新用户（暂时跳过，直接使用Cognito数据）
        // TODO: 实现与现有后端API的集成
        try {
          // const dbResponse = await userApi.syncCognitoUser(userData);
          // if (dbResponse.success && dbResponse.data) {
          //   return {
          //     success: true,
          //     user: dbResponse.data,
          //   };
          // }
        } catch (dbError) {
          console.warn('本地数据库同步失败，使用Cognito用户数据:', dbError);
        }

        // 如果数据库同步失败，仍然返回Cognito用户数据
        return {
          success: true,
          user: userData as User,
        };
      }

      return {
        success: false,
        message: '登录失败',
      };
    } catch (error: any) {
      console.error('Cognito登录失败:', error);
      
      let errorMessage = '登录失败';
      if (error.name === 'NotAuthorizedException') {
        errorMessage = '用户名或密码错误';
      } else if (error.name === 'UserNotConfirmedException') {
        errorMessage = '账号未验证，请检查邮箱验证链接';
        return {
          success: false,
          message: errorMessage,
          needsVerification: true,
        };
      } else if (error.name === 'UserNotFoundException') {
        errorMessage = '用户不存在';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * 使用Cognito进行注册
   */
  async cognitoRegister(userData: { username: string; email: string; password: string; phone_number?: string }): Promise<CognitoAuthResult> {
    try {
      const userAttributes: Record<string, string> = {
        email: userData.email,
      };
      
      // 如果提供了手机号，则添加到用户属性中
      if (userData.phone_number) {
        userAttributes.phone_number = userData.phone_number;
      }
      
      const { isSignUpComplete, userId } = await signUp({
        username: userData.username,
        password: userData.password,
        options: {
          userAttributes,
        },
      });

      if (isSignUpComplete || userId) {
        return {
          success: true,
          message: '注册成功！请检查邮箱验证链接',
          needsVerification: !isSignUpComplete,
        };
      }

      return {
        success: false,
        message: '注册失败',
      };
    } catch (error: any) {
      console.error('Cognito注册失败:', error);
      
      let errorMessage = '注册失败';
      if (error.name === 'UsernameExistsException') {
        errorMessage = '用户名已存在';
      } else if (error.name === 'InvalidPasswordException') {
        errorMessage = '密码不符合要求';
      } else if (error.name === 'InvalidParameterException') {
        errorMessage = '参数无效，请检查输入';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * 确认用户注册（验证邮箱）
   */
  async confirmSignUp(username: string, confirmationCode: string): Promise<CognitoAuthResult> {
    try {
      await confirmSignUp({
        username,
        confirmationCode,
      });

      return {
        success: true,
        message: '邮箱验证成功，请登录',
      };
    } catch (error: any) {
      console.error('邮箱验证失败:', error);
      
      let errorMessage = '验证失败';
      if (error.name === 'CodeMismatchException') {
        errorMessage = '验证码错误';
      } else if (error.name === 'ExpiredCodeException') {
        errorMessage = '验证码已过期';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * 退出登录
   */
  async cognitoLogout(): Promise<void> {
    try {
      await signOut();
    } catch (error) {
      console.error('Cognito退出登录失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前认证用户
   */
  async getCurrentAuthUser(): Promise<User | null> {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      // 尝试从本地数据库获取完整用户信息（暂时跳过）
      // TODO: 实现与现有后端API的集成
      try {
        // const dbResponse = await userApi.getCognitoUser(currentUser.userId);
        // if (dbResponse.success && dbResponse.data) {
        //   return dbResponse.data;
        // }
      } catch (dbError) {
        console.warn('从数据库获取用户信息失败，使用Cognito数据:', dbError);
      }

      // 返回基础用户信息
      const userData: User = {
        id: currentUser.userId,
        username: currentUser.username || attributes.preferred_username || '',
        email: attributes.email || '',
        cognitoUserId: currentUser.userId,
        createdAt: attributes.created_at || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        purchases: [],
        progress: {}, // 正确的Record<string, UserProgress>类型
        isAdmin: false,
        accessRights: [],
      };

      return userData;
    } catch (error) {
      console.log('未找到认证用户:', error);
      return null;
    }
  }

  /**
   * 忘记密码 - 发送重置密码验证码
   */
  async forgotPassword(username: string): Promise<PasswordResetResult> {
    try {
      const output = await resetPassword({ username });
      
      return {
        success: true,
        message: '密码重置验证码已发送',
        destination: output.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE' 
          ? output.nextStep.codeDeliveryDetails?.destination || '您的邮箱或手机'
          : '您的邮箱或手机'
      };
    } catch (error: any) {
      console.error('忘记密码失败:', error);
      return {
        success: false,
        message: error.message || '发送重置密码验证码失败，请稍后重试'
      };
    }
  }

  /**
   * 确认重置密码
   */
  async confirmForgotPassword(
    username: string, 
    confirmationCode: string, 
    newPassword: string
  ): Promise<ConfirmPasswordResetResult> {
    try {
      await confirmResetPassword({ 
        username, 
        confirmationCode, 
        newPassword 
      });
      
      return {
        success: true,
        message: '密码重置成功，请使用新密码登录'
      };
    } catch (error: any) {
      console.error('确认密码重置失败:', error);
      return {
        success: false,
        message: error.message || '密码重置失败，请检查验证码是否正确'
      };
    }
  }

  /**
   * 重新发送注册验证码
   */
  async resendVerificationCode(username: string): Promise<{ success: boolean; message: string; destination?: string }> {
    try {
      const output = await resendSignUpCode({ username });
      
      return {
        success: true,
        message: '验证码已重新发送',
        destination: output.destination || '您的邮箱或手机'
      };
    } catch (error: any) {
      console.error('重新发送验证码失败:', error);
      return {
        success: false,
        message: error.message || '重新发送验证码失败，请稍后重试'
      };
    }
  }

  /**
   * 重新发送密码重置验证码
   */
  async resendPasswordResetCode(username: string): Promise<PasswordResetResult> {
    // 密码重置验证码的重新发送实际上就是重新发起忘记密码流程
    return await this.forgotPassword(username);
  }

  /**
   * 验证用户输入格式（判断是邮箱还是手机号）
   */
  validateUserInput(input: string): { type: 'email' | 'phone' | 'username'; isValid: boolean } {
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(input)) {
      return { type: 'email', isValid: true };
    }

    // 简单的手机号格式验证（支持日本手机号）
    // 日本手机号格式：080-xxxx-xxxx, 090-xxxx-xxxx, 070-xxxx-xxxx等
    const phoneRegex = /^(\+81|81)?[0-9]{10,11}$|^0[789]0-?[0-9]{4}-?[0-9]{4}$/;
    if (phoneRegex.test(input.replace(/[\s-]/g, ''))) {
      return { type: 'phone', isValid: true };
    }

    // 用户名格式验证（4-20位字母数字下划线）
    const usernameRegex = /^[a-zA-Z0-9_]{4,20}$/;
    if (usernameRegex.test(input)) {
      return { type: 'username', isValid: true };
    }

    return { type: 'username', isValid: false };
  }

  /**
   * 检查用户是否已认证
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }
}

export const cognitoAuthService = new CognitoAuthService();