import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'MetaResponse' })
export class MetaResponseDto {
  @ApiProperty({ enum: ['v1'] })
  apiVersion!: 'v1';

  @ApiProperty({ format: 'date-time' })
  serverTime!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 32 })
  minMobileVersion!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 32 })
  minAdminVersion!: string | null;
}
