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

  @Get('compatibility')
  @ApiOperation({ operationId: 'getRuntimeCompatibility' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        schemaVersion: { type: 'integer', enum: [1] },
        contracts: { type: 'object', additionalProperties: { type: 'integer' } },
      },
      required: ['schemaVersion', 'contracts'],
    },
  })
  compatibility() {
    // Protocol versions identify interoperability, not an immutable image.
    // Readiness and behavioral candidate gates remain separate requirements.
    return {
      schemaVersion: 1,
      contracts: {
        voiceSession: 2,
        voiceBatch: 3,
        voiceExtraction: 3,
        voiceWorker: 1,
        voiceConfirmation: 2,
        assistantDirect: 2,
        assistantProvider: 1,
        manualReceipt: 1,
      },
    };
  }

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
