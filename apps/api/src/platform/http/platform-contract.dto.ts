import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'LivenessResponse' })
export class LivenessResponseDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ maxLength: 64 })
  version!: string;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;
}

@ApiSchema({ name: 'DependencyChecks' })
export class DependencyChecksDto {
  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';

  @ApiProperty({ enum: ['up', 'down'] })
  queue!: 'up' | 'down';
}

@ApiSchema({ name: 'ReadinessSuccess' })
export class ReadinessSuccessDto {
  @ApiProperty({ enum: ['ready'] })
  status!: 'ready';

  @ApiProperty({ type: DependencyChecksDto })
  checks!: DependencyChecksDto;
}

@ApiSchema({ name: 'ReadinessFailure' })
export class ReadinessFailureDto {
  @ApiProperty({ enum: ['not_ready'] })
  status!: 'not_ready';

  @ApiProperty({ type: DependencyChecksDto })
  checks!: DependencyChecksDto;
}

@ApiSchema({ name: 'FieldError' })
export class FieldErrorDto {
  @ApiProperty({ maxLength: 128 })
  field!: string;

  @ApiProperty({ maxLength: 64, pattern: '^[A-Z][A-Z0-9_]*$' })
  code!: string;

  @ApiProperty({ maxLength: 256 })
  message!: string;
}

@ApiSchema({ name: 'SafeError' })
export class SafeErrorDto {
  @ApiProperty({ maxLength: 64, pattern: '^[A-Z][A-Z0-9_]*$' })
  code!: string;

  @ApiProperty({ maxLength: 256 })
  message!: string;

  @ApiProperty({ maxLength: 128 })
  requestId!: string;

  @ApiPropertyOptional({ type: [FieldErrorDto], maxItems: 50 })
  fieldErrors?: FieldErrorDto[];
}
