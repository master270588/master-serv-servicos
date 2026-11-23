import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { CreateAddressDto } from './dto/create-address.dto';
import { OrdersService } from './orders.service';

@Controller('customer/addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class CustomerAddressesController {
  constructor(private readonly orders: OrdersService) {}
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAddressDto) {
    return this.orders.createCustomerAddress(req.user.sub, dto);
  }
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.orders.listCustomerAddresses(req.user.sub);
  }
}
