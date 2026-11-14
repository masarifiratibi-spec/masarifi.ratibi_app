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
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsObject, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ClerkAuthGuard, type ClerkPrincipalRequest } from './clerk-auth.guard';
import { DeviceRegistrationDto } from './identity.dto';
import { IdentityService } from './identity.service';
import { IdentityRepository } from './identity.repository';
import { PlatformConfigService } from '../platform/config/platform-config.service';

@ApiSchema({ name: 'DevPushRegistration' })
export class DevPushRegistrationDto extends DeviceRegistrationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() trackingDeviceId!: string;
}
@ApiSchema({ name: 'DevInstallationSignOut' })
export class DevInstallationSignOutDto {
  @ApiProperty({ type: DeviceRegistrationDto })
  @IsObject()
  @ValidateNested()
  @Type(() => DeviceRegistrationDto)
  deviceRegistration!: DeviceRegistrationDto;
}
@Controller('api/v1/tracking/device')
@ApiBearerAuth('ClerkBearer')
@UseGuards(ClerkAuthGuard)
export class DevDeviceController {
  constructor(
    private readonly identity: IdentityService,
    private readonly repository: IdentityRepository,
    private readonly config: PlatformConfigService,
  ) {}
  private allowed() {
    if (!this.config.get('MASARIFI_MOBILE_AUTOMATION_ENABLED'))
      throw new HttpException({ code: 'NOT_FOUND' }, 404);
  }
  @Post('devices/register')
  @HttpCode(200)
  @ApiOperation({ operationId: 'registerMobileDevice' })
  async register(
    @Req() request: ClerkPrincipalRequest,
    @Body() input: DevPushRegistrationDto,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    this.allowed();
    if (input.platform !== 'android' || input.pushProvider !== 'expo' || !input.pushToken)
      throw new HttpException({ code: 'DEV_PUSH_DEVICE_INVALID' }, 400);
    if (!request.clerkPrincipal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
    return (
      await this.identity.registerDevice(request.clerkPrincipal, input, key, input.trackingDeviceId)
    ).body;
  }
  @Post('installations/sign-out')
  @HttpCode(200)
  @ApiOperation({ operationId: 'signOutMobileInstallation' })
  async signOut(@Req() request: ClerkPrincipalRequest, @Body() input: DevInstallationSignOutDto) {
    this.allowed();
    if (!request.clerkPrincipal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
    await this.repository.signOutDevInstallation(request.clerkPrincipal, input.deviceRegistration);
    return { status: 'disabled' };
  }
}
