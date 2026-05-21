import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { SprayLogService } from './spray-log.service';
import { CreateSprayLogDto, UpdateSprayLogDto, SyncSprayLogsDto } from '@app/common';

@ApiTags('Spray Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('spray-log')
export class SprayLogController {
  constructor(private readonly sprayLogService: SprayLogService) {}

  @Post()
  @ApiOperation({ summary: 'Create a spray log entry' })
  create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateSprayLogDto,
  ) {
    return this.sprayLogService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all spray logs, optionally filtered by date' })
  findAll(
    @GetUser('userId') userId: string,
    @Query('date') date?: string,
  ) {
    return this.sprayLogService.findAll(userId, date);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a spray log' })
  update(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSprayLogDto,
  ) {
    return this.sprayLogService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a spray log' })
  remove(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.sprayLogService.remove(userId, id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Bulk sync all local spray logs to the server' })
  sync(
    @GetUser('userId') userId: string,
    @Body() dto: SyncSprayLogsDto,
  ) {
    return this.sprayLogService.sync(userId, dto);
  }
}
