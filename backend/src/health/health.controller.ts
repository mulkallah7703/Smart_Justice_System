import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

import { HealthService } from './health.service';
import type { HealthStatus, ReadinessStatus } from './health.types';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  liveness(): HealthStatus {
    return this.healthService.liveness();
  }

  @Get('ready')
  async readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessStatus> {
    const result = await this.healthService.readiness();
    if (result.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}

/** Alias for orchestrators that probe `/readyz`. Same payload as `/health/ready`. */
@Controller()
export class ReadyzController {
  constructor(private readonly healthService: HealthService) {}

  @Get('readyz')
  async readyz(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessStatus> {
    const result = await this.healthService.readiness();
    if (result.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
