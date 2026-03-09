/**
 * Cognito DefineAuthChallenge Lambda Trigger
 * Determines the next step in the Custom Auth flow.
 * Flow: SRP_A → CUSTOM_CHALLENGE (OTP) → authenticated
 */
exports.handler = async (event) => {
  const session = event.request.session;

  if (session.length === 0) {
    // First call — issue a custom challenge (OTP)
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  } else if (
    session.length === 1 &&
    session[0].challengeName === 'CUSTOM_CHALLENGE' &&
    session[0].challengeResult === true
  ) {
    // OTP verified successfully — issue tokens
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    // Wrong answer or too many attempts — fail
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  return event;
};
