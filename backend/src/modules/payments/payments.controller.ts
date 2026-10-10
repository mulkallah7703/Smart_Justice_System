import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';

import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import type {
  InitiatedPaymentDto,
  PaymentDto,
  PaymentSummaryDto,
} from './dto/payment-response.dto';
import { PaymentRateLimitGuard } from './guards/payment-rate-limit.guard';
import { paymentVerificationFailed } from './payments.errors';
import { PaymentsService, type WebhookOutcome } from './payments.service';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Provider callback. Deliberately outside JwtAuthGuard: the caller is the
   * gateway, not a citizen, and authenticity comes from signature verification.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookOutcome> {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw paymentVerificationFailed();
    }

    return this.paymentsService.handleWebhook(rawBody, headers);
  }

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, PaymentRateLimitGuard)
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InitiatePaymentDto,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey?: string,
  ): Promise<InitiatedPaymentDto> {
    const key = idempotencyKey?.trim().slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
    return this.paymentsService.initiate(user.sub, body, key || null);
  }

  @Get('summary/:consultationId')
  @UseGuards(JwtAuthGuard)
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('consultationId') consultationId: string,
  ): Promise<PaymentSummaryDto> {
    return this.paymentsService.getSummary(user.sub, consultationId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
  ): Promise<PaymentDto> {
    return this.paymentsService.getById(user.sub, paymentId);
  }
}
