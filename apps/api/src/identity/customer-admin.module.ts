import { Module } from '@nestjs/common';
import { DatabaseModule } from '../platform/database/database.module';
import { SecurityModule } from '../security/security.module';
import { IdentityModule } from './identity.module';
import { CustomerAdminController } from './customer-admin.controller';
import { CustomerAdminService } from './customer-admin.service';
import { CustomerAdminRepository } from './customer-admin.repository';
@Module({
  imports: [DatabaseModule, IdentityModule, SecurityModule],
  controllers: [CustomerAdminController],
  providers: [CustomerAdminService, CustomerAdminRepository],
})
export class CustomerAdminModule {}
