import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { wrapSuccess } from '../../shared/http/envelope';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CasesService } from './cases.service';
import { CaseListQueryDto } from './dto/case-list-query.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import type { CaseDetailDto } from './dto/case-response.dto';
import { CaseCreateRateLimitGuard } from './guards/case-create-rate-limit.guard';

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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CaseCreateRateLimitGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCaseDto,
  ): Promise<CaseDetailDto> {
    return this.casesService.create(user.sub, body);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') caseId: string,
  ): Promise<CaseDetailDto> {
    return this.casesService.getById(user.sub, caseId);
  }
}
