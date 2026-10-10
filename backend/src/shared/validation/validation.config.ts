import { ValidationPipe } from '@nestjs/common';

export const validationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
} as const;

export const createValidationPipe = (): ValidationPipe =>
  new ValidationPipe({ ...validationPipeOptions });
