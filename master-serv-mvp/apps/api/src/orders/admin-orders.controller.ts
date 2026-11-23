import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { OrdersService } from './orders.service';
import { DispatchOrderDto } from './dto/dispatch-order.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get()
  list(@Query('status') status?: string) { return this.orders.listAdminOrders(status); }
  @Post(':id/dispatch')
  dispatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: DispatchOrderDto,
  ) {
    return this.orders.dispatchOrder(id, req.user.sub, dto);
  }
}
