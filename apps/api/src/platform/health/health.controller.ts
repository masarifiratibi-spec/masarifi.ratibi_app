import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import {
  LivenessResponseDto,
  ReadinessFailureDto,
  ReadinessSuccessDto,
  SafeErrorDto,
} from '../http/platform-contract.dto';
import { HealthService, type LivenessResponse, type ReadinessResponse } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ApiOperation({ operationId: 'getLiveness' })
  @ApiOkResponse({ type: LivenessResponseDto })
  @ApiResponse({ status: 503, type: SafeErrorDto })
  live(): LivenessResponse {
    return this.health.live();
  }

  @Get('ready')
  @ApiOperation({ operationId: 'getReadiness' })
  @ApiOkResponse({ type: ReadinessSuccessDto })
  @ApiResponse({ status: 503, type: ReadinessFailureDto })
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponse> {
    const result = await this.health.ready();
    if (result.status === 'not_ready') response.status(503);
    return result;
  }
}
