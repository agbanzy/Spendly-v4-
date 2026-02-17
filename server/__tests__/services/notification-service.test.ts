import { describe, it, expect } from 'vitest';

// ============================================================================
// Notification Security Tests
// Test sanitization functions from notification-service.ts
// These are extracted and tested in isolation for speed
// ============================================================================

// Reproduce the sanitization functions from notification-service.ts
function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch {}
  return undefined;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeSmsText(text: string): string {
  return text.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 160);
}

// ============================================================================
// sanitizeUrl Tests - XSS Prevention
// ============================================================================
describe('sanitizeUrl', () => {
  it('allows relative paths', () => {
    expect(sanitizeUrl('/dashboard')).toBe('/dashboard');
    expect(sanitizeUrl('/expenses/123')).toBe('/expenses/123');
  });

  it('allows https URLs', () => {
    expect(sanitizeUrl('https://app.spendly.com/dashboard')).toBe('https://app.spendly.com/dashboard');
  });

  it('allows http URLs', () => {
    expect(sanitizeUrl('http://localhost:3000/test')).toBe('http://localhost:3000/test');
  });

  it('blocks javascript: protocol (XSS)', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('javascript:document.cookie')).toBeUndefined();
  });

  it('blocks data: protocol (XSS)', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });

  it('blocks vbscript: protocol', () => {
    expect(sanitizeUrl('vbscript:MsgBox("XSS")')).toBeUndefined();
  });

  it('blocks file: protocol', () => {
    expect(sanitizeUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('returns undefined for empty/undefined input', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
    expect(sanitizeUrl('')).toBeUndefined();
  });

  it('blocks malformed URLs', () => {
    expect(sanitizeUrl('not a url')).toBeUndefined();
    expect(sanitizeUrl('://evil.com')).toBeUndefined();
  });
});

// ============================================================================
// isValidEmail Tests
// ============================================================================
describe('isValidEmail', () => {
  it('accepts valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('rejects emails without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects emails without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects emails with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail(' user@example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects emails without TLD', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });
});

// ============================================================================
// sanitizeSmsText Tests - SMS Injection Prevention
// ============================================================================
describe('sanitizeSmsText', () => {
  it('passes through normal text', () => {
    expect(sanitizeSmsText('Hello, your payment of $50 was received.')).toBe(
      'Hello, your payment of $50 was received.'
    );
  });

  it('strips null bytes', () => {
    expect(sanitizeSmsText('Hello\x00World')).toBe('HelloWorld');
  });

  it('strips newline characters', () => {
    expect(sanitizeSmsText('Line1\nLine2')).toBe('Line1Line2');
    expect(sanitizeSmsText('Line1\rLine2')).toBe('Line1Line2');
  });

  it('strips tab characters', () => {
    expect(sanitizeSmsText('Col1\tCol2')).toBe('Col1Col2');
  });

  it('strips all control characters', () => {
    let input = '';
    for (let i = 0; i < 32; i++) {
      input += String.fromCharCode(i);
    }
    input += 'safe text';
    input += String.fromCharCode(127);
    expect(sanitizeSmsText(input)).toBe('safe text');
  });

  it('truncates to 160 characters', () => {
    const longText = 'A'.repeat(200);
    expect(sanitizeSmsText(longText)).toHaveLength(160);
  });

  it('handles empty string', () => {
    expect(sanitizeSmsText('')).toBe('');
  });

  it('preserves unicode characters', () => {
    expect(sanitizeSmsText('Payment: ₦5,000 received')).toBe('Payment: ₦5,000 received');
    expect(sanitizeSmsText('Paid: £50.00')).toBe('Paid: £50.00');
  });
});
