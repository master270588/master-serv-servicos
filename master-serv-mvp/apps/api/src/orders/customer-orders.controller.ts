import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DecideQuoteDto } from './dto/decide-quote.dto';

@Controller('customer/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.orders.createCustomerOrder(req.user.sub, dto);
  }
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.orders.listCustomerOrders(req.user.sub);
  }
  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getCustomerOrder(req.user.sub, id);
  }
  @Post(':orderId/quotes/:quoteId/decision')
  decide(
    @Req() req: AuthenticatedRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: DecideQuoteDto,
  ) {
    return this.orders.decideQuote(req.user.sub, orderId, quoteId, dto);
  }
}
