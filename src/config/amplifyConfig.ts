const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-southeast-2_El0UTGvLD',
      userPoolClientId: '3l9nrspcr34tjjs1isupccvb4t',
      loginWith: {
        username: true,
        email: true,
      },
      signUpVerificationMethod: 'code' as const,
      userAttributes: {
        email: {
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