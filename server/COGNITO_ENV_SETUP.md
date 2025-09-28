# AWS Cognito Configuration for JWT Authentication
# Add these environment variables to your .env file

# AWS Cognito Region (where your user pool is located)
COGNITO_REGION=ap-southeast-2

# AWS Cognito User Pool ID (found in AWS Console)
COGNITO_USER_POOL_ID=ap-southeast-2_El0UTGvLD

# Traditional JWT Secret (keep for backward compatibility)
JWT_SECRET=your-existing-jwt-secret

# JWT Token Expiration
JWT_EXPIRES_IN=30d

# Example .env file content:
# COGNITO_REGION=ap-southeast-2
# COGNITO_USER_POOL_ID=ap-southeast-2_El0UTGvLD
# JWT_SECRET=your-secret-key-here
# JWT_EXPIRES_IN=30d