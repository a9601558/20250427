const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-northeast-1_06Lr5s5h9',
      userPoolClientId: '3tdjflgaoojolmlau5thc9lv5c', // OIDC と統一
      // 指定AWS区域 - 确保與User Pool所在区域一致
      region: 'ap-northeast-1',
      loginWith: {
        username: true,
        email: true,
        phone: true,
      },
      signUpVerificationMethod: 'code' as const,
      userAttributes: {
        email: {
          required: true,
        },
        phone_number: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false,
      },
    },
  },
};

export default amplifyConfig;