/**
 * SMS Magic Login — Cognito Custom Auth flow
 * Endpoints:
 *   POST /api/auth/sms/initiate — sends OTP to phone number
 *   POST /api/auth/sms/verify   — verifies OTP and returns tokens
 */
import type { Express, Request, Response } from 'express';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

export function registerSmsAuthRoutes(app: Express) {
  if (!USER_POOL_ID || !CLIENT_ID) {
    console.warn('SMS Auth: Cognito not configured — SMS login routes disabled');
    return;
  }

  /**
   * POST /api/auth/sms/initiate
   * Body: { phoneNumber: "+1234567890" }
   * Starts CUSTOM_AUTH flow → triggers DefineAuthChallenge + CreateAuthChallenge lambdas
   */
  app.post('/api/auth/sms/initiate', async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber || !/^\+\d{7,15}$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'Valid phone number in E.164 format required (e.g. +1234567890)' });
      }

      const command = new InitiateAuthCommand({
        AuthFlow: 'CUSTOM_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: phoneNumber,
        },
      });

      const result = await cognitoClient.send(command);

      if (result.ChallengeName === 'CUSTOM_CHALLENGE') {
        res.json({
          session: result.Session,
          challengeName: result.ChallengeName,
          phoneHint: result.ChallengeParameters?.phoneHint || phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, '$1****$2'),
        });
      } else {
        res.status(400).json({ error: 'Unexpected auth challenge', challengeName: result.ChallengeName });
      }
    } catch (error: any) {
      console.error('SMS auth initiate error:', error.name, error.message);

      if (error.name === 'UserNotFoundException') {
        // Don't reveal if user exists — return same success shape
        return res.status(400).json({ error: 'Unable to send verification code. Please check the phone number.' });
      }

      res.status(500).json({ error: 'Failed to initiate SMS login' });
    }
  });

  /**
   * POST /api/auth/sms/verify
   * Body: { phoneNumber: "+1234567890", otp: "123456", session: "<cognito-session>" }
   * Responds to CUSTOM_CHALLENGE → triggers VerifyAuthChallengeResponse lambda
   */
  app.post('/api/auth/sms/verify', async (req: Request, res: Response) => {
    try {
      const { phoneNumber, otp, session } = req.body;
      if (!phoneNumber || !otp || !session) {
        return res.status(400).json({ error: 'Phone number, OTP, and session are required' });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: 'OTP must be 6 digits' });
      }

      const command = new RespondToAuthChallengeCommand({
        ChallengeName: 'CUSTOM_CHALLENGE',
        ClientId: CLIENT_ID,
        ChallengeResponses: {
          USERNAME: phoneNumber,
          ANSWER: otp,
        },
        Session: session,
      });

      const result = await cognitoClient.send(command);

      if (result.AuthenticationResult) {
        res.json({
          idToken: result.AuthenticationResult.IdToken,
          accessToken: result.AuthenticationResult.AccessToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
          expiresIn: result.AuthenticationResult.ExpiresIn,
        });
      } else if (result.ChallengeName) {
        // Unexpected additional challenge
        res.status(400).json({
          error: 'Additional verification required',
          challengeName: result.ChallengeName,
        });
      } else {
        res.status(400).json({ error: 'Verification failed' });
      }
    } catch (error: any) {
      console.error('SMS auth verify error:', error.name, error.message);

      if (error.name === 'NotAuthorizedException' || error.name === 'CodeMismatchException') {
        return res.status(401).json({ error: 'Invalid or expired verification code' });
      }
      if (error.name === 'ExpiredCodeException') {
        return res.status(401).json({ error: 'Verification code has expired. Please request a new one.' });
      }

      res.status(500).json({ error: 'Failed to verify SMS code' });
    }
  });

  console.log('SMS Auth routes registered: /api/auth/sms/initiate, /api/auth/sms/verify');
}
