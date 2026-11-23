import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminOrdersController } from './admin-orders.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerAddressesController } from './customer-addresses.controller';
import { OrdersService } from './orders.service';
import { ProviderOrdersController } from './provider-orders.controller';
import { PublicCatalogController } from './public-catalog.controller';

@Module({
  imports: [AuthModule],
  controllers: [PublicCatalogController, CustomerOrdersController, CustomerAddressesController, ProviderOrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
