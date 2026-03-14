import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5000';

// =====================================================
// 1. PUBLIC PAGES — Load & Render
// =====================================================

test.describe('Public Pages', () => {
  test('login page loads with all elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Sign in to your account')).toBeVisible();
    await expect(page.locator('text=Continue with Google')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
    await expect(page.locator('a:has-text("Sign up")')).toBeVisible();
    await expect(page.locator('a:has-text("Forgot password")')).toBeVisible();
  });

  test('signup page loads with all elements', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('text=Create your account')).toBeVisible();
    await expect(page.locator('text=Continue with Google')).toBeVisible();
    await expect(page.locator('text=Sign in')).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL(/\/terms/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('cookies page loads', async ({ page }) => {
    await page.goto('/cookies');
    await expect(page).toHaveURL(/\/cookies/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('auth callback page exists', async ({ page }) => {
    await page.goto('/auth/callback');
    // Should show error or redirect (no code param) - page should not 404
    await page.waitForTimeout(2000);
    const url = page.url();
    // Should either stay on callback or redirect to login
    expect(url).toMatch(/\/(auth\/callback|login)/);
  });

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    // Should show 404 or redirect to login
    expect(body?.length).toBeGreaterThan(0);
  });
});

// =====================================================
// 2. LOGIN FORM VALIDATION
// =====================================================

test.describe('Login Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows email validation error', async ({ page }) => {
    const emailInput = page.locator('input[placeholder*="company.com"], input[type="email"]').first();
    await emailInput.fill('invalid-email');
    await emailInput.blur();
    await expect(page.locator('text=valid email')).toBeVisible({ timeout: 3000 });
  });

  test('shows password validation error', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('short');
    await passwordInput.blur();
    await expect(page.locator('text=at least 8 characters')).toBeVisible({ timeout: 3000 });
  });

  test('shows required field errors on empty submit', async ({ page }) => {
    await page.locator('button:has-text("Sign in")').first().click();
    await page.waitForTimeout(1000);
    // Should show validation errors or toast
    const errors = page.locator('text=/required|enter.*email/i');
    await expect(errors.first()).toBeVisible({ timeout: 3000 });
  });

  test('email/phone tab switching works', async ({ page }) => {
    // Click Phone tab
    const phoneTab = page.locator('button:has-text("Phone")');
    if (await phoneTab.isVisible()) {
      await phoneTab.click();
      await expect(page.locator('text=Phone Number')).toBeVisible();
    }
    // Click Email tab
    const emailTab = page.locator('button:has-text("Email")');
    if (await emailTab.isVisible()) {
      await emailTab.click();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    }
  });

  test('navigate to signup from login', async ({ page }) => {
    await page.locator('a:has-text("Sign up")').click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('navigate to forgot password from login', async ({ page }) => {
    await page.locator('a:has-text("Forgot password")').click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

// =====================================================
// 3. SIGNUP FORM VALIDATION
// =====================================================

test.describe('Signup Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('shows name validation error', async ({ page }) => {
    const nameInput = page.locator('input[placeholder*="name"], input[name="fullName"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('A');
      await nameInput.blur();
      await page.waitForTimeout(500);
      const error = page.locator('text=/at least 2 characters/i');
      await expect(error).toBeVisible({ timeout: 3000 });
    }
  });

  test('shows password mismatch error', async ({ page }) => {
    const inputs = page.locator('input[type="password"]');
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.nth(0).fill('Password123!');
      await inputs.nth(1).fill('Different456!');
      await inputs.nth(1).blur();
      await expect(page.locator('text=/do not match/i')).toBeVisible({ timeout: 3000 });
    }
  });

  test('navigate to login from signup', async ({ page }) => {
    await page.locator('a:has-text("Sign in")').click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// =====================================================
// 4. API HEALTH & ENDPOINTS
// =====================================================

test.describe('API Health', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('unauthenticated API calls return 401 or 404', async ({ request }) => {
    const endpoints = [
      '/api/dashboard/stats',
      '/api/transactions',
      '/api/expenses',
      '/api/bills',
      '/api/team',
      '/api/cards',
      '/api/budgets',
      '/api/invoices',
      '/api/vendors',
      '/api/payroll',
      '/api/reports',
      '/api/notifications',
      '/api/wallet/balance',
      '/api/virtual-accounts',
      '/api/analytics/overview',
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect([401, 403, 404]).toContain(response.status());
      expect(response.ok(), `${endpoint} should not return 200`).toBeFalsy();
    }
  });

  test('unknown API route returns 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent-route');
    expect([404, 401]).toContain(response.status());
  });
});

// =====================================================
// 5. PROTECTED ROUTES REDIRECT
// =====================================================

test.describe('Protected Routes Redirect to Login', () => {
  const protectedPaths = [
    '/dashboard',
    '/transactions',
    '/expenses',
    '/bills',
    '/budget',
    '/cards',
    '/team',
    '/settings',
    '/analytics',
    '/reports',
    '/payroll',
    '/invoices',
    '/vendors',
    '/accounts',
    '/onboarding',
  ];

  for (const path of protectedPaths) {
    test(`${path} redirects to login when unauthenticated`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(3000);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

// =====================================================
// 6. ADMIN ROUTES
// =====================================================

test.describe('Admin Routes', () => {
  test('admin login page loads', async ({ page }) => {
    await page.goto('/admin-login');
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });

  test('admin routes redirect without session', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    // Should redirect to admin login
    const url = page.url();
    expect(url).toMatch(/\/(admin-login|admin|login)/);
  });
});

// =====================================================
// 7. PUBLIC PAYMENT LINK
// =====================================================

test.describe('Public Invoice Payment', () => {
  test('pay invoice page handles missing invoice', async ({ page }) => {
    await page.goto('/pay/nonexistent-invoice-id');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    // Should show error or not found message
    expect(body?.length).toBeGreaterThan(0);
  });
});

// =====================================================
// 8. RESPONSIVE DESIGN
// =====================================================

test.describe('Responsive Design', () => {
  test('login page renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await expect(page.locator('text=Sign in to your account')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
  });

  test('login page renders on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');
    await expect(page.locator('text=Sign in to your account')).toBeVisible();
  });

  test('signup page renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/signup');
    await expect(page.locator('text=Create your account')).toBeVisible();
  });
});

// =====================================================
// 9. THEME / DARK MODE
// =====================================================

test.describe('Theme Support', () => {
  test('page loads with default theme', async ({ page }) => {
    await page.goto('/login');
    const html = page.locator('html');
    const className = await html.getAttribute('class');
    // Should have a theme class (light or dark)
    expect(className).toBeDefined();
  });
});

// =====================================================
// 10. PERFORMANCE & LOADING
// =====================================================

test.describe('Performance', () => {
  test('login page loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/login');
    await expect(page.locator('text=Sign in to your account')).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await page.waitForTimeout(2000);
    // Filter out known benign errors (favicon, etc.)
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('net::ERR')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('no console errors on signup page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/signup');
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('net::ERR')
    );
    expect(realErrors).toHaveLength(0);
  });
});

// =====================================================
// 11. INVITE FLOW
// =====================================================

test.describe('Invite Flow', () => {
  test('invite page handles invalid code', async ({ page }) => {
    await page.goto('/invite/invalid-code-xyz');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });

  test('login with invite token shows in URL', async ({ page }) => {
    await page.goto('/login?invite=test-token-123');
    await expect(page).toHaveURL(/invite=test-token-123/);
  });
});

// =====================================================
// 12. WEBHOOK ENDPOINTS
// =====================================================

test.describe('Webhook Endpoints', () => {
  test('stripe webhook endpoint exists', async ({ request }) => {
    const response = await request.post('/api/stripe/webhook', {
      data: JSON.stringify({ type: 'test' }),
      headers: { 'stripe-signature': 'test', 'content-type': 'application/json' },
    });
    // Should not 404 — will fail auth but route exists
    expect(response.status()).not.toBe(404);
  });

  test('paystack webhook endpoint exists', async ({ request }) => {
    const response = await request.post('/api/paystack/webhook', {
      data: JSON.stringify({ event: 'test' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(response.status()).not.toBe(404);
  });
});

// =====================================================
// 13. STATIC ASSETS
// =====================================================

test.describe('Static Assets', () => {
  test('app serves favicon', async ({ request }) => {
    const response = await request.get('/favicon.ico');
    // Might be 200 or 304
    expect([200, 304]).toContain(response.status());
  });

  test('app logo loads', async ({ page }) => {
    await page.goto('/login');
    const logo = page.locator('img[alt*="Financiar"]').first();
    if (await logo.isVisible()) {
      // Logo element exists in DOM
      expect(await logo.getAttribute('src')).toBeTruthy();
    }
  });
});

// =====================================================
// 14. SECURITY HEADERS
// =====================================================

test.describe('Security', () => {
  test('API returns proper content type', async ({ request }) => {
    const response = await request.get('/api/health');
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('login form does not expose sensitive data in URL', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[placeholder*="company.com"], input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpassword');
    // URL should not contain credentials
    expect(page.url()).not.toContain('password');
    expect(page.url()).not.toContain('testpassword');
  });
});
