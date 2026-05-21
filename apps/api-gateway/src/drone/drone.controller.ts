import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DroneService } from './drone.service';
import { CreateDroneRequestDto } from '@app/common';

@ApiTags('Drone Services')
@Controller('drone')
export class DroneController {
  constructor(private readonly droneService: DroneService) {}

  @Get('services')
  @ApiOperation({ summary: 'Get available drone services' })
  async getAvailableServices() {
    return this.droneService.getAvailableServices();
  }

  @Get('operators')
  @ApiOperation({ summary: 'Find nearby drone operators' })
  async getNearbyOperators(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('serviceType') serviceType?: string,
  ) {
    return this.droneService.getNearbyOperators(
      parseFloat(lat),
      parseFloat(lng),
      serviceType,
    );
  }

  @Post('request')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new drone service request' })
  async createRequest(
    @GetUser('userId') userId: string,
    @Body() createDroneRequestDto: CreateDroneRequestDto,
  ) {
    return this.droneService.createDroneRequest(userId, createDroneRequestDto);
  }

  @Get('requests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user drone service requests' })
  async getUserRequests(
    @GetUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.droneService.getUserRequests(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('requests/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get drone request details by ID' })
  async getRequestById(
    @Param('id') requestId: string,
    @GetUser('userId') userId: string,
  ) {
    return this.droneService.getRequestById(requestId, userId);
  }

  @Patch('requests/:id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a drone service request' })
  async cancelRequest(
    @Param('id') requestId: string,
    @GetUser('userId') userId: string,
    @Body('reason') reason?: string,
  ) {
    return this.droneService.cancelRequest(requestId, userId, reason);
  }

  @Patch('requests/:id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update request status (operator/admin only)' })
  async updateRequestStatus(
    @Param('id') requestId: string,
    @Body('status') status: string,
    @Body('notes') notes?: string,
  ) {
    return this.droneService.updateRequestStatus(requestId, status, notes);
  }

  @Get('statistics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user drone service statistics' })
  async getUserStatistics(@GetUser('userId') userId: string) {
    return this.droneService.getRequestStatistics(userId);
  }
}