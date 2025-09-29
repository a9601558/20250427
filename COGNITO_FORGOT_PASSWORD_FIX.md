# AWS Cognito 忘记密码功能修复指南

## 问题描述
用户在使用忘记密码功能时，输入手机号和邮箱后无法接收到SMS和邮件验证码。

## 可能的原因和解决方案

### 1. AWS Cognito User Pool 配置问题

#### 1.1 检查验证方法配置
在AWS控制台 → Cognito → User Pool → 您的User Pool → Sign-up experience：

```
✅ 确保启用了以下选项：
- Email address
- Phone number  
- Allow users to use both email and phone number
```

#### 1.2 检查消息传递配置
在 User Pool → Messaging → SMS：

```
✅ 配置SMS设置：
- SNS region: ap-southeast-2 (与User Pool同区域)
- IAM role: 必须有发送SMS的权限
- External ID: 正确配置
```

在 User Pool → Messaging → Email：

```
✅ 配置SES设置：
- 使用Amazon SES或Cognito default
- 如果使用SES，确保邮箱已验证
- From email address: 必须是已验证的邮箱
```

### 2. AWS SES 服务配置

#### 2.1 邮箱验证
1. 前往 AWS SES 控制台
2. 在左侧导航中选择 "Verified identities"
3. 添加并验证您要使用的发件邮箱地址
4. 确保状态为 "Verified"

#### 2.2 SES沙盒模式
```
⚠️ 检查SES是否处于沙盒模式：
- 沙盒模式下只能发送到已验证的邮箱
- 申请移出沙盒模式或验证接收邮箱
```

### 3. AWS SNS SMS 服务配置

#### 3.1 SMS配额检查
1. 前往 AWS SNS 控制台
2. 检查SMS配额和使用情况
3. 确保有足够的SMS发送配额

#### 3.2 地区限制
```
⚠️ 检查SMS发送地区限制：
- 某些国家/地区可能限制SMS发送
- 日本地区需要特殊的SMS发送权限
```

### 4. IAM 权限配置

#### 4.1 Cognito服务角色权限
创建或更新IAM角色，包含以下权限：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sns:Publish"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow", 
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail"
            ],
            "Resource": "*"
        }
    ]
}
```

### 5. 前端代码修复

#### 5.1 区域配置
已在 `amplifyConfig.ts` 中添加了正确的区域配置：

```typescript
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-southeast-2_El0UTGvLD',
      userPoolClientId: '3l9nrspcr34tjjs1isupccvb4t',
      region: 'ap-southeast-2', // ✅ 新增区域配置
      // ... 其他配置
    },
  },
};
```

#### 5.2 错误处理改进
已在 `CognitoAuth.tsx` 中添加了详细的错误处理和调试信息。

### 6. 调试步骤

#### 6.1 浏览器控制台检查
1. 打开浏览器开发者工具
2. 在Console中查看调试信息
3. 查找具体的错误消息

#### 6.2 AWS CloudTrail 日志
1. 检查AWS CloudTrail中的Cognito相关日志
2. 查找失败的API调用
3. 分析错误原因

### 7. 测试验证

#### 7.1 逐步测试
```
1. 测试用户注册 → 验证邮件/SMS是否正常接收
2. 测试忘记密码 → 检查验证码发送
3. 测试不同的输入格式（邮箱/手机号/用户名）
```

#### 7.2 日志监控
```
开发环境下查看浏览器控制台：
- [CognitoAuth Debug] 配置信息
- [CognitoAuth] 忘记密码流程日志
- 具体的错误信息和建议
```

## 常见错误及解决方案

### Error: UserNotFoundException
```
原因：用户不存在
解决：确保输入的用户名/邮箱/手机号与注册时一致
```

### Error: LimitExceededException  
```
原因：请求过于频繁
解决：等待一段时间后重试
```

### Error: InvalidParameterException
```
原因：输入参数格式错误
解决：检查邮箱和手机号格式是否正确
```

### 邮件/SMS未收到但无错误
```
可能原因：
1. SES处于沙盒模式
2. SMS配额不足
3. 地区限制
4. 垃圾邮件过滤

解决方案：
1. 检查垃圾邮件文件夹
2. 验证AWS服务配置
3. 检查配额使用情况
```

## 重要提醒

1. **确保AWS服务区域一致**：Cognito、SES、SNS都应该在同一区域
2. **检查服务配额**：特别是SMS和邮件发送配额
3. **验证权限配置**：IAM角色必须有正确的权限
4. **测试环境**：在生产环境部署前，先在测试环境验证

## 联系支持

如果以上步骤都无法解决问题，请提供：
1. 浏览器控制台的完整错误日志
2. AWS Cognito User Pool配置截图
3. 测试的具体步骤和结果

---
修复时间：2025年1月
修复版本：ver8