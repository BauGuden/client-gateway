import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PaginationDto } from 'src/common';
import { PRODUCT_SERVICE } from 'src/config';

@Controller('products')
export class ProductsController {

  constructor(

    @Inject(PRODUCT_SERVICE) private readonly productClient: ClientProxy,

  ) {}


  @Post()
  createProduct() {
    return {
      message: 'Product created successfully',
    };
  }

  @Get()
  findAllProducts(@Query() PaginationDto: PaginationDto) {
    return this.productClient.send({ cmd: 'find_all_products' }, PaginationDto)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const product = await firstValueFrom(
        this.productClient.send({ cmd: 'find_one_product' }, { id: parseInt(id) })
      );
      return product;
    } catch (error) {
      throw new RpcException(error);
    }
  }
  
  @Delete(':id')
  async deleteOne(@Param('id') id: string) {
    const result = await firstValueFrom(
      this.productClient.send({ cmd: 'delete_product' }, { id: parseInt(id) })
    );
    return result;
  }

  @Patch(':id')
  updateOne(@Body() body:any, @Param('id') id: string) {
    return {
      message: `Product with id ${id} updated successfully`,
    };
  }

}
