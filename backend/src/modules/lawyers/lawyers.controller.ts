import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { wrapSuccess } from '../../shared/http/envelope';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { LawyerListQueryDto } from './dto/lawyer-list-query.dto';
import type { LawyerDetailDto } from './dto/lawyer-response.dto';
import { LawyersService } from './lawyers.service';

@Controller('lawyers')
@UseGuards(JwtAuthGuard)
export class LawyersController {
  constructor(
    private readonly lawyersService: LawyersService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get()
  async list(@Query() query: LawyerListQueryDto) {
    const result = await this.lawyersService.list(query);
    return wrapSuccess(result.items, result.pagination);
  }

  @Get(':id')
  getById(@Param('id') lawyerId: string): Promise<LawyerDetailDto> {
    return this.lawyersService.getById(lawyerId);
  }

  @Get(':id/availability')
  listAvailability(
    @Param('id') lawyerId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availabilityService.listBookableSlots(lawyerId, query);
  }
}
