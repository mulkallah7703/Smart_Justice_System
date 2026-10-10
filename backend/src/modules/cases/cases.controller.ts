import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { wrapSuccess } from '../../shared/http/envelope';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CasesService } from './cases.service';
import { CaseListQueryDto } from './dto/case-list-query.dto';
import type { CaseDetailDto } from './dto/case-response.dto';

@Controller('cases')
@UseGuards(JwtAuthGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CaseListQueryDto,
  ) {
    const result = await this.casesService.list(user.sub, query);
    return wrapSuccess(result.items, result.pagination);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') caseId: string,
  ): Promise<CaseDetailDto> {
    return this.casesService.getById(user.sub, caseId);
  }
}
