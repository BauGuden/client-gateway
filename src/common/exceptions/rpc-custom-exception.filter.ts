
import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const rpcError = exception.getError();

    if( rpcError.toString().includes('Empty responses') ) {
      return response.status(404).json({
        statusCode: 404,
        message: rpcError.toString().substring(0, rpcError.toString().indexOf('(')-1),
      });
    }

    if ( 
      typeof rpcError === 'object' && 
      rpcError !== null &&
      'status' in rpcError && 
      'message' in rpcError 
    ) {
      const status = isNaN(+(rpcError.status as any)) ? 400 : +(rpcError.status as any);
      return response.status(status).json(rpcError);
    }
    
    response.status(400).json({
      statusCode: 400,
      message: rpcError,
    });


  }
}
