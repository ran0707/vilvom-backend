import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@app/database';
import { CreateUserDto, UpdateUserDto } from '@app/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        $or: [
          { email: createUserDto.email },
          { phoneNumber: createUserDto.phoneNumber },
        ],
      });

      if (existingUser) {
        throw new ConflictException(
          'User with this email or phone number already exists',
        );
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

      // Create user
      const user = new this.userModel({
        ...createUserDto,
        password: hashedPassword,
        isEmailVerified: false,
        isPhoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await user.save();

      // Remove password from response
      const userResponse = user.toJSON();
      delete userResponse.password;

      this.logger.log(`User created successfully: ${user.email}`);
      return userResponse as User;
    } catch (error) {
      this.logger.error('Failed to create user', error.stack);
      throw error;
    }
  }

  async findUserById(userId: string): Promise<User> {
    const user = await this.userModel
      .findById(userId)
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.toJSON() as User;
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findUserByPhone(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      // Check if user exists
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // If updating email or phone, check for conflicts
      if (updateUserDto.email || updateUserDto.phoneNumber) {
        const conflictQuery: any = { _id: { $ne: userId } };
        
        if (updateUserDto.email) {
          conflictQuery.email = updateUserDto.email;
        }
        
        if (updateUserDto.phoneNumber) {
          conflictQuery.phoneNumber = updateUserDto.phoneNumber;
        }

        const conflictUser = await this.userModel.findOne(conflictQuery);
        if (conflictUser) {
          throw new ConflictException(
            'Another user with this email or phone number already exists',
          );
        }
      }

      // Hash password if updating
      if (updateUserDto.password) {
        const saltRounds = 10;
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, saltRounds);
      }

      // Update user
      const updatedUser = await this.userModel
        .findByIdAndUpdate(
          userId,
          { ...updateUserDto, updatedAt: new Date() },
          { new: true, runValidators: true },
        )
        .select('-password')
        .exec();

      this.logger.log(`User updated successfully: ${updatedUser.email}`);
      return updatedUser.toJSON() as User;
    } catch (error) {
      this.logger.error('Failed to update user', error.stack);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(userId);
    
    if (!result) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User deleted successfully: ${userId}`);
  }

  async verifyEmail(userId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { isEmailVerified: true, updatedAt: new Date() },
        { new: true, runValidators: true },
      )
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Email verified for user: ${user.email}`);
    return user.toJSON() as User;
  }

  async verifyPhone(userId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { isPhoneVerified: true, updatedAt: new Date() },
        { new: true, runValidators: true },
      )
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Phone verified for user: ${user.phoneNumber}`);
    return user.toJSON() as User;
  }

  async updateProfile(userId: string, profileData: Partial<UpdateUserDto>): Promise<User> {
    // Remove sensitive fields that shouldn't be updated via profile
    const { password, email, phoneNumber, ...safeProfileData } = profileData;

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { ...safeProfileData, updatedAt: new Date() },
        { new: true, runValidators: true },
      )
      .select('-password')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Profile updated for user: ${updatedUser.email}`);
    return updatedUser.toJSON() as User;
  }

  async getUserStats(userId: string) {
    const user = await this.userModel.findById(userId).select('-password').exec();
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // This would be expanded to include actual stats from other services
    const stats = {
      profile: user.toJSON(),
      pestDetections: 0, // From pest service
      droneRequests: 0, // From drone service
      orders: 0, // From order service
      notifications: 0, // From notification service
      joinedDate: user.createdAt,
      lastActive: user.updatedAt,
    };

    return stats;
  }

  async searchUsers(query: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const searchQuery = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phoneNumber: { $regex: query, $options: 'i' } },
      ],
    };

    const [users, total] = await Promise.all([
      this.userModel
        .find(searchQuery)
        .select('-password')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(searchQuery),
    ]);

    return {
      users: users.map(u => u.toJSON()),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }
}