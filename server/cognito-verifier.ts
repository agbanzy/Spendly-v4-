import { CognitoJwtVerifier } from 'aws-jwt-verify';

let idTokenVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
let isCognitoConfigured = false;

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

if (userPoolId && clientId) {
  try {
    idTokenVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId,
    });
    isCognitoConfigured = true;
    console.log('AWS Cognito JWT Verifier initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Cognito JWT Verifier:', error);
  }
} else {
  console.warn('Cognito not configured: Missing COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID');
  console.warn('Authentication middleware will use dev-mode bypass in development.');
}

export { idTokenVerifier, isCognitoConfigured };
