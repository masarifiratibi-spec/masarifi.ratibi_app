import { Body, Controller, HttpCode, HttpException, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard, type ClerkPrincipalRequest } from './clerk-auth.guard';
import { ClerkClientService } from './clerk-client.service';

@Controller('api/v1/me/apple-deletion-grant')
@UseGuards(ClerkAuthGuard)
export class AppleDeletionController {
  constructor(private readonly clerk: ClerkClientService) {}

  @Post()
  @HttpCode(200)
  prepare(@Req() request: ClerkPrincipalRequest, @Body() body: unknown) {
    if (!request.clerkPrincipal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== 'authorizationCode')
    )
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    const code = 'authorizationCode' in body ? body.authorizationCode : undefined;
    if (code !== undefined && (typeof code !== 'string' || !/^[\x21-\x7e]{1,2048}$/.test(code)))
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    return this.clerk.prepareAppleDeletion(request.clerkPrincipal.userId, code);
  }
}
