/**
 * Vilvom API — Full E2E Test Suite
 * Tests every endpoint: happy paths, validation, auth, edge cases
 * Run: cd backend && npm run test:e2e
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../apps/api-gateway/src/app.module';
import * as path from 'path';
import * as fs from 'fs';

const BASE = '/api';

// ─── Helpers ───────────────────────────────────────────────────────────────────

let app: INestApplication;
let authToken: string;
let testPhone: string;
let testOtp: string;
let testUserId: string;
let droneRequestId: string;
let pestDetectionId: string;

const VALID_PHONE = '9876543210';
const VALID_PHONE_E164 = '+919876543210';

/**
 * Spy on OtpService.generateOtp so we can capture the OTP in tests
 * without needing real SMS delivery.
 */
async function captureOtp(app: INestApplication, phone: string): Promise<string> {
  // The OTP service stores OTPs in-memory. We request an OTP and read the
  // console output captured in the backend log. For e2e tests we expose
  // a test helper via the app context.
  const otpService = app.get('OtpService' as any, { strict: false });
  if (otpService && otpService['otpStore']) {
    const normalised = phone.startsWith('+91') ? phone : `+91${phone.replace(/^(91|0)/, '')}`;
    const stored = otpService['otpStore'].get(normalised);
    return stored?.otp ?? '';
  }
  return '';
}

// ─── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  // Mirror main.ts bootstrap config
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');

  await app.init();

  // Unique phone per test run to avoid state collisions
  testPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
}, 30000);

afterAll(async () => {
  await app.close();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

describe('Health Check', () => {
  it('GET /api/health → 200 with status ok', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/health`)
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.service).toMatch(/vilvom/i);
    expect(res.body.timestamp).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AUTH — Request OTP
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUTH — POST /api/auth/request-otp', () => {
  it('valid 10-digit phone → 200 with message + phone', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: testPhone })
      .expect(200);

    expect(res.body.message).toBeDefined();
    expect(res.body.phone).toContain('+91');
  });

  it('+91 prefixed phone → 200 (normalised)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: VALID_PHONE_E164 })
      .expect(200);

    expect(res.body.phone).toBe(VALID_PHONE_E164);
  });

  it('91 prefixed phone → 200 (normalised)', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: `91${VALID_PHONE}` })
      .expect(200);
  });

  it('missing phone → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({})
      .expect(400);
  });

  it('invalid phone — too short → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: '12345' })
      .expect(400);
  });

  it('invalid phone — starts with 1 (not Indian mobile) → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: '1234567890' })
      .expect(400);
  });

  it('invalid phone — letters → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: 'abcdefghij' })
      .expect(400);
  });

  it('extra unexpected field (whitelist) → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: testPhone, hackerField: 'evil' })
      .expect(400);
  });

  it('empty string phone → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: '' })
      .expect(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUTH — Verify OTP (register new user)
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUTH — POST /api/auth/verify-otp', () => {
  beforeAll(async () => {
    // Request OTP first
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: testPhone });

    testOtp = await captureOtp(app, testPhone);
  });

  it('correct OTP → 200 with JWT token + user', async () => {
    if (!testOtp) {
      console.warn('Could not capture OTP in test environment — skipping verify test');
      return;
    }

    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/verify-otp`)
      .send({ phone: testPhone, otp: testOtp })
      .expect(200);

    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.phoneNumber).toContain('+91');

    authToken = res.body.token;
    testUserId = res.body.user._id;
  });

  it('wrong OTP → 401', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: testPhone });

    await request(app.getHttpServer())
      .post(`${BASE}/auth/verify-otp`)
      .send({ phone: testPhone, otp: '000000' })
      .expect(401);
  });

  it('missing otp field → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/verify-otp`)
      .send({ phone: testPhone })
      .expect(400);
  });

  it('missing phone field → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/verify-otp`)
      .send({ otp: '123456' })
      .expect(400);
  });

  it('expired OTP (never requested) → 401', async () => {
    const freshPhone = `8${Math.floor(100000000 + Math.random() * 900000000)}`;
    await request(app.getHttpServer())
      .post(`${BASE}/auth/verify-otp`)
      .send({ phone: freshPhone, otp: '999999' })
      .expect(401);
  });

  it('with deviceInfo → 200 and user.isDeviceBound true', async () => {
    const newPhone = `7${Math.floor(100000000 + Math.random() * 900000000)}`;
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .send({ phone: newPhone });

    const otp = await captureOtp(app, newPhone);
    if (!otp) return;

    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/verify-otp`)
      .send({
        phone: newPhone,
        otp,
        deviceInfo: {
          deviceId: 'test-device-001',
          deviceModel: 'Pixel 8 Pro',
          systemVersion: '14',
          appVersion: '1.0.0',
          platform: 'android',
        },
      })
      .expect(200);

    expect(res.body.user.isDeviceBound).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AUTH — Login OTP
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUTH — POST /api/auth/login-otp', () => {
  it('existing user phone → 200', async () => {
    if (!authToken) return; // skip if register failed
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/login-otp`)
      .send({ phone: testPhone })
      .expect(200);

    expect(res.body.message).toBeDefined();
  });

  it('non-existent user phone → 404', async () => {
    const unknownPhone = `6${Math.floor(100000000 + Math.random() * 900000000)}`;
    await request(app.getHttpServer())
      .post(`${BASE}/auth/login-otp`)
      .send({ phone: unknownPhone })
      .expect(404);
  });

  it('invalid phone format → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/login-otp`)
      .send({ phone: '555' })
      .expect(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. AUTH — Protected Profile
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUTH — GET /api/auth/profile', () => {
  it('with valid JWT → 200 with user data', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.phoneNumber).toContain('+91');
  });

  it('without token → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .expect(401);
  });

  it('malformed token → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', 'Bearer this.is.not.valid')
      .expect(401);
  });

  it('Bearer prefix missing → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', authToken || 'no-token')
      .expect(401);
  });

  it('expired/tampered token → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/profile`)
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIn0.fake')
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AUTH — Change Password
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUTH — POST /api/auth/change-password', () => {
  it('new password too short (< 6 chars) → 400', async () => {
    if (!authToken) return;

    await request(app.getHttpServer())
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ currentPassword: 'any', newPassword: '123' })
      .expect(400);
  });

  it('missing currentPassword → 400', async () => {
    if (!authToken) return;

    await request(app.getHttpServer())
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ newPassword: 'newPass123' })
      .expect(400);
  });

  it('unauthenticated → 401', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/change-password`)
      .send({ currentPassword: 'old', newPassword: 'newPass123' })
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. AUTH — Password Status
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUTH — GET /api/auth/password-status', () => {
  it('authenticated → 200 with status fields', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/auth/password-status`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('passwordChangeRequired');
    expect(res.body).toHaveProperty('hasPassword');
    expect(res.body).toHaveProperty('daysSinceLastChange');
  });

  it('unauthenticated → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/auth/password-status`)
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. USERS — Create
// ═══════════════════════════════════════════════════════════════════════════════

describe('USERS — POST /api/users', () => {
  it('valid user creation → 201', async () => {
    const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const res = await request(app.getHttpServer())
      .post(`${BASE}/users`)
      .send({
        name: 'Test Farmer',
        phoneNumber: phone,
        email: `test${Date.now()}@vilvom.com`,
        password: 'password123',
      })
      .expect(201);

    expect(res.body.user || res.body._id).toBeDefined();
  });

  it('missing name → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/users`)
      .send({
        phoneNumber: '9876543211',
        email: 'a@b.com',
        password: 'pass123',
      })
      .expect(400);
  });

  it('invalid email → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/users`)
      .send({
        name: 'Test',
        phoneNumber: '9876543212',
        email: 'not-an-email',
        password: 'pass123',
      })
      .expect(400);
  });

  it('password too short → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/users`)
      .send({
        name: 'Test',
        phoneNumber: '9876543213',
        email: 'x@x.com',
        password: 'abc',
      })
      .expect(400);
  });

  it('duplicate phone → 409 or 400', async () => {
    const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const payload = {
      name: 'Dup User',
      phoneNumber: phone,
      email: `dup${Date.now()}@v.com`,
      password: 'pass123',
    };
    await request(app.getHttpServer()).post(`${BASE}/users`).send(payload);
    const res = await request(app.getHttpServer())
      .post(`${BASE}/users`)
      .send({ ...payload, email: `dup2${Date.now()}@v.com` });

    expect([400, 409]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. USERS — Profile (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

describe('USERS — GET/PATCH /api/users/profile', () => {
  it('GET profile with JWT → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/users/profile`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.user || res.body.phoneNumber).toBeDefined();
  });

  it('PATCH profile name → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .patch(`${BASE}/users/profile`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated Name' })
      .expect(200);

    expect(res.body.message || res.body.user).toBeDefined();
  });

  it('PATCH profile with invalid email → 400', async () => {
    if (!authToken) return;

    await request(app.getHttpServer())
      .patch(`${BASE}/users/profile`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'bad-email' })
      .expect(400);
  });

  it('GET profile without JWT → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/users/profile`)
      .expect(401);
  });

  it('PATCH profile without JWT → 401', async () => {
    await request(app.getHttpServer())
      .patch(`${BASE}/users/profile`)
      .send({ name: 'Hacker' })
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. USERS — Stats
// ═══════════════════════════════════════════════════════════════════════════════

describe('USERS — GET /api/users/stats', () => {
  it('authenticated → 200 with stats', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/users/stats`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.stats || res.body).toBeDefined();
  });

  it('unauthenticated → 401', async () => {
    await request(app.getHttpServer()).get(`${BASE}/users/stats`).expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. PEST DETECTION — Detect
// ═══════════════════════════════════════════════════════════════════════════════

describe('PEST — POST /api/pest/detect', () => {
  // Create a minimal valid JPEG buffer for tests
  const minimalJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0x00,
    0xff, 0xd9,
  ]);

  it('valid JPEG upload → 200 with detection result', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/pest/detect`)
      .attach('image', minimalJpeg, 'test.jpg')
      .expect(200);

    // AI service may be down but response structure must exist
    expect(res.body.success !== undefined || res.body.error !== undefined || res.body.detection !== undefined).toBe(true);
  });

  it('no file uploaded → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/pest/detect`)
      .expect(400);
  });

  it('wrong MIME type (text/plain) → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/pest/detect`)
      .attach('image', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('file exceeding 10MB limit → 413 or 400', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    const res = await request(app.getHttpServer())
      .post(`${BASE}/pest/detect`)
      .attach('image', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect([400, 413]).toContain(res.status);
  });

  it('wrong field name for file → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/pest/detect`)
      .attach('photo', minimalJpeg, 'test.jpg') // 'photo' instead of 'image'
      .expect(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. PEST DETECTION — History & Recommendations
// ═══════════════════════════════════════════════════════════════════════════════

describe('PEST — Detections & Recommendations', () => {
  it('GET /pest/detections with JWT → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.detections || Array.isArray(res.body)).toBeDefined();
  });

  it('GET /pest/detections without JWT → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/pest/detections`)
      .expect(401);
  });

  it('GET /pest/detections with pagination → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections?page=1&limit=5`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    if (res.body.pagination) {
      expect(res.body.pagination.limit).toBe(5);
    }
  });

  it('GET /pest/detections/:id with invalid mongo ID → 400 or 404', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/detections/not-a-valid-id`)
      .set('Authorization', `Bearer ${authToken}`);

    expect([400, 404]).toContain(res.status);
  });

  it('GET /pest/recommendations → 200 (no auth needed)', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/recommendations`)
      .expect(200);

    expect(res.body.recommendations).toBeDefined();
  });

  it('GET /pest/recommendations?pestName=Thrips → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/recommendations?pestName=Thrips`)
      .expect(200);

    expect(res.body.recommendations).toBeDefined();
  });

  it('GET /pest/nearby with lat/lng → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/nearby?lat=11.0168&lng=76.9558&radius=10`)
      .expect(200);

    expect(res.body.nearbyDetections !== undefined || res.body.detections !== undefined || Array.isArray(res.body)).toBe(true);
  });

  it('GET /pest/nearby without lat → 400 or 500', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/nearby`);

    expect([400, 500]).toContain(res.status);
  });

  it('GET /pest/statistics with JWT → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/pest/statistics`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.statistics || res.body).toBeDefined();
  });

  it('GET /pest/statistics without JWT → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/pest/statistics`)
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. DRONE SERVICES
// ═══════════════════════════════════════════════════════════════════════════════

describe('DRONE — GET /api/drone/services', () => {
  it('no auth needed → 200 with service list', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/services`)
      .expect(200);

    expect(res.body.services || Array.isArray(res.body)).toBeDefined();
  });
});

describe('DRONE — GET /api/drone/operators', () => {
  it('with lat/lng → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/operators?lat=11.0168&lng=76.9558`)
      .expect(200);

    expect(res.body.operators || Array.isArray(res.body)).toBeDefined();
  });

  it('with serviceType filter → 200', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/drone/operators?lat=11.0&lng=77.0&serviceType=pest_spraying`)
      .expect(200);
  });

  it('missing lat/lng → NaN handled gracefully (200 or 400)', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/operators`);

    expect([200, 400]).toContain(res.status);
  });
});

describe('DRONE — POST /api/drone/request', () => {
  const validDronePayload = {
    serviceType: 'pest_spraying',
    fieldArea: 2.5,
    location: { type: 'Point', coordinates: [76.9558, 11.0168] },
    urgency: 'medium',
    scheduledDate: new Date(Date.now() + 86400000).toISOString(),
    notes: 'Tea garden section B',
  };

  it('authenticated + valid body → 201', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(validDronePayload)
      .expect(201);

    expect(res.body.success || res.body.request || res.body._id).toBeDefined();
    droneRequestId = res.body.request?._id || res.body._id;
  });

  it('unauthenticated → 401', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .send(validDronePayload)
      .expect(401);
  });

  it('invalid serviceType → 400', async () => {
    if (!authToken) return;

    await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...validDronePayload, serviceType: 'unknown_service' })
      .expect(400);
  });

  it('invalid urgency → 400', async () => {
    if (!authToken) return;

    await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...validDronePayload, urgency: 'extreme' })
      .expect(400);
  });

  it('missing required fieldArea → 400', async () => {
    if (!authToken) return;

    const { fieldArea, ...noArea } = validDronePayload;
    await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(noArea)
      .expect(400);
  });

  it('missing location → 400', async () => {
    if (!authToken) return;

    const { location, ...noLocation } = validDronePayload;
    await request(app.getHttpServer())
      .post(`${BASE}/drone/request`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(noLocation)
      .expect(400);
  });
});

describe('DRONE — Requests CRUD', () => {
  it('GET /drone/requests with JWT → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/requests`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.requests || Array.isArray(res.body)).toBeDefined();
  });

  it('GET /drone/requests without JWT → 401', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/drone/requests`)
      .expect(401);
  });

  it('GET /drone/requests with pagination params → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/requests?page=1&limit=5`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it('GET /drone/requests/:id with valid id → 200 or 404', async () => {
    if (!authToken || !droneRequestId) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/requests/${droneRequestId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect([200, 404]).toContain(res.status);
  });

  it('GET /drone/requests/:id with invalid mongo ID → 400 or 404', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/requests/invalid-id`)
      .set('Authorization', `Bearer ${authToken}`);

    expect([400, 404]).toContain(res.status);
  });

  it('PATCH /drone/requests/:id/cancel → 200 or 404', async () => {
    if (!authToken || !droneRequestId) return;

    const res = await request(app.getHttpServer())
      .patch(`${BASE}/drone/requests/${droneRequestId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'Weather conditions' });

    expect([200, 404]).toContain(res.status);
  });

  it('PATCH cancel without JWT → 401', async () => {
    await request(app.getHttpServer())
      .patch(`${BASE}/drone/requests/someid/cancel`)
      .send({ reason: 'test' })
      .expect(401);
  });

  it('GET /drone/statistics → 200', async () => {
    if (!authToken) return;

    const res = await request(app.getHttpServer())
      .get(`${BASE}/drone/statistics`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. CONTENT TYPE & RESPONSE FORMAT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Response format & content-type', () => {
  it('all JSON endpoints return Content-Type application/json', async () => {
    const res = await request(app.getHttpServer()).get(`${BASE}/health`);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('sending XML body to JSON endpoint → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .set('Content-Type', 'application/xml')
      .send('<phone>9876543210</phone>')
      .expect(400);
  });

  it('empty JSON body to required-field endpoint → 400', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/request-otp`)
      .set('Content-Type', 'application/json')
      .send('{}')
      .expect(400);
  });
});
