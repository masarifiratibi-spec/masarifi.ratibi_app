import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ClerkAuthGuard, type ClerkPrincipalRequest } from '../identity/clerk-auth.guard';
import { FinancialResetService } from './financial-reset.service';

export class FinancialResetCommand {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  operationId!: string;
}

class FinancialResetReceipt {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['processing', 'completed'] })
  status!: 'processing' | 'completed';
  @ApiProperty()
  generation!: number;
}

class FinancialResetState {
  @ApiProperty()
  generation!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resetAt!: string | null;
  @ApiProperty({ enum: ['ready', 'processing'] })
  status!: 'ready' | 'processing';
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  requestId!: string | null;
}

function principal(request: ClerkPrincipalRequest) {
  if (!request.clerkPrincipal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
  return request.clerkPrincipal;
}

@ApiTags('Privacy')
@ApiBearerAuth('ClerkBearer')
@UseGuards(ClerkAuthGuard)
@Controller('api/v1/me/financial-reset')
export class FinancialResetController {
  constructor(private readonly service: FinancialResetService) {}

  @Post()
  @ApiOperation({ operationId: 'resetMyFinancialData' })
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: FinancialResetReceipt })
  reset(@Req() request: ClerkPrincipalRequest, @Body() command: FinancialResetCommand) {
    return this.service.reset(principal(request), command.operationId);
  }

  @Get('state')
  @ApiOperation({ operationId: 'getMyFinancialResetState' })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: FinancialResetState })
  state(@Req() request: ClerkPrincipalRequest) {
    return this.service.state(principal(request));
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getMyFinancialResetReceipt' })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: FinancialResetReceipt })
  receipt(@Req() request: ClerkPrincipalRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.receipt(principal(request), id);
  }
}
