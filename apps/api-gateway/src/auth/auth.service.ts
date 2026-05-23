import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '@app/database';
import { OtpService } from './otp.service';
import { ADMIN_PHONES } from '../admin/admin.config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  async requestOtp(phone: string) {
    // Normalize phone number format
    const normalizedPhone = this.normalizePhoneNumber(phone);
    
    // Generate and send OTP
    const otp = await this.otpService.generateOtp(normalizedPhone);
    await this.otpService.sendOtp(normalizedPhone, otp);

    return {
      message: 'OTP sent successfully',
      phone: normalizedPhone,
      otp, // temporary — remove this line once an SMS provider is integrated
    };
  }

  async verifyOtp(phone: string, otp: string, deviceInfo?: any, name?: string) {
    // Normalize phone number format
    const normalizedPhone = this.normalizePhoneNumber(phone);

    // Verify OTP
    const isValid = await this.otpService.verifyOtp(normalizedPhone, otp);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let user: any;
    try {
      user = await this.userModel.findOne({ phoneNumber: normalizedPhone });
    } catch (err) {
      this.logger.error('MongoDB findOne failed during verifyOtp', err?.message);
      throw new InternalServerErrorException('Database connection error. Please check server configuration.');
    }

    try {
      if (!user) {
        user = new this.userModel({
          phoneNumber: normalizedPhone,
          name: name?.trim() || `User-${normalizedPhone.slice(-4)}`,
          isPhoneVerified: true,
          deviceInfo,
          isDeviceBound: true,
        });
        await user.save();
      } else {
        user.isPhoneVerified = true;
        user.lastLogin = new Date();
        if (name?.trim()) user.name = name.trim();
        if (deviceInfo) {
          user.deviceInfo = deviceInfo;
          user.isDeviceBound = true;
        }
        await user.save();
      }
    } catch (err) {
      this.logger.error('MongoDB save failed during verifyOtp', err?.message);
      throw new InternalServerErrorException('Failed to save user. Check database connection and schema.');
    }

    // Generate JWT token — include role so guards can check it
    const isAdmin = ADMIN_PHONES.includes(normalizedPhone);
    const payload = { sub: user._id, phone: user.phoneNumber, role: isAdmin ? 'admin' : 'user' };
    const token = this.jwtService.sign(payload);

    // Clean OTP after successful verification
    await this.otpService.cleanupOtp(normalizedPhone);

    return {
      message: 'Authentication successful',
      token,
      isAdmin,
      user: user.toJSON(),
    };
  }

  async requestLoginOtp(phone: string) {
    // Normalize phone number format
    const normalizedPhone = this.normalizePhoneNumber(phone);
    
    const user = await this.userModel.findOne({ phoneNumber: normalizedPhone });
    if (!user) {
      throw new NotFoundException('User not found. Please register first.');
    }

    // Generate and send OTP
    const otp = await this.otpService.generateOtp(normalizedPhone);
    await this.otpService.sendOtp(normalizedPhone, otp);

    return {
      message: 'Login OTP sent successfully',
      phone: normalizedPhone,
      otp, // temporary — remove this line once an SMS provider is integrated
    };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user: user.toJSON(),
    };
  }

  async updateProfile(userId: string, updates: { name?: string; email?: string; profileInfo?: any }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (updates.name?.trim()) user.name = updates.name.trim();
    if (updates.email?.trim()) user.email = updates.email.trim();
    if (updates.profileInfo) {
      user.profileInfo = { ...(user.profileInfo || {}), ...updates.profileInfo };
    }

    await user.save();
    return { message: 'Profile updated successfully', user: user.toJSON() };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has a password set
    if (!user.password) {
      // First-time password setting
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      user.lastPasswordChange = new Date();
      await user.save();

      return {
        message: 'Password set successfully',
      };
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.lastPasswordChange = new Date();
    await user.save();

    return {
      message: 'Password changed successfully',
    };
  }

  async getPasswordStatus(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const lastPasswordChange = user.lastPasswordChange || (user as any).createdAt || now;
    const daysSinceLastChange = Math.floor(
      (now.getTime() - lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      passwordChangeRequired: daysSinceLastChange > 90, // 90 days policy
      lastPasswordChange: lastPasswordChange.toISOString(),
      daysSinceLastChange,
      hasPassword: !!user.password,
      deviceBound: user.isDeviceBound,
    };
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Handle different Indian phone number formats
    if (digits.length === 10 && digits.match(/^[6-9]/)) {
      // 10-digit number starting with 6-9 (valid Indian mobile)
      return `+91${digits}`;
    } else if (digits.length === 12 && digits.startsWith('91') && digits.substring(2).match(/^[6-9]/)) {
      // 12-digit number starting with 91 (with country code)
      return `+${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0') && digits.substring(1).match(/^[6-9]/)) {
      // 11-digit number starting with 0 (old format)
      return `+91${digits.substring(1)}`;
    }
    
    // If none of the above formats match, throw an error
    throw new BadRequestException(
      'Phone number must be a valid 10-digit Indian mobile number (e.g., 9876543210, +919876543210, or 919876543210)'
    );
  }
}