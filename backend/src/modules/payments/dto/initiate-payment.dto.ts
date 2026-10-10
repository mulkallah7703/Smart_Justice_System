import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsString, Length } from 'class-validator';

/**
 * The entire payable-amount contract is server-side: this DTO deliberately has
 * no amount, currency, discount, userId, or status field, and the global
 * validation pipe rejects any such property with 400 VALIDATION_ERROR.
 */
export class InitiatePaymentDto {
  @IsString()
  @Length(1, 64)
  consultationId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
