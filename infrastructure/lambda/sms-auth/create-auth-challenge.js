/**
 * Cognito CreateAuthChallenge Lambda Trigger
 * Generates a 6-digit OTP and sends it via SMS (SNS).
 */
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  const phoneNumber = event.request.userAttributes.phone_number;

  if (!phoneNumber) {
    throw new Error('User does not have a phone number');
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  // Send OTP via SMS
  try {
    await sns.send(new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: `Your Financiar login code is: ${otp}. It expires in 5 minutes. Do not share this code.`,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    }));
  } catch (err) {
    console.error('Failed to send SMS:', err);
    throw new Error('Failed to send verification code');
  }

  // Store OTP in privateChallengeParameters (not visible to client)
  event.response.privateChallengeParameters = { otp };
  // publicChallengeParameters is visible to client — only send phone hint
  event.response.publicChallengeParameters = {
    phoneHint: phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, '$1****$2'),
  };
  event.response.challengeMetadata = `OTP-${otp}`;

  return event;
};
