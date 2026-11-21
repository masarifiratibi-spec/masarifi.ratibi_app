import { Controller, Get, Headers, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { SafeErrorDto } from '../http/platform-contract.dto';
import { derivePercentageCohort } from '../../operations/feature-evaluator';
import { MetaAuthGuard, type MetaRequest } from './meta-auth.guard';
import { MetaResponseDto } from './meta.dto';
import { MetaService } from './meta.service';

@ApiTags('Platform')
@Controller('api/v1/meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get('mobile-update')
  @ApiOperation({ operationId: 'getMobileUpdatePolicy' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['schemaVersion', 'enabled', 'release', 'storeUrl'],
      properties: {
        schemaVersion: { type: 'integer', enum: [1] },
        enabled: { type: 'boolean' },
        release: {
          nullable: true,
          type: 'object',
          additionalProperties: false,
          required: ['version', 'versionCode'],
          properties: {
            version: {
              type: 'string',
              maxLength: 32,
              pattern: '^(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})$',
            },
            versionCode: { type: 'integer', minimum: 1, maximum: 2_100_000_000 },
          },
        },
        storeUrl: {
          type: 'string',
          enum: ['https://play.google.com/store/apps/details?id=com.masarifi.mobile'],
        },
      },
    },
  })
  mobileUpdate(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'public, no-store');
    return this.meta.getMobileUpdate();
  }

  @Get('social-media')
  @UseGuards(MetaAuthGuard)
  @ApiBearerAuth('ClerkBearer')
  @ApiOperation({ operationId: 'getSocialMediaLinks' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['instagram', 'tiktok', 'snapchat'],
      properties: {
        instagram: { type: 'string', maxLength: 500 },
        tiktok: { type: 'string', maxLength: 500 },
        snapchat: { type: 'string', maxLength: 500 },
      },
    },
  })
  socialMedia(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.meta.getSocialMediaLinks();
  }

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
  async get(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('x-masarifi-platform') platform: string | undefined,
    @Headers('x-masarifi-app-version') appVersion: string | undefined,
    @Headers('x-masarifi-locale') locale: string | undefined,
    @Req() request: MetaRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MetaResponseDto | undefined> {
    const context = {
      ...(platform && ['ios', 'android', 'admin'].includes(platform)
        ? { platform: platform as 'ios' | 'android' | 'admin' }
        : {}),
      ...(appVersion && /^\d+(?:\.\d+){0,2}$/u.test(appVersion) ? { appVersion } : {}),
      ...(locale && ['ar', 'en'].includes(locale) ? { locale: locale as 'ar' | 'en' } : {}),
      ...(request.metaSubject ? { cohort: derivePercentageCohort(request.metaSubject) } : {}),
    };
    const value = await this.meta.get(context);
    const etag = await this.meta.etag(context);
    response.setHeader('Cache-Control', 'private, max-age=30');
    response.setHeader('ETag', etag);
    if (ifNoneMatch === etag) {
      response.status(304);
      return undefined;
    }
    return value;
  }
}
