import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConsultationStatus,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';

import type {
  InitiatedPaymentDto,
  PaymentDto,
  PaymentSummaryDto,
} from './dto/payment-response.dto';
import type { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { mapPayment, toMoney } from './mappers/payment.mapper';
import { minorToDecimal } from './money';
import { canTransition } from './payment-state';
import {
  paymentAlreadyExists,
  paymentAmountMismatch,
  paymentIdempotencyConflict,
  paymentInvalidState,
  paymentNotFound,
  paymentProviderError,
  paymentVerificationFailed,
} from './payments.errors';
import { PricingService } from './pricing.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderWebhookEvent,
} from './providers/payment-provider.interface';

const UNIQUE_VIOLATION = 'P2002';

const PAYMENT_SELECT = {
  id: true,
  status: true,
  method: true,
  purpose: true,
  consultationId: true,
  amount: true,
  originalAmount: true,
  discountPct: true,
  currency: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

export interface WebhookOutcome {
  status: PaymentStatus;
  duplicate: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async getSummary(
    userId: string,
    consultationId: string,
  ): Promise<PaymentSummaryDto> {
    const quote = await this.pricing.quoteConsultation(userId, consultationId);

    return {
      consultationId: quote.consultationId,
      lawyerName: quote.lawyerName,
      consultationType: quote.consultationType,
      scheduledAt: quote.scheduledAt.toISOString(),
      original: toMoney(quote.originalMinor, quote.currency),
      discountPct: quote.discountPct,
      discount: toMoney(quote.discountMinor, quote.currency),
      payable: toMoney(quote.payableMinor, quote.currency),
    };
  }

  async getById(userId: string, paymentId: string): Promise<PaymentDto> {
    const record = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: PAYMENT_SELECT,
    });

    if (!record) {
      throw paymentNotFound();
    }

    return mapPayment(record);
  }

  /**
   * Creates a local payment intent and registers it with the provider.
   *
   * The payable amount is derived server-side. The local row is written first so
   * a partial unique index can reject a second live intent for the same
   * consultation, and only then is the provider called; the provider reference
   * is stored on the existing row rather than creating a second one.
   */
  async initiate(
    userId: string,
    dto: InitiatePaymentDto,
    idempotencyKey: string | null,
  ): Promise<InitiatedPaymentDto> {
    const quote = await this.pricing.quoteConsultation(userId, dto.consultationId);
    const requestHash = this.hashRequest(dto, quote.payableMinor, quote.currency);

    if (idempotencyKey) {
      const replay = await this.findIdempotentReplay(
        userId,
        idempotencyKey,
        requestHash,
      );
      if (replay) {
        return replay;
      }
    }

    const payment = await this.createLocalPayment(
      userId,
      dto,
      quote,
      idempotencyKey,
      requestHash,
    );

    let provided;
    try {
      provided = await this.provider.createPayment({
        paymentId: payment.id,
        amountMinor: quote.payableMinor,
        currency: quote.currency,
        method: dto.method,
        idempotencyKey: idempotencyKey ?? payment.id,
      });
    } catch {
      // Release the consultation so the citizen can retry, and never surface the
      // provider's own error body.
      await this.markProviderCreateFailed(payment.id);
      this.logger.error(
        `payment provider create failed paymentId=${payment.id} provider=${this.provider.name}`,
      );
      throw paymentProviderError();
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        transactionId: provided.transactionId,
        gatewayRef: provided.checkoutRef,
      },
      select: PAYMENT_SELECT,
    });

    this.logger.log(
      `payment initiated id=${updated.id} consultationId=${dto.consultationId} status=${updated.status}`,
    );

    return { ...mapPayment(updated), checkoutRef: provided.checkoutRef };
  }

  /**
   * Applies a verified provider event.
   *
   * The event row is inserted inside the transaction before any state change, so
   * a replayed or concurrent duplicate delivery is stopped by a unique
   * constraint and produces no second transition and no second audit entry.
   */
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookOutcome> {
    const event = this.provider.verifyAndParseWebhook(rawBody, headers);
    const target =
      event.type === 'payment.succeeded'
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const payment = await this.lockPayment(tx, event.paymentId);
        this.assertEventMatchesPayment(event, payment);

        await tx.paymentWebhookEvent.create({
          data: {
            eventId: event.eventId,
            eventType: event.type,
            paymentId: payment.id,
          },
        });

        if (payment.status === target) {
          return { status: payment.status, duplicate: true };
        }
        if (!canTransition(payment.status, target)) {
          throw paymentInvalidState();
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: target },
        });

        if (
          target === PaymentStatus.COMPLETED &&
          payment.purpose === PaymentPurpose.CONSULTATION &&
          payment.consultationId
        ) {
          await this.confirmConsultation(tx, payment.consultationId);
        }

        await tx.auditLog.create({
          data: {
            actorType: 'SYSTEM',
            action:
              target === PaymentStatus.COMPLETED
                ? 'PAYMENT_SUCCEEDED'
                : 'PAYMENT_FAILED',
            resourceType: 'Payment',
            resourceId: payment.id,
            metadata: {
              consultationId: payment.consultationId,
              providerEventId: event.eventId,
              from: payment.status,
              to: target,
            },
          },
        });

        return { status: target, duplicate: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        // Concurrent delivery of the same provider event.
        const current = await this.prisma.payment.findUnique({
          where: { id: event.paymentId },
          select: { status: true },
        });
        return {
          status: current?.status ?? PaymentStatus.PENDING,
          duplicate: true,
        };
      }
      throw error;
    }
  }

  private hashRequest(
    dto: InitiatePaymentDto,
    payableMinor: number,
    currency: string,
  ): string {
    return createHash('sha256')
      .update(
        [dto.consultationId, dto.method, String(payableMinor), currency].join('|'),
      )
      .digest('hex');
  }

  private async findIdempotentReplay(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<InitiatedPaymentDto | null> {
    const existing = await this.prisma.payment.findUnique({
      where: {
        payment_user_idempotency_key: { userId, idempotencyKey },
      },
      select: { ...PAYMENT_SELECT, requestHash: true, gatewayRef: true },
    });

    if (!existing) {
      return null;
    }
    if (existing.requestHash !== requestHash) {
      throw paymentIdempotencyConflict();
    }

    return {
      ...mapPayment(existing),
      checkoutRef: existing.gatewayRef ?? '',
    };
  }

  private async createLocalPayment(
    userId: string,
    dto: InitiatePaymentDto,
    quote: { originalMinor: number; discountPct: number; payableMinor: number; currency: string },
    idempotencyKey: string | null,
    requestHash: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            userId,
            consultationId: dto.consultationId,
            purpose: PaymentPurpose.CONSULTATION,
            method: dto.method,
            status: PaymentStatus.PENDING,
            originalAmount: minorToDecimal(quote.originalMinor),
            amount: minorToDecimal(quote.payableMinor),
            discountPct: quote.discountPct,
            currency: quote.currency,
            idempotencyKey,
            requestHash,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: 'USER',
            actorUserId: userId,
            action: 'PAYMENT_CREATED',
            resourceType: 'Payment',
            resourceId: created.id,
            metadata: {
              consultationId: dto.consultationId,
              method: dto.method,
              amountMinor: quote.payableMinor,
              currency: quote.currency,
              status: PaymentStatus.PENDING,
            },
          },
        });

        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        const fields = (error.meta?.target ?? []) as string[];
        if (fields.includes('idempotencyKey')) {
          throw paymentIdempotencyConflict();
        }
        throw paymentAlreadyExists();
      }
      throw error;
    }
  }

  private async markProviderCreateFailed(paymentId: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED },
    });
  }

  /** Serializes concurrent webhook deliveries for the same payment. */
  private async lockPayment(tx: Prisma.TransactionClient, paymentId: string) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw paymentNotFound();
    }

    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        purpose: true,
        consultationId: true,
        transactionId: true,
        currency: true,
        amount: true,
      },
    });

    if (!payment) {
      throw paymentNotFound();
    }
    return payment;
  }

  private assertEventMatchesPayment(
    event: ProviderWebhookEvent,
    payment: {
      transactionId: string | null;
      currency: string;
      amount: Prisma.Decimal;
    },
  ): void {
    if (!payment.transactionId || payment.transactionId !== event.transactionId) {
      throw paymentVerificationFailed();
    }
    if (payment.currency !== event.currency) {
      throw paymentAmountMismatch();
    }
    if (!payment.amount.equals(minorToDecimal(event.amountMinor))) {
      throw paymentAmountMismatch();
    }
  }

  /**
   * A consultation is confirmed only from PENDING, and only here — nothing in
   * the booking path or any client callback can reach CONFIRMED.
   */
  private async confirmConsultation(
    tx: Prisma.TransactionClient,
    consultationId: string,
  ): Promise<void> {
    const result = await tx.consultation.updateMany({
      where: { id: consultationId, status: ConsultationStatus.PENDING },
      data: { status: ConsultationStatus.CONFIRMED },
    });

    if (result.count === 0) {
      this.logger.warn(
        `consultation not confirmed, unexpected status consultationId=${consultationId}`,
      );
    }
  }
}
