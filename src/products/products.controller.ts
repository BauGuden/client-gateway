import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { PaginationDto } from 'src/common';
import { PRODUCT_SERVICE } from 'src/config';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {

  constructor(

    @Inject(PRODUCT_SERVICE) private readonly productClient: ClientProxy,

  ) {}


  @Post()
  createProduct( @Body() createProductDto: CreateProductDto ) {

    return this.productClient.send({ cmd: 'create_product' }, createProductDto)

  }

  @Get()
  findAllProducts(@Query() PaginationDto: PaginationDto) {
    return this.productClient.send({ cmd: 'find_all_products' }, PaginationDto)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {

    return this.productClient.send({ cmd: 'find_one_product' }, { id: parseInt(id) })
    .pipe(
      catchError( err => {
        throw new RpcException(err);
      })
    )

    // try {
    //   const product = await firstValueFrom(
    //     this.productClient.send({ cmd: 'find_one_product' }, { id: parseInt(id) })
    //   );
    //   return product;
    // } catch (error) {
    //   throw new RpcException(error);
    // }
  }
  
  @Delete(':id')
  deleteOne(@Param('id', ParseIntPipe) id: number) {
    return this.productClient.send({ cmd: 'delete_product' }, { id }).pipe(
      catchError( err => {
        throw new RpcException(err);
      })
    )
  }

  @Patch(':id')
  patchProduct(
    @Body() UpdateProductDto: UpdateProductDto,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.productClient.send({ cmd: 'update_product' }, { id, ...UpdateProductDto }).pipe(
      catchError( err => {
        throw new RpcException(err);
      })
    )
  }

}
