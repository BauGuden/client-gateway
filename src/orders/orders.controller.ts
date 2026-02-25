import { Controller, Get, Post, Body, Param, Inject, ParseUUIDPipe, Query, Patch } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { ORDER_SERVICE } from 'src/config';
import { CreateOrderDto, OrderPaginationDto, StatusDto } from './dto';
import { firstValueFrom } from 'rxjs';
import { PaginationDto } from 'src/common';

@Controller('orders')
export class OrdersController {

  constructor(
    @Inject(ORDER_SERVICE) private readonly orderClient: ClientProxy,
  ) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderClient.send('createOrder', createOrderDto);
  }

  @Get()
  findAll(@Query() OrderPaginationDto: OrderPaginationDto) {
    return this.orderClient.send('findAllOrders', OrderPaginationDto);
  }

  @Get('id/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {

    try {
      
      const order = await firstValueFrom(
        this.orderClient.send('findOneOrder', { id })
      );
      return order;

    } catch (error) {
      
      throw new RpcException(error);

    }

  } 

  @Get(':status')
  async findAllByStatus(
    @Param() statusDto: StatusDto,
    @Query() paginationDto: PaginationDto
  ) {

    try {
      
      return this.orderClient.send('findAllOrders', {
        ...paginationDto,
        status: statusDto.status
       });

    } catch (error) {
      
      throw new RpcException(error);

    }

  } 

  @Patch(':id')
  changeOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusDto: StatusDto
  ) {
    try {
      return this.orderClient.send('changeOrderStatus', {
        id,
        status: statusDto.status
      });
    } catch (error) {
      throw new RpcException(error);
    }
  }

}
