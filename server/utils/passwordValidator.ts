/**
 * Password strength validation utilities
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number; // 0-100
}

// Common weak passwords to reject
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon', 'baseball',
  'iloveyou', 'master', 'sunshine', 'ashley', 'bailey', 'passw0rd',
  'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael',
  'football', 'welcome', 'jesus', 'ninja', 'mustang', 'password1'
]);

/**
 * Validates password strength according to security best practices
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 20;

    // Bonus for longer passwords
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 15;
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 15;
  }

  // Check for numbers
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 15;
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
  } else {
    score += 15;
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common and easy to guess');
    score = Math.max(0, score - 30);
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters (e.g., "aaa", "111")');
    score = Math.max(0, score - 10);
  }

  // Check for sequential characters
  if (hasSequentialChars(password)) {
    errors.push('Password should not contain sequential characters (e.g., "abc", "123")');
    score = Math.max(0, score - 10);
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (score < 40) {
    strength = 'weak';
  } else if (score < 60) {
    strength = 'medium';
  } else if (score < 80) {
    strength = 'strong';
  } else {
    strength = 'very-strong';
  }

  // Add bonus score for character variety
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) {
    score = Math.min(100, score + 10);
  }

  return {
    valid: errors.length === 0 && score >= 40,
    errors,
    strength,
    score: Math.min(100, Math.max(0, score))
  };
}

/**
 * Checks if password contains sequential characters
 */
function hasSequentialChars(password: string): boolean {
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    '0123456789',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm'
  ];

  const lowerPass = password.toLowerCase();

  for (const sequence of sequences) {
    for (let i = 0; i <= sequence.length - 3; i++) {
      const substr = sequence.substring(i, i + 3);
      const reverseSubstr = substr.split('').reverse().join('');

      if (lowerPass.includes(substr) || lowerPass.includes(reverseSubstr)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Generates a human-readable feedback message based on validation result
 */
export function getPasswordFeedback(result: PasswordValidationResult): string {
  if (result.valid) {
    const strengthMessages = {
      'medium': 'Your password is acceptable, but could be stronger.',
      'strong': 'Your password is strong!',
      'very-strong': 'Excellent! Your password is very strong.'
    };
    return strengthMessages[result.strength as keyof typeof strengthMessages] || 'Password accepted.';
  }

  return result.errors.join(' ');
}

/**
 * Checks if password has been exposed in known data breaches
 * Note: In production, integrate with Have I Been Pwned API
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 */
export async function checkPasswordBreach(password: string): Promise<boolean> {
  // TODO: Implement Have I Been Pwned API integration
  // For now, just check against our common passwords list
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
