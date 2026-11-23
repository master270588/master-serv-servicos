import { Controller, Get } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('public')
export class PublicCatalogController {
  constructor(private readonly orders: OrdersService) {}
  @Get('service-categories')
  categories() { return this.orders.listPublicCategories(); }
  @Get('service-areas')
  serviceAreas() { return this.orders.listPublicServiceAreas(); }
}
