import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SprayLog, SprayLogDocument } from '@app/database';
import { CreateSprayLogDto, UpdateSprayLogDto, SyncSprayLogsDto } from '@app/common';

@Injectable()
export class SprayLogService {
  constructor(
    @InjectModel(SprayLog.name)
    private readonly sprayLogModel: Model<SprayLogDocument>,
  ) {}

  async create(userId: string, dto: CreateSprayLogDto) {
    const log = new this.sprayLogModel({
      userId: new Types.ObjectId(userId),
      ...dto,
    });
    await log.save();
    return { success: true, log: log.toJSON() };
  }

  async findAll(userId: string, date?: string) {
    const query: any = { userId: new Types.ObjectId(userId) };
    if (date) query.date = date;
    const logs = await this.sprayLogModel.find(query).sort({ date: -1, createdAt: -1 });
    return { logs: logs.map(l => l.toJSON()) };
  }

  async update(userId: string, id: string, dto: UpdateSprayLogDto) {
    const log = await this.sprayLogModel.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId) },
      { ...dto, updatedAt: new Date() },
      { new: true },
    );
    if (!log) throw new NotFoundException('Spray log not found');
    return { success: true, log: log.toJSON() };
  }

  async remove(userId: string, id: string) {
    const log = await this.sprayLogModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!log) throw new NotFoundException('Spray log not found');
    return { success: true };
  }

  // Bulk upsert — called when device comes online to push all local logs
  async sync(userId: string, dto: SyncSprayLogsDto) {
    const uid = new Types.ObjectId(userId);
    const results = await Promise.all(
      dto.logs.map(async log => {
        if (log.localId) {
          return this.sprayLogModel.findOneAndUpdate(
            { userId: uid, localId: log.localId },
            { userId: uid, ...log },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        }
        // No localId — just insert
        const doc = new this.sprayLogModel({ userId: uid, ...log });
        await doc.save();
        return doc;
      }),
    );
    return {
      success: true,
      synced: results.length,
      logs: results.map(l => l.toJSON()),
    };
  }
}
