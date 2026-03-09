/**
 * Cognito Pre Sign-up Lambda Trigger
 * Auto-confirms users and auto-verifies their email address.
 * This allows users to sign in immediately after registration.
 */
exports.handler = async (event) => {
  // Auto-confirm the user
  event.response.autoConfirmUser = true;

  // Auto-verify email if present
  if (event.request.userAttributes.email) {
    event.response.autoVerifyEmail = true;
  }

  // Auto-verify phone if present
  if (event.request.userAttributes.phone_number) {
    event.response.autoVerifyPhone = true;
  }

  return event;
};
