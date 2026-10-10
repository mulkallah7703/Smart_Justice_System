import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { NafathVerifyDto } from './dto/nafath-verify.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import type { AuthRegisterResult } from './auth.service';
import type { AuthVerifyResult } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthRateLimitGuard)
  register(@Body() body: RegisterDto): Promise<AuthRegisterResult> {
    return this.authService.register({
      name: body.name,
      email: body.email,
      password: body.password,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  login(@Body() body: LoginDto): Promise<AuthVerifyResult> {
    return this.authService.login({
      email: body.email,
      password: body.password,
    });
  }

  /**
   * FUTURE Nafath endpoint — retained for official integration.
   * Not used by the active Login/Register UI.
   */
  @Post('nafath/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  verify(
    @Body() body: NafathVerifyDto,
    @Req() request: Request,
  ): Promise<AuthVerifyResult> {
    return this.authService.verifyNafath(body.nationalId, body.nafathCode, {
      ip: request.ip,
      userAgent:
        typeof request.headers['user-agent'] === 'string'
          ? request.headers['user-agent']
          : undefined,
    });
  }
}
