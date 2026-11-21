import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard, type ClerkPrincipalRequest } from '../identity/clerk-auth.guard';
import { ReportsRepository } from './reports.repository';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
@Controller('api/v1/me/mobile-activity')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('ClerkBearer')
export class ReportsMobileActivityController {
  constructor(private readonly repository: ReportsRepository) {}
  @Post()
  @HttpCode(204)
  @ApiOperation({ operationId: 'recordMobileActivity' })
  async record(
    @Req() request: ClerkPrincipalRequest,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
  ): Promise<void> {
    if (origin) throw new HttpException({ code: 'FORBIDDEN' }, 403);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== 'platform') ||
      !['ios', 'android'].some((platform) => platform === (body as { platform?: unknown }).platform)
    )
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    if (!request.clerkPrincipal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
    await this.repository.recordMobileActivity(
      request.clerkPrincipal,
      (body as { platform: string }).platform,
    );
  }
}
