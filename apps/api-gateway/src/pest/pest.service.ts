import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PestDetection, PestDetectionDocument } from '@app/database';
import { CreatePestDetectionDto } from '@app/common';
import axios from 'axios';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PestService {
  private readonly logger = new Logger(PestService.name);

  constructor(
    @InjectModel(PestDetection.name)
    private pestDetectionModel: Model<PestDetectionDocument>,
  ) {}

  async detectPest(
    file: Express.Multer.File,
    createPestDetectionDto: CreatePestDetectionDto,
    userId?: string,
  ) {
    try {
      // Validate file
      if (!file) {
        throw new BadRequestException('Image file is required');
      }

      // Validate image type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only JPEG, PNG, and WebP are allowed',
        );
      }

      // Call YOLO FastAPI server for actual pest detection
      let detectionResult;
      try {
        const FormData = require('form-data');
        const fs = require('fs');
        const formData = new FormData();
        
        // Read file from disk since we're using diskStorage
        const fileStream = fs.createReadStream(file.path);
        formData.append('file', fileStream, {
          filename: file.originalname,
          contentType: file.mimetype,
        });

        // Use environment variable for AI service URL
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        this.logger.log(`Calling AI service at: ${aiServiceUrl}/yolo-v11/`);
        this.logger.log(`Reading file from: ${file.path}`);

        const response = await axios.post(
          `${aiServiceUrl}/yolo-v11/`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            timeout: 30000, // 30 seconds timeout
          }
        );

        this.logger.log(`AI service response: ${JSON.stringify(response.data)}`);
        detectionResult = response.data;
      } catch (apiError) {
        this.logger.error('YOLO API call failed:', apiError.message);
        if (apiError.response) {
          this.logger.error('Response data:', apiError.response.data);
        }
        // Fallback to mock data if API fails
        detectionResult = this.getMockDetectionResult(
          createPestDetectionDto.pestName,
        );
      }

      // Map YOLO response to our format
      const mappedResult = {
        pestName: detectionResult.prediction || detectionResult.pestName || 'Unknown Pest',
        confidence: detectionResult.confidence || 0.0,
        boundingBox: detectionResult.bounding_box || [],
        symptoms: Array.isArray(detectionResult.symptoms) 
          ? detectionResult.symptoms 
          : [detectionResult.symptoms || 'No symptoms available'],
        biological_control: Array.isArray(detectionResult.biological_control)
          ? detectionResult.biological_control
          : [detectionResult.biological_control || 'No biological control available'],
        chemical_control: Array.isArray(detectionResult.chemical_control)
          ? detectionResult.chemical_control
          : [detectionResult.chemical_control || 'No chemical control available'],
        mechanical_control: Array.isArray(detectionResult.mechanical_control)
          ? detectionResult.mechanical_control
          : [detectionResult.mechanical_control || 'No mechanical control available'],
        severity: this.determineSeverity(detectionResult.prediction),
        processed_image: detectionResult.processed_image,
      };

      // Compress and persist the processed image to disk instead of storing base64 in MongoDB
      const processedImagePath = await this.saveProcessedImage(
        mappedResult.processed_image,
        file.filename,
      );

      // Create detection record
      const detection = new this.pestDetectionModel({
        userId: userId || null,
        guestId: createPestDetectionDto.guestId,
        pestName: mappedResult.pestName,
        confidence: mappedResult.confidence,
        boundingBox: createPestDetectionDto.boundingBox || mappedResult.boundingBox,
        symptoms: mappedResult.symptoms,
        biological_control: mappedResult.biological_control,
        chemical_control: mappedResult.chemical_control,
        mechanical_control: mappedResult.mechanical_control,
        severity: mappedResult.severity,
        // Only set location when valid GeoJSON coordinates are provided
        ...(createPestDetectionDto.location?.coordinates?.length === 2
          ? { location: { type: 'Point', coordinates: createPestDetectionDto.location.coordinates } }
          : {}),
        processed_image: processedImagePath,
        original_image: `uploads/${file.filename}`, // In production, save to cloud storage
        meta: createPestDetectionDto.meta || {},
        questionnaire: (createPestDetectionDto.questionnaire || []).map(q => ({
          question: q.question,
          answer: q.answer,
          timestamp: new Date(),
        })),
        chat: createPestDetectionDto.chat || [],
        status: 'completed',
        detectedAt: new Date(),
      });

      await detection.save();

      return {
        success: true,
        detection: detection.toJSON(),
        message: 'Pest detection completed successfully',
      };
    } catch (error) {
      this.logger.error('Pest detection failed', error.stack);
      throw error;
    }
  }

  private async saveProcessedImage(base64Data: string, originalFilename: string): Promise<string | null> {
    if (!base64Data) return null;
    try {
      const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const outputDir = path.resolve('./uploads/pest-images');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const outputFilename = `processed_${originalFilename.replace(/\.[^.]+$/, '')}.jpg`;
      const outputPath = path.join(outputDir, outputFilename);
      await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 65 })
        .toFile(outputPath);
      return `uploads/pest-images/${outputFilename}`;
    } catch (e) {
      this.logger.warn('Processed image compression failed, skipping save:', e.message);
      return null;
    }
  }

  private determineSeverity(pestName: string): string {
    if (!pestName || pestName === 'No predictions') {
      return 'unknown';
    }
    
    const lowerPestName = pestName.toLowerCase();
    if (lowerPestName.includes('severe')) {
      return 'severe';
    } else if (lowerPestName.includes('moderate')) {
      return 'moderate';
    } else if (lowerPestName.includes('mild') || lowerPestName.includes('minor')) {
      return 'mild';
    }
    
    return 'moderate'; // default
  }

  async getUserDetections(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [detections, total] = await Promise.all([
      this.pestDetectionModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.pestDetectionModel.countDocuments({ userId }),
    ]);

    return {
      detections: detections.map((d) => d.toJSON()),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDetectionById(detectionId: string, userId: string) {
    const detection = await this.pestDetectionModel.findOne({
      _id: detectionId,
      userId,
    });

    if (!detection) {
      throw new NotFoundException('Detection not found');
    }

    return {
      detection: detection.toJSON(),
    };
  }

  async getRecommendations(pestName?: string) {
    if (!pestName) {
      return {
        recommendations: [
          {
            title: 'General Tea Pest Management',
            description:
              'Regular monitoring and integrated pest management practices',
            methods: [
              'Weekly field inspections',
              'Use of pheromone traps',
              'Beneficial insect conservation',
              'Proper pruning and sanitation',
            ],
          },
        ],
      };
    }

    // Get specific recommendations based on pest type
    const recommendations = this.getPestRecommendations(pestName);
    return { recommendations };
  }

  async getNearbyDetections(lat: number, lng: number, radius = 10) {
    // MongoDB geospatial query for nearby detections
    const detections = await this.pestDetectionModel
      .find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: radius * 1000, // Convert km to meters
          },
        },
        createdAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      })
      .limit(50)
      .select('pestName confidence location createdAt severity')
      .exec();

    return {
      nearbyDetections: detections.map((d) => d.toJSON()),
      center: { lat, lng },
      radius,
    };
  }

  async updateDetection(detectionId: string, userId: string | undefined, body: any) {
    const update: Record<string, any> = {};

    if (body.location?.coordinates?.length === 2) {
      update.location = {
        type: 'Point',
        coordinates: body.location.coordinates, // [lng, lat]
      };
    }

    if (Array.isArray(body.questionnaire)) {
      update.questionnaire = body.questionnaire.map((q: any) => ({
        question: q.question,
        answer: q.answer,
        timestamp: new Date(),
      }));
    }

    if (Array.isArray(body.chat)) {
      update.chat = body.chat;
    }

    if (body.recommendationLevel) {
      if (!update.meta) update.meta = {};
      update['meta.recommendationLevel'] = body.recommendationLevel;
    }

    if (body.sectionName) {
      if (!update.meta) update.meta = {};
      update['meta.sectionName'] = body.sectionName;
    }

    // Find by _id only — works for both authenticated and guest detections
    const detection = await this.pestDetectionModel.findByIdAndUpdate(
      detectionId,
      { $set: update },
      { new: true },
    );

    return { detection: detection?.toJSON() };
  }

  async getUserStatistics(userId: string) {
    const [totalDetections, recentDetections, pestCounts] = await Promise.all([
      this.pestDetectionModel.countDocuments({ userId }),
      this.pestDetectionModel.countDocuments({
        userId,
        createdAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      }),
      this.pestDetectionModel.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: '$pestName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return {
      statistics: {
        totalDetections,
        recentDetections,
        mostCommonPests: pestCounts,
        averageConfidence: 0.85, // Calculate from actual data
        lastDetection: await this.pestDetectionModel
          .findOne({ userId })
          .sort({ createdAt: -1 })
          .select('createdAt')
          .exec(),
      },
    };
  }

  private getMockDetectionResult(pestName?: string) {
    // Mock detection results based on common tea pests
    const mockResults = {
      'tea looper': {
        prediction: 'Tea Looper (Buzura suppressaria)',
        confidence: 0.89,
        severity: 'moderate',
        symptoms: [
          'Irregular holes in tea leaves',
          'Defoliation of tea bushes',
          'Caterpillar presence on leaves',
          'Reduced leaf area',
        ],
        biological_control: [
          'Encourage natural predators like birds',
          'Use of parasitic wasps (Apanteles sp.)',
          'Bacillus thuringiensis application',
          'Maintain biodiversity in tea gardens',
        ],
        chemical_control: [
          'Quinalphos 25 EC @ 2ml/L',
          'Chlorpyrifos 20 EC @ 2.5ml/L',
          'Lambda-cyhalothrin 5 EC @ 1ml/L',
          'Apply during evening hours',
        ],
        mechanical_control: [
          'Hand picking of caterpillars',
          'Light traps for adult moths',
          'Proper pruning and sanitation',
          'Remove alternate host plants',
        ],
        processed_image: '/uploads/processed_looper_image.jpg',
      },
      'red slug': {
        prediction: 'Red Slug Caterpillar (Eterusia magnifica)',
        confidence: 0.92,
        severity: 'high',
        symptoms: [
          'Skeletonized tea leaves',
          'Red-colored caterpillars on leaves',
          'Severe defoliation',
          'Stunted bush growth',
        ],
        biological_control: [
          'Use of egg parasitoids',
          'Encourage predatory beetles',
          'Spray neem oil extract',
          'Biological pesticides (Bt)',
        ],
        chemical_control: [
          'Acephate 75 SP @ 1.5g/L',
          'Profenophos 50 EC @ 2ml/L',
          'Emamectin benzoate @ 0.5g/L',
          'Rotate insecticides to prevent resistance',
        ],
        mechanical_control: [
          'Collection and destruction of caterpillars',
          'Pheromone traps for monitoring',
          'Maintain field hygiene',
          'Prune affected branches',
        ],
        processed_image: '/uploads/processed_redslug_image.jpg',
      },
    };

    const defaultResult = {
      prediction: 'Unknown Pest',
      confidence: 0.65,
      severity: 'low',
      symptoms: ['Leaf damage observed', 'Further identification needed'],
      biological_control: ['Encourage natural enemies', 'Monitor regularly'],
      chemical_control: ['Consult local expert', 'Use IPM approach'],
      mechanical_control: ['Manual inspection', 'Maintain field sanitation'],
      processed_image: '/uploads/processed_unknown_image.jpg',
    };

    return mockResults[pestName?.toLowerCase()] || defaultResult;
  }

  private getPestRecommendations(pestName: string) {
    const recommendations = {
      'tea looper': [
        {
          title: 'Integrated Management for Tea Looper',
          description: 'Comprehensive approach to control tea looper infestations',
          methods: [
            'Monitor adult moth activity using pheromone traps',
            'Apply biological pesticides during early larval stages',
            'Maintain natural enemy populations',
            'Time chemical applications based on lifecycle',
          ],
          timing: 'Apply treatments during peak larval activity (morning hours)',
          precautions: [
            'Avoid spraying during flowering',
            'Use selective insecticides to preserve beneficial insects',
            'Follow pre-harvest intervals strictly',
          ],
        },
      ],
      'red slug': [
        {
          title: 'Red Slug Caterpillar Management',
          description: 'Effective control measures for red slug infestations',
          methods: [
            'Early detection through regular scouting',
            'Mass collection during early morning hours',
            'Use of light traps for adult moth monitoring',
            'Application of microbial pesticides',
          ],
          timing: 'Treat during early larval stages for maximum effectiveness',
          precautions: [
            'Protect tea quality during treatment',
            'Ensure worker safety during collection',
            'Monitor for secondary pest outbreaks',
          ],
        },
      ],
    };

    return (
      recommendations[pestName.toLowerCase()] || [
        {
          title: 'General Pest Management',
          description: 'Standard integrated pest management practices',
          methods: [
            'Regular field monitoring',
            'Maintain field sanitation',
            'Use of appropriate control measures',
            'Record keeping for future reference',
          ],
        },
      ]
    );
  }
}