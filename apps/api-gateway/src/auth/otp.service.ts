import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OtpStorage {
  otp: string;
  expiresAt: Date;
  attempts: number;
}

@Injectable()
export class OtpService {
  private otpStore = new Map<string, OtpStorage>();
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_ATTEMPTS = 3;

  constructor(private configService: ConfigService) {}

  async generateOtp(phone: string): Promise<string> {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Store OTP in memory (in production, use Redis)
    this.otpStore.set(phone, {
      otp,
      expiresAt,
      attempts: 0,
    });

    return otp;
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    // Always log OTP — replace this block with a real SMS provider when ready
    console.log(`\n📱 OTP for ${phone}: ${otp}\n`);
  }

  async verifyOtp(phone: string, inputOtp: string): Promise<boolean> {
    const stored = this.otpStore.get(phone);
    if (!stored) {
      return false;
    }

    // Check expiry
    if (new Date() > stored.expiresAt) {
      this.otpStore.delete(phone);
      return false;
    }

    // Check attempts
    if (stored.attempts >= this.MAX_ATTEMPTS) {
      this.otpStore.delete(phone);
      return false;
    }

    // Verify OTP
    if (stored.otp !== inputOtp) {
      stored.attempts++;
      return false;
    }

    return true;
  }

  async cleanupOtp(phone: string): Promise<void> {
    this.otpStore.delete(phone);
  }

  // Cleanup expired OTPs periodically
  private cleanupExpiredOtps() {
    const now = new Date();
    for (const [phone, stored] of this.otpStore.entries()) {
      if (now > stored.expiresAt) {
        this.otpStore.delete(phone);
      }
    }
  }
}