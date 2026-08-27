import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { SafeErrorDto } from '../http/platform-contract.dto';
import { MetaAuthGuard } from './meta-auth.guard';
import { MetaResponseDto } from './meta.dto';
import { MetaService } from './meta.service';

@ApiTags('Platform')
@Controller('api/v1/meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get()
  @UseGuards(MetaAuthGuard)
  @ApiBearerAuth('ClerkBearer')
  @ApiOperation({ operationId: 'getPlatformMetadata' })
  @ApiOkResponse({ type: MetaResponseDto })
  @ApiResponse({ status: 401, type: SafeErrorDto })
  @ApiResponse({ status: 403, type: SafeErrorDto })
  @ApiResponse({ status: 429, type: SafeErrorDto })
  @ApiResponse({ status: 500, type: SafeErrorDto })
  @ApiResponse({ status: 503, type: SafeErrorDto })
  get(): MetaResponseDto {
    return this.meta.get();
  }
}
