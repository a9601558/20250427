# Cognito 短信发送问题修复

## 问题分析

用户报告注册时可以收到短信验证码，但找回密码时收不到短信。这通常是以下几个原因：

### 1. AWS Cognito配置问题
- **MFA设置**: Multi-Factor Authentication配置可能只对注册启用了短信
- **传送配置**: 找回密码的传送方式可能设置为邮件而非短信
- **区域设置**: 短信服务可能在特定区域有限制

### 2. Amplify UI配置问题
- **传送方式选择**: 用户可能默认选择了邮件而非短信
- **手机号格式**: 找回密码时手机号格式验证可能更严格

## 修复方案

### 方案1: 检查AWS Cognito控制台配置

1. **检查User Pool设置**:
   - 登录AWS控制台 → Cognito → User pools
   - 选择你的User Pool: `ap-southeast-2_El0UTGvLD`
   - 检查"Sign-in experience" → "Multi-factor authentication"
   - 确认SMS设置是否正确

2. **检查消息配置**:
   - 在User Pool中，转到"Messaging"选项卡
   - 检查"SMS"配置是否启用
   - 确认"Password reset"是否允许SMS传送

3. **检查属性配置**:
   - 转到"User pool properties"
   - 检查"Required attributes"包含phone_number
   - 确认"Verification"设置允许SMS验证

### 方案2: 前端代码增强

#### 创建自定义忘记密码处理器

```typescript
// src/services/forgotPasswordService.ts
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
  deliveryMedium?: 'SMS' | 'EMAIL';
  destination?: string;
}

export const customForgotPassword = async (username: string): Promise<ForgotPasswordResult> => {
  try {
    console.log('[ForgotPassword] 开始重置密码流程:', { username });
    
    const result = await resetPassword({ username });
    
    console.log('[ForgotPassword] Cognito响应:', result);
    console.log('[ForgotPassword] 传送方式:', result.nextStep?.resetPasswordStep);
    
    if (result.nextStep?.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
      const deliveryDetails = result.nextStep.codeDeliveryDetails;
      
      return {
        success: true,
        message: `验证码已发送到 ${deliveryDetails?.deliveryMedium === 'SMS' ? '手机' : '邮箱'}`,
        deliveryMedium: deliveryDetails?.deliveryMedium as 'SMS' | 'EMAIL',
        destination: deliveryDetails?.destination
      };
    }
    
    return {
      success: false,
      message: '重置密码请求失败，请稍后再试'
    };
    
  } catch (error: any) {
    console.error('[ForgotPassword] 错误:', error);
    
    let errorMessage = '发送验证码失败';
    
    if (error.name === 'UserNotFoundException') {
      errorMessage = '用户不存在，请检查用户名或手机号';
    } else if (error.name === 'InvalidParameterException') {
      errorMessage = '参数错误，请检查手机号格式';
    } else if (error.name === 'LimitExceededException') {
      errorMessage = '请求过于频繁，请稍后再试';
    } else if (error.name === 'CodeDeliveryFailureException') {
      errorMessage = '短信发送失败，请检查手机号或稍后再试';
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
};

export const customConfirmResetPassword = async (
  username: string, 
  confirmationCode: string, 
  newPassword: string
): Promise<ForgotPasswordResult> => {
  try {
    console.log('[ConfirmResetPassword] 确认重置密码:', { username, confirmationCode: '***' });
    
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
    console.error('[ConfirmResetPassword] 错误:', error);
    
    let errorMessage = '密码重置失败';
    
    if (error.name === 'CodeMismatchException') {
      errorMessage = '验证码错误，请检查后重试';
    } else if (error.name === 'ExpiredCodeException') {
      errorMessage = '验证码已过期，请重新获取';
    } else if (error.name === 'InvalidPasswordException') {
      errorMessage = '新密码不符合要求，请重新设置';
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
};
```

#### 更新CognitoAuth组件

```typescript
// 在CognitoAuth.tsx中添加自定义处理
const customHandleForgotPassword = async (username: string) => {
  try {
    const result = await customForgotPassword(username);
    
    if (result.success) {
      console.log(`[ForgotPassword] 成功: ${result.message}`);
      console.log(`[ForgotPassword] 传送方式: ${result.deliveryMedium}`);
      console.log(`[ForgotPassword] 目标: ${result.destination}`);
      
      // 显示成功消息
      toast.success(result.message);
      
      // 如果是邮件传送，提醒用户也检查短信
      if (result.deliveryMedium === 'EMAIL') {
        toast.info('如果您希望通过短信接收验证码，请确保您的手机号已验证');
      }
    } else {
      toast.error(result.message);
    }
  } catch (error) {
    console.error('[ForgotPassword] 处理错误:', error);
    toast.error('发送验证码失败，请检查网络连接');
  }
};
```

### 方案3: AWS Cognito控制台检查清单

#### 必需检查项目:

1. **User Pool → Sign-in experience**:
   - ✅ Username/Email/Phone number都已启用
   - ✅ Multi-factor authentication设置正确

2. **User Pool → User pool properties**:
   - ✅ Required attributes包含 `email` 和 `phone_number`
   - ✅ Alias attributes允许 `email` 和 `phone_number`

3. **User Pool → Messaging**:
   - ✅ SMS配置已启用
   - ✅ "From phone number" 已设置（如果使用自定义号码）
   - ✅ SMS message template包含密码重置模板

4. **User Pool → App integration → App clients**:
   - ✅ 您的app client (`3l9nrspcr34tjjs1isupccvb4t`) 权限正确
   - ✅ Auth flows包含 `ALLOW_USER_PASSWORD_AUTH` 和 `ALLOW_REFRESH_TOKEN_AUTH`

### 方案4: 调试步骤

1. **检查用户属性**:
   ```javascript
   // 在浏览器控制台执行
   import { fetchUserAttributes } from 'aws-amplify/auth';
   fetchUserAttributes().then(attrs => console.log('用户属性:', attrs));
   ```

2. **测试不同的用户名格式**:
   - 使用邮箱地址: `user@example.com`
   - 使用手机号: `+8613812345678`
   - 使用用户名: `username`

3. **检查AWS CloudWatch日志**:
   - AWS控制台 → CloudWatch → Log groups
   - 查找 `/aws/cognito/userpools/[YourUserPoolId]`
   - 检查错误日志

## 常见问题解决

### Q1: 只能收到邮件，收不到短信
**解决**: 检查User Pool的Messaging配置，确保SMS服务已正确配置

### Q2: 短信发送到错误的号码
**解决**: 确认用户的phone_number属性格式正确 (例: +8613812345678)

### Q3: 验证码延迟到达
**解决**: AWS短信服务可能有延迟，等待5-10分钟或重新发送

### Q4: 特定地区无法接收短信
**解决**: 检查AWS SNS的短信服务在目标地区是否可用

## 测试建议

1. **创建测试用户**，分别测试邮箱和短信注册
2. **测试忘记密码流程**，记录详细的控制台日志
3. **检查不同的用户名输入格式**
4. **在AWS控制台直接发送测试短信**

如果问题仍然存在，可能需要联系AWS支持或检查您的AWS账户的SMS配额限制。