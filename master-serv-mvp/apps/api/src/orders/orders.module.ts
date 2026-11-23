import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminOrdersController } from './admin-orders.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { OrdersService } from './orders.service';
import { ProviderOrdersController } from './provider-orders.controller';
import { PublicCatalogController } from './public-catalog.controller';

@Module({
  imports: [AuthModule],
  controllers: [PublicCatalogController, CustomerOrdersController, ProviderOrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
