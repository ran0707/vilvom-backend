import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('drone-bookings')
  @ApiOperation({ summary: 'Get all drone bookings with user phone' })
  getDroneBookings(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getDroneBookings(
      page  ? parseInt(page)  : 1,
      limit ? parseInt(limit) : 20,
      status,
    );
  }

  @Patch('drone-bookings/:id/status')
  @ApiOperation({ summary: 'Update drone booking status (admin)' })
  updateBookingStatus(
    @Param('id')     id:     string,
    @Body('status')  status: string,
  ) {
    return this.adminService.updateBookingStatus(id, status);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all registered users' })
  getUsers(
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers(
      page  ? parseInt(page)  : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}
