import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';

import type { AppConfig } from '../../config/env.validation';
import { InactiveNafathAdapter } from './adapters/nafath/inactive-nafath.adapter';
import { MockNafathAdapter } from './adapters/nafath/mock-nafath.adapter';
import { RealNafathAdapter } from './adapters/nafath/real-nafath.adapter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NAFATH_ADAPTER } from './types/auth.types';

/**
 * Active authentication: email/password register + login.
 * Nafath is DEFERRED: inactive in production; mock only for local/test;
 * real remains fail-closed until official client is supplied.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const jwt = configService.get('jwt', { infer: true });
        return {
          secret: jwt.accessSecret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: jwt.accessExpiresIn as SignOptions['expiresIn'],
          },
          verifyOptions: {
            algorithms: ['HS256'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    AuthRateLimitGuard,
    InactiveNafathAdapter,
    MockNafathAdapter,
    RealNafathAdapter,
    {
      provide: NAFATH_ADAPTER,
      inject: [
        ConfigService,
        InactiveNafathAdapter,
        MockNafathAdapter,
        RealNafathAdapter,
      ],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        inactive: InactiveNafathAdapter,
        mock: MockNafathAdapter,
        real: RealNafathAdapter,
      ) => {
        const { mode } = configService.get('nafath', { infer: true });
        if (mode === 'inactive') {
          return inactive;
        }
        if (mode === 'mock') {
          return mock;
        }
        if (mode === 'real') {
          return real;
        }
        throw new Error(`No Nafath adapter registered for mode: ${String(mode)}`);
      },
    },
  ],
  exports: [JwtAuthGuard, JwtModule, PassportModule],
})
export class AuthModule {}
