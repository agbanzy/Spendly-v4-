/**
 * Cognito VerifyAuthChallengeResponse Lambda Trigger
 * Compares the user's OTP answer against the generated OTP.
 */
exports.handler = async (event) => {
  const expectedOtp = event.request.privateChallengeParameters.otp;
  const userAnswer = (event.request.challengeAnswer || '').trim();

  event.response.answerCorrect = userAnswer === expectedOtp;

  return event;
};
