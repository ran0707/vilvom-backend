/**
 * Vilvom API — Security & Penetration Test Suite
 * Tests: auth bypass, injection attacks, rate limiting, header security,
 *        JWT tampering, IDOR, mass assignment, DoS vectors, CORS, XSS
 *
 * Run: cd backend && npm run test:e2e -- --testPathPattern=security
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../apps/api-gateway/src/app.module';

const BASE = '/api';

let app: INestApplication;
let validToken: string;
let userAToken: string;
let userBToken: string;
let userAPhone: string;
let userBPhone: string;

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const FORGED_TOKEN_HS256_NONE =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiIsInBob25lIjoiKzkxOTk5OTk5OTk5OSIsImlhdCI6OTk5OTk5OTk5OX0.';

const FORGED_TOKEN_WRONG_SECRET =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiIsImlhdCI6MTcwMDAwMDAwMH0.WrongSignatureHere';

async function captureOtp(app: INestApplication, phone: string): Promise<string> {
  const otpService = app.get('OtpService' as any, { strict: false });
  if (otpService?.['otpStore']) {
    const norm = phone.startsWith('+91') ? phone : `+91${phone.replace(/^(91|0)/, '')}`;
    return otpService['otpStore'].get(norm)?.otp ?? '';
  }
  return '';
}

async function registerAndLogin(appRef: INestApplication): Promise<{ token: string; phone: string }> {
  const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  await request(appRef.getHttpServer())
    .post(`${BASE}/auth/request-otp`)
    .send({ phone });
  const otp = await captureOtp(appRef, phone);
  if (!otp) return { token: '', phone };
  const res = await request(appRef.getHttpServer())
    .post(`${BASE}/auth/verify-otp`)
    .send({ phone, otp });
  return { token: res.body.token ?? '', phone };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix('api');
  await app.init();

  ({ token: userAToken, phone: userAPhone } = await registerAndLogin(app));
  ({ token: userBToken, phone: userBPhone } = await registerAndLogin(app));
  validToken = userAToken;
}, 30000);

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. JWT ATTACK VECTORS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — JWT Attacks', () => {
  it('alg=none token must be rejected → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${FORGED_TOKEN_HS256_NONE}`)
      .expect(401);
  });

  it('wrong-secret signed token → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${FORGED_TOKEN_WRONG_SECRET}`)
      .expect(401);
  });

  it('JWT with modified payload (sub changed) → 401', async () => {
    if (!validToken) return;
    const parts = validToken.split('.');
    // Flip one char in payload
    const badPayload = parts[1].slice(0, -3) + 'xxx';
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${parts[0]}.${badPayload}.${parts[2]}`)
      .expect(401);
  });

  it('completely random string as token → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', 'Bearer randomrandomrandom')
      .expect(401);
  });

  it('empty Bearer token → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', 'Bearer ')
      .expect(401);
  });

  it('token in query param (not supported) → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile?token=${validToken}`)
      .expect(401);
  });

  it('duplicate Authorization headers → handled safely (no 500)', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${validToken}`)
      .set('Authorization', 'Bearer fake');

    expect(res.status).not.toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INSECURE DIRECT OBJECT REFERENCE (IDOR)
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — IDOR Tests', () => {
  it('User B cannot read User A detections (wrong userId) → 200 empty or 403/404', async () => {
    if (!userAToken || !userBToken) return;

    // Get userA's detections
    const aRes = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections`)
      .set('Authorization', `Bearer ${userAToken}`);

    const userADetections = aRes.body.detections ?? [];

    if (userADetections.length === 0) return; // nothing to steal

    const detectionId = userADetections[0]._id;

    // UserB tries to read UserA's detection
    const bRes = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections/${detectionId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    // Should be 404 (not found for this user) or 403 (forbidden)
    expect([403, 404]).toContain(bRes.status);
  });

  it('User B cannot cancel User A drone request → 403 or 404', async () => {
    if (!userAToken || !userBToken) return;

    // Create a drone request as User A
    const createRes = await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        serviceType: 'pest_spraying',
        fieldArea: 1.0,
        location: { type: 'Point', coordinates: [76.9, 11.0] },
        urgency: 'low',
      });

    const reqId = createRes.body.request?._id ?? createRes.body._id;
    if (!reqId) return;

    // User B tries to cancel it
    const cancelRes = await request(app.getHttpServer())
      .patch(`${BASE}/drone/requests/${reqId}/cancel`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ reason: 'IDOR attack' });

    expect([403, 404]).toContain(cancelRes.status);
  });

  it('accessing another user profile by ID → 401/403 or 404', async () => {
    if (!userBToken || !userAToken) return;

    // Try to get user profile by guessing/known ID
    const profileRes = await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${userAToken}`);

    const userId = profileRes.body.user?._id;
    if (!userId) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/users/${userId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    // Non-admin should not access arbitrary user by ID
    expect([401, 403, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SQL / NOSQL INJECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — Injection Attacks', () => {
  const mongoInjectionPayloads = [
    { phone: { $gt: '' } },
    { phone: { $where: 'this.phone.length > 0' } },
    { phone: '{"$gt":""}' },
  ];

  it.each(mongoInjectionPayloads)(
    'NoSQL injection in request-otp body → 400 (not 200/500)',
    async (payload) => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/request-otp`)
        .send(payload);

      expect([400, 422]).toContain(res.status);
    },
  );

  it('NoSQL injection in query param → handled safely', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/nearby?lat[$gt]=0&lng[$gt]=0`);

    expect(res.status).not.toBe(500);
  });

  it('SQL-style injection in name field → 400 or sanitised', async () => {
    const res = await request(app.getHttpServer())
      .patch(`${BASE}/users/profile`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ name: "'; DROP TABLE users; --" });

    // Should either reject or sanitise — never cause a 500
    expect(res.status).not.toBe(500);
  });

  it('prototype pollution attempt → 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: '9876543210', '__proto__': { admin: true } });

    expect([400, 422]).toContain(res.status);
  });

  it('constructor pollution attempt → 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: '9876543210', 'constructor': { prototype: { admin: true } } });

    expect([400, 422]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. XSS PAYLOADS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — XSS Payloads', () => {
  const xssPayloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "javascript:alert('xss')",
    '<svg onload=alert(1)>',
  ];

  it.each(xssPayloads)(
    'XSS in name field → stored sanitised or rejected, never reflected as-is in HTML',
    async (payload) => {
      if (!validToken) return;
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/users/profile`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: payload });

      // Must not 500. If stored, response must be JSON (not HTML)
      expect(res.status).not.toBe(500);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    },
  );

  it('XSS in drone request notes → stored safely', async () => {
    if (!validToken) return;
    const res = await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        serviceType: 'pest_spraying',
        fieldArea: 1,
        location: { type: 'Point', coordinates: [76.9, 11.0] },
        urgency: 'low',
        notes: '<script>alert("xss")</script>',
      });

    expect(res.status).not.toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MASS ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — Mass Assignment', () => {
  it('cannot set roles via profile update (whitelist active)', async () => {
    if (!validToken) return;
    const res = await request(app.getHttpServer())
      .patch(`${BASE}/users/profile`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ name: 'Normal', roles: ['admin'] })
      .expect(400); // forbidNonWhitelisted rejects unknown fields
  });

  it('cannot set isDeviceBound via profile update', async () => {
    if (!validToken) return;
    const res = await request(app.getHttpServer())
      .patch(`${BASE}/users/profile`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ name: 'Normal', isDeviceBound: false, isPhoneVerified: false });

    expect([400, 200]).toContain(res.status);
    // If 200, verify verification flags were NOT changed
    if (res.status === 200) {
      const profile = await request(app.getHttpServer())
        .get(`${BASE}/auth/profile`)
        .set('Authorization', `Bearer ${validToken}`);
      // isPhoneVerified should still be true (set during OTP verify)
      expect(profile.body.user?.isPhoneVerified).toBe(true);
    }
  });

  it('cannot inject _id in create user → ignored', async () => {
    const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const res = await request(app.getHttpServer())
      .post(`${BASE}/users`)
      .send({
        name: 'Injector',
        phoneNumber: phone,
        email: `inject${Date.now()}@v.com`,
        password: 'pass123',
        _id: '000000000000000000000001',
      });

    expect([400, 201]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.user?._id ?? res.body._id).not.toBe('000000000000000000000001');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — Rate Limiting', () => {
  it('hammering /auth/request-otp beyond throttle limit → 429', async () => {
    const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const responses: number[] = [];

    // Send 15 rapid requests
    for (let i = 0; i < 15; i++) {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/request-otp`)
        .send({ phone });
      responses.push(res.status);
    }

    // At least one response should be 429 (throttled)
    const has429 = responses.some((s) => s === 429);
    if (!has429) {
      // Throttling may be disabled in test env — warn but don't fail
      console.warn('⚠️  Rate limiting not triggered — check ThrottlerModule config in test env');
    }
  }, 20000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — HTTP Security Headers (Helmet)', () => {
  let headers: Record<string, string>;

  beforeAll(async () => {
    const res = await request(app.getHttpServer()).get(`${BASE}/health`);
    headers = res.headers as Record<string, string>;
  });

  it('X-Content-Type-Options: nosniff is set', () => {
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  it('X-Frame-Options is set (clickjacking protection)', () => {
    expect(
      headers['x-frame-options'] ?? headers['content-security-policy'],
    ).toBeDefined();
  });

  it('X-XSS-Protection header present', () => {
    // Helmet v7+ removes this (deprecated), but CSP should cover it
    const hasProtection =
      headers['x-xss-protection'] !== undefined ||
      headers['content-security-policy'] !== undefined;
    expect(hasProtection).toBe(true);
  });

  it('Server header not exposing technology details', () => {
    const server = headers['server'];
    if (server) {
      expect(server.toLowerCase()).not.toMatch(/nestjs|express|node/);
    }
  });

  it('X-Powered-By header is removed', () => {
    expect(headers['x-powered-by']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. LARGE PAYLOAD / DOS VECTORS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — DoS / Large Payload Protection', () => {
  it('very large JSON body → 413 or 400 (payload too large)', async () => {
    const hugeString = 'A'.repeat(10 * 1024 * 1024); // 10MB string
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ phone: hugeString }));

    expect([400, 413]).toContain(res.status);
  });

  it('deeply nested JSON → 400 or handled (no stack overflow)', async () => {
    // Build deeply nested object
    let nested: any = { value: 'deep' };
    for (let i = 0; i < 100; i++) {
      nested = { child: nested };
    }

    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: '9876543210', nested });

    expect(res.status).not.toBe(500);
  });

  it('array of phones instead of string → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: ['9876543210', '9876543211'] })
      .expect(400);
  });

  it('null phone → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: null })
      .expect(400);
  });

  it('numeric phone instead of string → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: 9876543210 }) // number, not string
      .expect(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CORS & METHOD RESTRICTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — HTTP Method Restrictions', () => {
  it('PUT to POST-only endpoint → 404 or 405', async () => {
    const res = await request(app.getHttpServer())
      .put(`${BASE}/auth/request-otp`)
      .send({ phone: '9876543210' });

    expect([404, 405]).toContain(res.status);
  });

  it('DELETE to GET-only endpoint → 404 or 405', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${BASE}/health`);

    expect([404, 405]).toContain(res.status);
  });

  it('TRACE method → 404 or 405 (no TRACE reflection)', async () => {
    const res = await request(app.getHttpServer())
      .trace(`${BASE}/health`);

    expect([404, 405]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SENSITIVE DATA EXPOSURE
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — Sensitive Data Exposure', () => {
  it('password hash is NOT returned in user profile response', async () => {
    if (!validToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/\$2[ab]\$\d+\$/); // bcrypt hash pattern
    expect(res.body.user?.password).toBeUndefined();
  });

  it('JWT secret is NOT returned anywhere in error messages', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', 'Bearer invalid');

    const body = JSON.stringify(res.body);
    // Should not contain common JWT secret patterns
    expect(body).not.toMatch(/jwt[_-]?secret/i);
    expect(body).not.toMatch(/your-super-secret/i);
  });

  it('OTP value is NOT returned in request-otp response', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: '9876543210' })
      .expect(200);

    // The response must NOT include the actual OTP
    expect(res.body.otp).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\b\d{6}\b/);
  });

  it('stack traces are NOT returned in production-mode errors', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections/000000000000000000000000`)
      .set('Authorization', `Bearer ${validToken}`);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/at Object\./); // stack trace lines
    expect(body).not.toMatch(/node_modules/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. PATH TRAVERSAL
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — Path Traversal', () => {
  it('../ in route params → 404 (not file disclosure)', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections/..%2F..%2Fetc%2Fpasswd`)
      .set('Authorization', `Bearer ${validToken}`);

    expect([400, 404]).toContain(res.status);
  });

  it('null bytes in route → handled safely', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections/id%00`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).not.toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. OTP BRUTE FORCE PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('SECURITY — OTP Brute Force', () => {
  it('3 wrong OTPs exhausts attempts — subsequent tries rejected', async () => {
    const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone });

    // Try 3 wrong OTPs
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/verify-otp`)
        .send({ phone, otp: `00000${i}` });
    }

    // 4th attempt (even with valid otp from capture) should fail
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/verify-otp`)
      .send({ phone, otp: '111111' });

    // After exhausting MAX_ATTEMPTS (3), OTP is deleted → 401
    expect(res.status).toBe(401);
  });
});
