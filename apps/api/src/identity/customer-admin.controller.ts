import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import {
  AdminAuthGuard,
  adminPermission,
  type AdminPrincipalRequest,
} from '../security/admin-auth.guard';
import { CustomerAdminService } from './customer-admin.service';

function principal(request: AdminPrincipalRequest) {
  if (!request.clerkPrincipal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
  return request.clerkPrincipal;
}

@Controller('api/v1/admin/users')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('ClerkBearer')
export class CustomerAdminController {
  constructor(private readonly customers: CustomerAdminService) {}
  @Get()
  @adminPermission('users.read')
  @ApiOperation({ operationId: 'listCustomerAdminUsers' })
  @ApiOkResponse({ description: 'Bounded masked customer directory' })
  list(@Req() request: AdminPrincipalRequest, @Query() query: Record<string, unknown>) {
    return this.customers.read(principal(request), 'list', query);
  }
  @Get(':userId')
  @adminPermission('users.read')
  @ApiOperation({ operationId: 'getCustomerAdminUser' })
  @ApiOkResponse({ description: 'Safe customer profile' })
  detail(@Req() request: AdminPrincipalRequest, @Param('userId') userId: string) {
    return this.customers.read(principal(request), 'detail', { userId });
  }
  @Get(':userId/devices')
  @adminPermission('devices.read')
  @ApiOperation({ operationId: 'listCustomerAdminDevices' })
  @ApiOkResponse({ description: 'Bounded safe devices' })
  devices(@Req() request: AdminPrincipalRequest, @Param('userId') userId: string) {
    return this.customers.read(principal(request), 'devices', { userId });
  }
  @Get(':userId/sessions')
  @adminPermission('sessions.read')
  @ApiOperation({ operationId: 'listCustomerAdminSessions' })
  @ApiOkResponse({
    description:
      'Target-bound active sessions with opaque references; historical expired/revoked counts are unmeasured and null',
  })
  sessions(@Req() request: AdminPrincipalRequest, @Param('userId') userId: string) {
    return this.customers.read(principal(request), 'sessions-target', { userId });
  }
  @Post(':userId/suspend')
  @adminPermission('users.status.manage', { recentAuth: true })
  @ApiOperation({ operationId: 'suspendCustomerAdminUser' })
  suspend(
    @Req() request: AdminPrincipalRequest,
    @Param('userId') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.customers.mutate(principal(request), 'suspend', body, id, key);
  }
  @Post(':userId/reactivate')
  @adminPermission('users.status.manage', { recentAuth: true })
  @ApiOperation({ operationId: 'reactivateCustomerAdminUser' })
  reactivate(
    @Req() request: AdminPrincipalRequest,
    @Param('userId') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.customers.mutate(principal(request), 'reactivate', body, id, key);
  }
  @Post(':userId/devices/:deviceId/revoke')
  @adminPermission('devices.revoke', { recentAuth: true })
  @ApiOperation({ operationId: 'revokeCustomerAdminDevice' })
  revokeDevice(
    @Req() request: AdminPrincipalRequest,
    @Param('userId') id: string,
    @Param('deviceId') device: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.customers.mutate(principal(request), 'revoke-device', body, id, key, device);
  }
  @Post(':userId/sessions/revoke')
  @adminPermission('sessions.revoke', { recentAuth: true })
  @ApiOperation({ operationId: 'revokeCustomerAdminSessions' })
  revokeSessions(
    @Req() request: AdminPrincipalRequest,
    @Param('userId') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.customers.mutate(principal(request), 'revoke-sessions', body, id, key);
  }
}
