import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@app/database';
import { PestDetection, PestDetectionDocument } from '@app/database';
import { DroneRequest, DroneRequestDocument } from '@app/database';
import { SprayLog, SprayLogDocument } from '@app/database';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)          private userModel:     Model<UserDocument>,
    @InjectModel(PestDetection.name) private pestModel:     Model<PestDetectionDocument>,
    @InjectModel(DroneRequest.name)  private droneModel:    Model<DroneRequestDocument>,
    @InjectModel(SprayLog.name)      private sprayLogModel: Model<SprayLogDocument>,
  ) {}

  async getDashboardStats() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      totalUsers,
      totalPestScans,
      totalDroneRequests,
      totalSprayLogs,
      pendingDrone,
      completedDrone,
      monthlyUsers,
      droneStatusBreakdown,
      recentUsers,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.pestModel.countDocuments(),
      this.droneModel.countDocuments(),
      this.sprayLogModel.countDocuments(),
      this.droneModel.countDocuments({ status: 'pending' }),
      this.droneModel.countDocuments({ status: 'completed' }),

      // Users registered per month (last 6 months)
      this.userModel.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // Drone requests by status
      this.droneModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // 5 most recent users
      this.userModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name phoneNumber createdAt'),
    ]);

    return {
      totals: {
        users:         totalUsers,
        pestScans:     totalPestScans,
        droneRequests: totalDroneRequests,
        sprayLogs:     totalSprayLogs,
        pendingDrone,
        completedDrone,
      },
      monthlyUsers: monthlyUsers.map(m => ({
        label: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        count: m.count,
      })),
      droneStatusBreakdown: droneStatusBreakdown.map(d => ({
        status: d._id ?? 'unknown',
        count:  d.count,
      })),
      recentUsers: recentUsers.map(u => ({
        name:        u.name,
        phone:       u.phoneNumber,
        joinedAt:    u.createdAt,
      })),
    };
  }

  async getDroneBookings(page = 1, limit = 20, status?: string) {
    page  = Math.max(1, page);
    limit = Math.min(50, Math.max(1, limit));

    const matchStage: any = {};
    if (status) matchStage.status = status;

    const [requests, total] = await Promise.all([
      this.droneModel.aggregate([
        { $match: matchStage },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          // Cast userId to ObjectId explicitly so the join works whether
          // userId was stored as string or ObjectId.
          // $ifNull guards against null userId (e.g. guest bookings).
          $lookup: {
            from: 'users',
            let:  { uid: { $cond: [ '$userId', { $toObjectId: '$userId' }, null ] } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
              { $project: { phoneNumber: 1, name: 1 } },
            ],
            as: 'userInfo',
          },
        },
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            serviceType:     1,
            preferredDate:   1,
            preferredTime:   1,
            area:            1,
            status:          1,
            urgency:         1,
            additionalNotes: 1,
            createdAt:       1,
            phone:    { $ifNull: ['$userInfo.phoneNumber', '$guestPhone', 'N/A'] },
            userName: { $ifNull: ['$userInfo.name',        '$guestName',  'Unknown'] },
          },
        },
      ]),
      this.droneModel.countDocuments(matchStage),
    ]);

    return {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getAllUsers(page = 1, limit = 20) {
    page  = Math.max(1, page);
    limit = Math.min(50, Math.max(1, limit));

    const [users, total] = await Promise.all([
      this.userModel
        .find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('name phoneNumber email isPhoneVerified createdAt lastLogin'),
      this.userModel.countDocuments(),
    ]);

    return {
      users: users.map(u => u.toJSON()),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async updateBookingStatus(id: string, status: string) {
    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid status. Allowed: ${allowed.join(', ')}`);
    }
    const booking = await this.droneModel.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true },
    );
    if (!booking) throw new NotFoundException('Booking not found');
    return { message: `Booking marked as ${status}`, status };
  }
}
