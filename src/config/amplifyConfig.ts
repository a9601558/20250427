const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-southeast-2_El0UTGvLD',
      userPoolClientId: '3l9nrspcr34tjjs1isupccvb4t',
      // 指定AWS区域 - 确保与User Pool所在区域一致
      region: 'ap-southeast-2',
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