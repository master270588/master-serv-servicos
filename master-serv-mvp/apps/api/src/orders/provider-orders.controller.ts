import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { OrdersService } from './orders.service';
import { RespondDispatchDto } from './dto/respond-dispatch.dto';
import { SubmitQuoteDto } from './dto/submit-quote.dto';

@Controller('providers/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('provider')
export class ProviderOrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get('dispatches')
  dispatches(@Req() req: AuthenticatedRequest) {
    return this.orders.listProviderDispatches(req.user.sub);
  }
  @Post('dispatches/:batchId/respond')
  respond(
    @Req() req: AuthenticatedRequest,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() dto: RespondDispatchDto,
  ) {
    return this.orders.respondToDispatch(req.user.sub, batchId, dto);
  }
  @Get('orders')
  ordersList(@Req() req: AuthenticatedRequest) {
    return this.orders.listProviderOrders(req.user.sub);
  }
  @Post('orders/:orderId/quotes')
  quote(
    @Req() req: AuthenticatedRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SubmitQuoteDto,
  ) {
    return this.orders.submitQuote(req.user.sub, orderId, dto);
  }
  @Post('orders/:orderId/start')
  start(@Req() req: AuthenticatedRequest, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.startOrder(req.user.sub, orderId);
  }
  @Post('orders/:orderId/complete')
  complete(@Req() req: AuthenticatedRequest, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.completeOrder(req.user.sub, orderId);
  }
}
