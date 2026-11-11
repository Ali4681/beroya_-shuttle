import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { calendarDateKey } from '../../common/utils/timezone';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { parseServiceDate } from '../trips/trip.rules';
import { CreateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(institutionId: string, from?: string, to?: string) {
    const rows = await this.prisma.institutionHoliday.findMany({
      where: {
        institutionId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: parseServiceDate(from) } : {}),
                ...(to ? { lte: parseServiceDate(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      date: calendarDateKey(row.date),
      name: row.name,
    }));
  }

  async create(institutionId: string, dto: CreateHolidayDto) {
    const date = parseServiceDate(dto.date);
    try {
      const row = await this.prisma.institutionHoliday.create({
        data: {
          institutionId,
          date,
          name: dto.name?.trim() || null,
        },
      });
      return {
        id: row.id,
        date: calendarDateKey(row.date),
        name: row.name,
      };
    } catch {
      throw new AppException(
        'VALIDATION_ERROR',
        'Holiday already exists for this date',
        HttpStatus.CONFLICT,
      );
    }
  }

  async remove(institutionId: string, id: string) {
    const row = await this.prisma.institutionHoliday.findFirst({
      where: { id, institutionId },
    });
    if (!row) {
      throw new AppException(
        'NOT_FOUND',
        'Holiday not found',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.institutionHoliday.delete({ where: { id } });
    return { id };
  }
}
