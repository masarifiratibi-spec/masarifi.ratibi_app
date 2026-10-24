import { createHash, createHmac } from 'node:crypto';
import { Controller, Get, Header, Headers, HttpException, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { PlatformConfigService } from '../platform/config/platform-config.service';
import { ImmediateDeletionService } from './immediate-deletion.service';

@Controller('api/v1/privacy/deletion-completions')
export class DeletionCompletionController {
  constructor(
    private readonly deletion: ImmediateDeletionService,
    private readonly config: PlatformConfigService,
  ) {}

  @Get(':operationId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'getDeletionCompletion' })
  @ApiBearerAuth('DeletionCompletionReceipt')
  async getCompletion(
    @Param('operationId') operationId: string,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: Request,
  ): Promise<unknown> {
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(operationId))
      throw new HttpException({ code: 'NOT_FOUND' }, 404);
    const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? '');
    const token = match?.[1];
    if (!token) throw new HttpException({ code: 'NOT_FOUND' }, 404);
    const networkHash = createHmac(
      'sha256',
      this.config.getRequired('MASARIFI_SECURITY_IP_HASH_KEYS'),
    )
      .update(request.socket.remoteAddress ?? 'unknown')
      .digest('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const result = await this.deletion.getCompletion(operationId, tokenHash, networkHash);
    if (result.rateLimited) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    if (!result.value) throw new HttpException({ code: 'NOT_FOUND' }, 404);
    return result.value;
  }
}
