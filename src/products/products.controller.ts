import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
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
  findAllProducts() {
    return this.productClient.send({ cmd: 'find_all_products' }, {})
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return {
      message: `Product with id ${id} retrieved successfully`,
    };
  }
  
  @Delete(':id')
  deleteOne(@Param('id') id: string) {
    return {
      message: `Product with id ${id} deleted successfully`,
    };
  }

  @Patch(':id')
  updateOne(@Body() body:any, @Param('id') id: string) {
    return {
      message: `Product with id ${id} updated successfully`,
    };
  }

}
