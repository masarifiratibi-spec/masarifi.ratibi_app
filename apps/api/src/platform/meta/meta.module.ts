import { Module } from '@nestjs/common';

import { MetaAuthGuard } from './meta-auth.guard';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  controllers: [MetaController],
  providers: [MetaService, MetaAuthGuard],
})
export class MetaModule {}
