import {
  IsString,
  IsPhoneNumber,
  IsOptional,
  IsEmail,
  MinLength,
  IsObject,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsString()
  phoneNumber: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsObject()
  @IsOptional()
  deviceInfo?: {
    deviceId: string;
    deviceModel: string;
    systemVersion: string;
    appVersion: string;
    platform: string;
  };
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsObject()
  @IsOptional()
  profileInfo?: {
    fullName?: string;
    dateOfBirth?: Date;
    address?: string;
    occupation?: string;
    bio?: string;
    profileImage?: string;
  };

  @IsString()
  @IsOptional()
  profileImage?: string;

  @IsObject()
  @IsOptional()
  location?: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export class RequestOtpDto {
  @Matches(/^(\+91|91|0)?[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
  phone: string;
}

export class VerifyOtpDto {
  @Matches(/^(\+91|91|0)?[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
  phone: string;

  @IsString()
  otp: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  deviceInfo?: {
    deviceId: string;
    deviceModel: string;
    systemVersion: string;
    appVersion: string;
    platform: string;
  };
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsObject()
  @IsOptional()
  profileInfo?: {
    fullName?: string;
    dateOfBirth?: string;
    address?: string;
    occupation?: string;
    bio?: string;
    profileImage?: string;
  };
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}