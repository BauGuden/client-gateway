import { IsEnum, IsOptional } from "class-validator";
import { OrderStatus, OrderStatusList } from "../enum/order.enum";


export class StatusDto {

    @IsEnum(OrderStatusList, {
        message: `Status must be one of the following values: ${Object.values(OrderStatus).join(', ')}`
    }
    )
    @IsOptional()
    status: OrderStatus;

}