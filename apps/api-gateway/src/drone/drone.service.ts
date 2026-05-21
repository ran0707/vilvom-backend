import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DroneRequest, DroneRequestDocument } from '@app/database';
import { CreateDroneRequestDto } from '@app/common';

@Injectable()
export class DroneService {
  private readonly logger = new Logger(DroneService.name);

  constructor(
    @InjectModel(DroneRequest.name)
    private droneRequestModel: Model<DroneRequestDocument>,
  ) {}

  // Unified consistent service types
  static readonly validServices = [
    'pesticide_spraying',
    'fertilizer_application',
    'field_monitoring',
    'crop_mapping',
    'soil_analysis',
  ];

  async createDroneRequest(
    userId: string,
    createDroneRequestDto: CreateDroneRequestDto,
  ) {
    try {
      const droneRequest = new this.droneRequestModel({
        userId,
        ...createDroneRequestDto,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await droneRequest.save();

      this.logger.log(`Drone request created: ${droneRequest._id}`);
      // TODO: Add notification triggers, pricing, availability, messaging

      return {
        success: true,
        request: droneRequest.toJSON(),
        message: 'Drone service request submitted successfully',
        estimatedResponse: '2-4 hours',
      };
    } catch (error) {
      this.logger.error('Failed to create drone request', error?.stack || error);
      throw error;
    }
  }

  async getUserRequests(userId: string, page = 1, limit = 10) {
    page = Math.max(1, page);
    limit = Math.max(1, limit);

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      this.droneRequestModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.droneRequestModel.countDocuments({ userId }),
    ]);
    return {
      requests: requests.map((r) => r.toJSON()),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getRequestById(requestId: string, userId: string) {
    const request = await this.droneRequestModel.findOne({
      _id: requestId,
      userId,
    });
    if (!request) {
      throw new NotFoundException('Drone request not found');
    }
    return {
      request: request.toJSON(),
    };
  }

  async updateRequestStatus(requestId: string, status: string, notes?: string) {
    const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const request = await this.droneRequestModel.findByIdAndUpdate(
      requestId,
      {
        status,
        ...(notes ? { notes } : {}),
        updatedAt: new Date(),
      },
      { new: true, runValidators: true },
    );
    if (!request) {
      throw new NotFoundException('Drone request not found');
    }
    this.logger.log(`Drone request ${requestId} status updated to: ${status}`);
    return {
      success: true,
      request: request.toJSON(),
      message: `Request status updated to ${status}`,
    };
  }

  async cancelRequest(requestId: string, userId: string, reason?: string) {
    const request = await this.droneRequestModel.findOne({
      _id: requestId,
      userId,
    });
    if (!request) {
      throw new NotFoundException('Drone request not found');
    }
    if (['completed', 'cancelled'].includes(request.status)) {
      throw new BadRequestException(
        `Cannot cancel request with status: ${request.status}`,
      );
    }
    request.status = 'cancelled';
    request.notes = reason || 'Cancelled by user';
    request.updatedAt = new Date();
    await request.save();

    this.logger.log(`Drone request cancelled: ${requestId}`);
    return {
      success: true,
      request: request.toJSON(),
      message: 'Request cancelled successfully',
    };
  }

  async getAvailableServices() {
    // Service types consistent with validation
    return {
      services: [
        {
          type: 'pesticide_spraying',
          name: 'Pest Control Spraying',
          description: 'Precision pesticide application using drones',
          estimatedCost: 'Rs. 500-800 per acre',
          duration: '30-60 minutes per acre',
          equipment: ['Spray drone', 'GPS guidance', 'Professional pesticides'],
        },
        {
          type: 'fertilizer_application',
          name: 'Fertilizer Application',
          description: 'Accurate fertilizer distribution across tea gardens',
          estimatedCost: 'Rs. 400-600 per acre',
          duration: '20-45 minutes per acre',
          equipment: ['Spreader drone', 'Granular applicator', 'GPS mapping'],
        },
        {
          type: 'field_monitoring',
          name: 'Field Monitoring & Analysis',
          description: 'Aerial monitoring for crop health and pest detection',
          estimatedCost: 'Rs. 300-500 per acre',
          duration: '15-30 minutes per acre',
          equipment: ['Camera drone', 'Multispectral imaging', 'Analysis software'],
        },
        {
          type: 'crop_mapping',
          name: 'Crop Mapping & Survey',
          description: 'Detailed field mapping and boundary survey',
          estimatedCost: 'Rs. 200-400 per acre',
          duration: '20-40 minutes per acre',
          equipment: ['Survey drone', 'High-res camera', 'GPS mapping'],
        },
        {
          type: 'soil_analysis',
          name: 'Soil Health Analysis',
          description: 'Comprehensive soil condition assessment',
          estimatedCost: 'Rs. 600-1000 per acre',
          duration: '45-90 minutes per acre',
          equipment: ['Sensor drone', 'Soil probes', 'Lab analysis'],
        },
      ],
    };
  }

  async getNearbyOperators(lat: number, lng: number, serviceType?: string) {
    // TODO: Replace mock with DB geo query
    const mockOperators = [
      {
        id: 'op_001',
        name: 'TeaDrone Services',
        rating: 4.8,
        experience: '5+ years',
        services: ['pesticide_spraying', 'fertilizer_application', 'field_monitoring'],
        location: {
          type: 'Point',
          coordinates: [lng + 0.01, lat + 0.01],
        },
        availability: 'Available today',
        contact: '+91 98765 43210',
        priceRange: 'Rs. 400-800/acre',
      },
      {
        id: 'op_002',
        name: 'AgroAir Solutions',
        rating: 4.6,
        experience: '3+ years',
        services: ['crop_mapping', 'soil_analysis', 'field_monitoring'],
        location: {
          type: 'Point',
          coordinates: [lng - 0.02, lat - 0.01],
        },
        availability: 'Available tomorrow',
        contact: '+91 87654 32109',
        priceRange: 'Rs. 300-700/acre',
      },
      {
        id: 'op_003',
        name: 'Precision Farm Drones',
        rating: 4.9,
        experience: '7+ years',
        services: [
          'pesticide_spraying',
          'fertilizer_application',
          'crop_mapping',
          'soil_analysis',
        ],
        location: {
          type: 'Point',
          coordinates: [lng + 0.005, lat - 0.015],
        },
        availability: 'Available in 2 days',
        contact: '+91 76543 21098',
        priceRange: 'Rs. 500-1000/acre',
      },
    ];

    let filteredOperators = mockOperators;
    if (serviceType) {
      filteredOperators = mockOperators.filter(op =>
        op.services.includes(serviceType),
      );
    }

    return {
      operators: filteredOperators,
      searchArea: { lat, lng, radius: 50 },
    };
  }

  async getRequestStatistics(userId: string) {
    const [totalRequests, pendingRequests, completedRequests, statusCounts] = await Promise.all([
      this.droneRequestModel.countDocuments({ userId }),
      this.droneRequestModel.countDocuments({ userId, status: 'pending' }),
      this.droneRequestModel.countDocuments({ userId, status: 'completed' }),
      this.droneRequestModel.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const serviceCounts = await this.droneRequestModel.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      statistics: {
        totalRequests,
        pendingRequests,
        completedRequests,
        statusBreakdown: statusCounts,
        serviceBreakdown: serviceCounts,
        totalCostSaved: totalRequests * 300, // Mock calculation
        averageResponseTime: '3.5 hours', // Mock data
        lastRequest: await this.droneRequestModel
          .findOne({ userId })
          .sort({ createdAt: -1 })
          .select('createdAt serviceType')
          .exec(),
      },
    };
  }
}
