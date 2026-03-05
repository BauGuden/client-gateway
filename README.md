# Client Gateway (`client-gateway`)

API Gateway (puerta de entrada) construido con **NestJS** que expone endpoints **REST/HTTP** al mundo exterior y se comunica internamente con los microservicios (`product-ms` y `orders-ms`) mediante **NATS** como capa de transporte. No tiene base de datos propia; actúa como intermediario entre los clientes HTTP y los microservicios.

---

## Tabla de Contenidos

1. [Tecnologías y Librerías](#tecnologías-y-librerías)
2. [Variables de Entorno](#variables-de-entorno)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Punto de Entrada (`main.ts`)](#punto-de-entrada-maints)
5. [Carpeta `src/config`](#carpeta-srcconfig)
6. [Carpeta `src/common`](#carpeta-srccommon)
7. [Carpeta `src/transports`](#carpeta-srctransports)
8. [Carpeta `src/products`](#carpeta-srcproducts)
9. [Carpeta `src/orders`](#carpeta-srcorders)
10. [Dockerfile](#dockerfile)
11. [Instalación y Ejecución](#instalación-y-ejecución)
12. [Endpoints REST (API)](#endpoints-rest-api)
13. [Arquitectura General](#arquitectura-general)

---

## Tecnologías y Librerías

### Dependencias de Producción

| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `@nestjs/common` | ^11.0.1 | Módulo común de NestJS (decoradores HTTP, pipes, guards, filtros, etc.) |
| `@nestjs/core` | ^11.0.1 | Núcleo del framework NestJS |
| `@nestjs/mapped-types` | * | Utilidades para crear DTOs derivados (`PartialType`) |
| `@nestjs/microservices` | ^11.1.14 | Soporte de microservicios — usado aquí como **cliente** para enviar mensajes vía NATS |
| `@nestjs/platform-express` | ^11.0.1 | Adaptador HTTP Express — el gateway **sí** expone endpoints HTTP |
| `class-transformer` | ^0.5.1 | Transformación de objetos planos a instancias de clases (`@Type()`) |
| `class-validator` | ^0.14.3 | Validación de DTOs con decoradores (`@IsString()`, `@IsArray()`, `@IsEnum()`, etc.) |
| `dotenv` | ^17.3.1 | Carga variables de entorno desde `.env` a `process.env` |
| `joi` | ^18.0.2 | Validación de esquema para las variables de entorno al arrancar |
| `nats` | ^2.29.3 | Cliente NATS para la comunicación con los microservicios |
| `reflect-metadata` | ^0.2.2 | Polyfill de metadata requerido por NestJS y class-transformer |
| `rxjs` | ^7.8.1 | Programación reactiva — usado para `catchError()`, `firstValueFrom()` y manejo de Observables retornados por `ClientProxy.send()` |

### Dependencias de Desarrollo

| Paquete | Descripción |
|---------|-------------|
| `typescript` (^5.7.3) | Compilador TypeScript |
| `@nestjs/cli` | CLI de NestJS para generar recursos y compilar |
| `jest` / `ts-jest` | Framework de testing |
| `eslint` / `prettier` | Linting y formateo de código |
| `ts-node` | Ejecución directa de TypeScript en Node.js |

> **Nota**: A diferencia de `product-ms` y `orders-ms`, el gateway **no** tiene Prisma ni base de datos. Solo actúa como proxy HTTP → NATS.

---

## Variables de Entorno

El gateway requiere un archivo `.env` en la raíz del proyecto:

```env
# Puerto HTTP donde escucha el gateway (requerido)
PORT=3000

# --- Variables comentadas (migración de TCP a NATS) ---
# Antes se usaba conexión directa TCP a cada microservicio:
# PRODUCTS_MICROSERVICE_HOST=localhost
# PRODUCTS_MICROSERVICE_PORT=3001
# ORDERS_MICROSERVICE_HOST=localhost
# ORDERS_MICROSERVICE_PORT=3002
# Estas variables fueron reemplazadas por NATS_SERVERS.

# Servidores NATS separados por coma (requerido)
NATS_SERVERS="nats://localhost:4222"
```

### Validación con Joi (`src/config/envs.ts`)

```typescript
interface EnvVars {
    PORT: number;
    // PRODUCTS_MICROSERVICE_HOST: string;   ← comentado (migración TCP → NATS)
    // PRODUCTS_MICROSERVICE_PORT: number;   ← comentado
    // ORDERS_MICROSERVICE_HOST: string;     ← comentado
    // ORDERS_MICROSERVICE_PORT: number;     ← comentado
    NATS_SERVERS: string[];
}

const envsSchema = joi.object({
    PORT: joi.number().required(),
    // PRODUCTS_MICROSERVICE_HOST: joi.string().required(),   ← comentado
    // PRODUCTS_MICROSERVICE_PORT: joi.number().required(),   ← comentado
    // ORDERS_MICROSERVICE_HOST: joi.string().required(),     ← comentado
    // ORDERS_MICROSERVICE_PORT: joi.number().required(),     ← comentado
    NATS_SERVERS: joi.array().items(joi.string()).required(),
}).unknown();
```

**Código comentado explicado**: Originalmente el gateway se conectaba directamente a cada microservicio vía TCP (host + puerto). Tras migrar a NATS, todas esas variables se reemplazaron por un solo `NATS_SERVERS`. Los comentarios se conservan como referencia de la evolución de la arquitectura.

- `NATS_SERVERS` se parsea de string separado por comas a `string[]`.
- Si alguna variable requerida falta, lanza error y no arranca.
- El objeto exportado `envs` contiene: `port`, `natsServers` (y las propiedades TCP comentadas: `productsMicroserviceHost/Port`, `ordersMicroserviceHost/Port`).

---

## Estructura del Proyecto

```
client-gateway/
├── .env                            # Variables de entorno
├── dockerfile                      # Imagen Docker del gateway
├── package.json                    # Dependencias y scripts
└── src/
    ├── main.ts                     # Punto de entrada (app HTTP + filtro de excepciones)
    ├── app.module.ts               # Módulo raíz (ProductsModule, OrdersModule, NatsModule)
    ├── config/
    │   ├── envs.ts                 # Validación y exportación de variables de entorno
    │   ├── services.ts             # Constantes de tokens de servicios (NATS_SERVICES)
    │   └── index.ts                # Barrel file
    ├── common/
    │   ├── dto/
    │   │   └── pagination.dto.ts   # DTO reutilizable de paginación
    │   ├── exceptions/
    │   │   └── rpc-custom-exception.filter.ts  # Filtro global de excepciones RPC → HTTP
    │   └── index.ts                # Barrel file
    ├── transports/
    │   └── nats.module.ts          # Módulo de transporte NATS (ClientProxy reutilizable)
    ├── products/
    │   ├── products.module.ts      # Módulo de productos
    │   ├── products.controller.ts  # Controlador REST → NATS para productos
    │   └── dto/
    │       ├── create-product.dto.ts   # DTO para crear producto
    │       └── update-product.dto.ts   # DTO para actualizar producto
    └── orders/
        ├── orders.module.ts        # Módulo de órdenes
        ├── orders.controller.ts    # Controlador REST → NATS para órdenes
        ├── dto/
        │   ├── create-order.dto.ts       # DTO para crear orden
        │   ├── order-item.dto.ts         # DTO para items de la orden
        │   ├── order-pagination.dto.ts   # DTO paginación + filtro por status
        │   ├── status.dto.ts             # DTO para status en params/body
        │   └── index.ts                  # Barrel file de DTOs
        └── enum/
            └── order.enum.ts       # Enum OrderStatus y OrderStatusList
```

---

## Punto de Entrada (`main.ts`)

```typescript
async function bootstrap() {
  const logger = new Logger('Main-Gateway');

  const app = await NestFactory.create(AppModule);       // ← App HTTP (NO microservicio)

  app.setGlobalPrefix('api');                             // ← Prefijo global /api

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new RpcCustomExceptionFilter());   // ← Filtro de excepciones RPC

  await app.listen(envs.port);
  logger.log(`Gateway is running on port ${envs.port}`);
}
```

**Diferencia clave con los otros microservicios**: El gateway se crea con `NestFactory.create()` (app HTTP) en lugar de `NestFactory.createMicroservice()`. Esto permite:

- Exponer endpoints HTTP REST al exterior.
- Prefijo global `/api` para todas las rutas.
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform: true`.
- `RpcCustomExceptionFilter` registrado como **filtro global** para interceptar errores RPC de los microservicios y convertirlos en respuestas HTTP legibles.

---

## Carpeta `src/config`

### `envs.ts`

Carga y valida las variables de entorno con `dotenv` + `Joi`. Exporta el objeto `envs` con `port` y `natsServers`. Conserva comentadas las variables TCP de la arquitectura anterior (`PRODUCTS_MICROSERVICE_HOST/PORT` y `ORDERS_MICROSERVICE_HOST/PORT`) como documentación de la migración.

### `services.ts`

```typescript
// export const PRODUCT_SERVICE = 'PRODUCT_SERVICE';   ← comentado (era para TCP con product-ms)
// export const ORDER_SERVICE = 'ORDER_SERVICE';       ← comentado (era para TCP con orders-ms)

export const NATS_SERVICES = 'NATS_SERVICES';
```

**Código comentado explicado**: Antes se usaban tokens separados para cada microservicio (`PRODUCT_SERVICE` y `ORDER_SERVICE`) cuando la conexión era TCP. Con NATS, un solo `ClientProxy` (`NATS_SERVICES`) es suficiente para comunicarse con **todos** los microservicios a través del mismo bus de mensajes.

### `index.ts`

Barrel file que re-exporta `envs` y `services`.

---

## Carpeta `src/common`

### `dto/pagination.dto.ts`

```typescript
export class PaginationDto {
    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    page: number = 1;

    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    limit: number = 10;
}
```

DTO reutilizable para paginación con valores por defecto (`page: 1`, `limit: 10`).

### `exceptions/rpc-custom-exception.filter.ts`

```typescript
@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const rpcError = exception.getError();

    // 1) Manejo especial de "Empty responses" (servicio no disponible)
    if (rpcError.toString().includes('Empty responses')) {
      return response.status(404).json({
        statusCode: 404,
        message: rpcError.toString().substring(0, rpcError.toString().indexOf('(') - 1),
      });
    }

    // 2) Error estructurado con { status, message }
    if (typeof rpcError === 'object' && 'status' in rpcError && 'message' in rpcError) {
      const status = isNaN(+(rpcError.status as any)) ? 400 : +(rpcError.status as any);
      return response.status(status).json(rpcError);
    }

    // 3) Fallback: error genérico
    response.status(400).json({ statusCode: 400, message: rpcError });
  }
}
```

Este filtro es **fundamental** para el gateway. Convierte las excepciones RPC (que no tienen formato HTTP) en respuestas HTTP apropiadas:

1. **"Empty responses"**: Cuando un microservicio no responde (no está corriendo o NATS no encuentra un listener), el error contiene "Empty responses". El filtro lo intercepta y responde con `404` y un mensaje limpio (recorta el texto técnico).
2. **Error estructurado**: Si el microservicio lanzó `RpcException({ status, message })`, usa ese `status` como código HTTP y devuelve el objeto tal cual.
3. **Fallback**: Para cualquier otro formato de error, responde con `400` genérico.

> **Diferencia con `orders-ms`**: El filtro del gateway incluye el manejo de `"Empty responses"` que no existe en la versión de `orders-ms`, ya que es en el gateway donde se detecta que un microservicio no está disponible.

### `index.ts`

Barrel file que exporta `PaginationDto` y `RpcCustomExceptionFilter`.

---

## Carpeta `src/transports`

### `nats.module.ts`

Módulo reutilizable que registra un `ClientProxy` NATS:

```typescript
@Module({
    imports: [
        ClientsModule.register([{
            name: NATS_SERVICES,
            transport: Transport.NATS,
            options: { servers: envs.natsServers },
        }])
    ],
    exports: [
        ClientsModule.register([{
            name: NATS_SERVICES,
            transport: Transport.NATS,
            options: { servers: envs.natsServers },
        }])
    ]
})
export class NatsModule {}
```

- Registra un único `ClientProxy` con token `NATS_SERVICES`.
- Lo exporta para que otros módulos lo importen y puedan inyectar el cliente con `@Inject(NATS_SERVICES)`.
- Un **solo cliente** NATS sirve para comunicarse con **todos** los microservicios (`product-ms` y `orders-ms`) ya que NATS enruta por patrón de mensaje.

---

## Carpeta `src/products`

### `products.module.ts`

```typescript
@Module({
  controllers: [ProductsController],
  imports: [NatsModule],
})
export class ProductsModule {}
```

Importa `NatsModule` para inyectar el `ClientProxy` NATS en el controlador.

### `products.controller.ts`

Controlador REST que recibe peticiones HTTP y las reenvía a `product-ms` vía NATS:

```typescript
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(NATS_SERVICES) private readonly productClient: ClientProxy,
  ) {}
}
```

#### Endpoints y Mensajes NATS

| Método HTTP | Ruta | Mensaje NATS | Descripción |
|-------------|------|-------------|-------------|
| `POST` | `/api/products` | `{ cmd: 'create_product' }` | Crea un producto |
| `GET` | `/api/products` | `{ cmd: 'find_all_products' }` | Lista productos con paginación |
| `GET` | `/api/products/:id` | `{ cmd: 'find_one_product' }` | Busca un producto por ID |
| `PATCH` | `/api/products/:id` | `{ cmd: 'update_product' }` | Actualiza un producto |
| `DELETE` | `/api/products/:id` | `{ cmd: 'delete_product' }` | Soft delete de un producto |

#### Manejo de Errores con RxJS

El controlador usa dos patrones para manejar errores de los microservicios:

**Patrón 1 — `catchError` con pipe (usado en `findOne`, `deleteOne`, `patchProduct`)**:
```typescript
@Get(':id')
async findOne(@Param('id') id: string) {
    return this.productClient.send({ cmd: 'find_one_product' }, { id: parseInt(id) })
    .pipe(
      catchError(err => { throw new RpcException(err); })
    );
}
```
Encadena `catchError()` al Observable para interceptar errores y relanzarlos como `RpcException` (que luego el filtro global convierte en HTTP).

**Código comentado — patrón alternativo con `firstValueFrom` (en `findOne`)**:
```typescript
// try {
//   const product = await firstValueFrom(
//     this.productClient.send({ cmd: 'find_one_product' }, { id: parseInt(id) })
//   );
//   return product;
// } catch (error) {
//   throw new RpcException(error);
// }
```
Se conserva como referencia una versión alternativa que usa `firstValueFrom()` de RxJS para convertir el Observable a Promise y manejar errores con `try/catch`. Ambos enfoques funcionan, pero se eligió el patrón con `pipe()` por ser más idiomático con RxJS.

### DTOs

#### `create-product.dto.ts`

```typescript
export class CreateProductDto {
    @IsString()
    public name: string;

    @Min(0)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Type(() => Number)
    public price: number;
}
```

#### `update-product.dto.ts`

```typescript
export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

Extiende `CreateProductDto` con `PartialType` — todos los campos son opcionales. **Nota**: A diferencia del DTO en `product-ms`, aquí no incluye `id` porque el ID se pasa por parámetro de ruta (`@Param('id')`).

---

## Carpeta `src/orders`

### `orders.module.ts`

```typescript
@Module({
  controllers: [OrdersController],
  imports: [
    ClientsModule.register([{
      name: NATS_SERVICES,
      transport: Transport.NATS,
      options: { servers: envs.natsServers },
    }])
  ],
})
export class OrdersModule {}
```

> **Nota**: Este módulo registra su propio `ClientsModule` directamente en lugar de importar `NatsModule`. Ambos enfoques funcionan; `ProductsModule` usa `NatsModule` mientras que `OrdersModule` registra el cliente inline.

### `orders.controller.ts`

Controlador REST que recibe peticiones HTTP y las reenvía a `orders-ms` vía NATS:

```typescript
@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(NATS_SERVICES) private readonly orderClient: ClientProxy,
  ) {}
}
```

#### Endpoints y Mensajes NATS

| Método HTTP | Ruta | Mensaje NATS | Descripción |
|-------------|------|-------------|-------------|
| `POST` | `/api/orders` | `'createOrder'` | Crea una nueva orden |
| `GET` | `/api/orders` | `'findAllOrders'` | Lista órdenes con paginación |
| `GET` | `/api/orders/id/:id` | `'findOneOrder'` | Busca una orden por UUID |
| `GET` | `/api/orders/:status` | `'findAllOrders'` | Filtra órdenes por status |
| `PATCH` | `/api/orders/:id` | `'changeOrderStatus'` | Cambia el estado de una orden |

> **Nota sobre patrones NATS**: Los mensajes de productos usan formato objeto `{ cmd: 'xxx' }`, mientras que los de órdenes usan strings simples `'createOrder'`. Ambos formatos son válidos en NATS/NestJS.

#### Detalle de Endpoints

**`GET /api/orders/id/:id`** — Buscar por UUID:
```typescript
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
```
Usa `ParseUUIDPipe` para validar el formato UUID y `firstValueFrom()` para convertir el Observable a Promise.

**`GET /api/orders/:status`** — Filtrar por status:
```typescript
@Get(':status')
async findAllByStatus(
    @Param() statusDto: StatusDto,
    @Query() paginationDto: PaginationDto
) {
    return this.orderClient.send('findAllOrders', {
      ...paginationDto,
      status: statusDto.status
    });
}
```
Combina el status del `@Param` con la paginación del `@Query` y envía todo como payload a `orders-ms`.

**`PATCH /api/orders/:id`** — Cambiar status:
```typescript
@Patch(':id')
changeOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusDto: StatusDto
) {
    return this.orderClient.send('changeOrderStatus', {
      id,
      status: statusDto.status
    });
}
```
Combina el UUID del `@Param` con el status del `@Body`.

### DTOs

#### `create-order.dto.ts`

```typescript
export class CreateOrderDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    // @IsNumber()
    // @IsPositive()
    // totalAmount: number;           ← comentado: se calcula en orders-ms

    // @IsNumber()
    // @IsPositive()
    // totalItems: number;            ← comentado: se calcula en orders-ms

    // @IsEnum(OrderStatusList, ...)
    // @IsOptional()
    // status: OrderStatus = OrderStatus.PENDING;  ← comentado: default en Prisma

    // @IsBoolean()
    // @IsOptional()
    // paid: boolean = false;         ← comentado: default en Prisma
}
```

**Código comentado**: `totalAmount`, `totalItems`, `status` y `paid` se comentaron porque estos valores se **calculan y asignan automáticamente** en `orders-ms`. El gateway solo envía los `items`.

#### `order-item.dto.ts`

```typescript
export class OrderItemDto {
    @IsNumber()
    @IsPositive()
    productId: number;

    @IsNumber()
    @IsPositive()
    quantity: number;

    @IsNumber()
    @IsPositive()
    price: number;
}
```

#### `order-pagination.dto.ts`

```typescript
export class OrderPaginationDto extends PaginationDto {
    @IsOptional()
    @IsEnum(OrderStatusList, {
        message: `Status must be one of the following values: ${Object.values(OrderStatus).join(', ')}`
    })
    status: OrderStatus;
}
```

Extiende `PaginationDto` con filtro opcional por `status`. Usa el enum local `OrderStatus`.

#### `status.dto.ts`

```typescript
export class StatusDto {
    @IsEnum(OrderStatusList, {
        message: `Status must be one of the following values: ${Object.values(OrderStatus).join(', ')}`
    })
    @IsOptional()
    status: OrderStatus;
}
```

DTO reutilizable para recibir el status como `@Param` o `@Body`. Valida que sea un valor del enum `OrderStatus`.

#### `index.ts` (barrel)

Exporta: `CreateOrderDto`, `OrderPaginationDto`, `StatusDto`, `OrderItemDto`.

### `enum/order.enum.ts`

```typescript
export enum OrderStatus {
    PENDING = 'PENDING',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED'
}

export const OrderStatusList = [
    OrderStatus.PENDING,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED
]
```

> **Diferencia con `orders-ms`**: En el gateway, `OrderStatus` se define como un **enum TypeScript local** porque el gateway no tiene Prisma ni acceso al cliente generado. En `orders-ms`, se importa directamente desde `generated/prisma/enums`.

---

## Dockerfile

```dockerfile
FROM node:22-alpine3.19
WORKDIR /usr/src/app
COPY package.json ./
COPY package-lock.json ./
RUN npm install
COPY . .
EXPOSE 3000
```

Imagen basada en **Node.js 22 Alpine**. Expone el puerto `3000` (el puerto HTTP del gateway).

---

## Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env   # (o crear el .env manualmente)

# 3. Asegurarse de que NATS esté corriendo
# (ver docker-compose.yml del proyecto raíz o products-launcher)

# 4. Iniciar en modo desarrollo (watch mode)
npm run start:dev

# 5. Iniciar en producción
npm run build
npm run start:prod
```

### Scripts Disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| `start` | `nest start` | Inicia el gateway |
| `start:dev` | `nest start --watch` | Modo watch (sin migraciones, no hay BD) |
| `start:prod` | `node dist/main` | Ejecuta la versión compilada |
| `build` | `nest build` | Compila el proyecto |

> **Nota**: A diferencia de `product-ms` y `orders-ms`, el script `start:dev` **no** ejecuta migraciones de Prisma porque el gateway no tiene base de datos.

---

## Endpoints REST (API)

Todos los endpoints están prefijados con `/api`.

### Productos (`/api/products`)

| Método | Ruta | Body / Query | Descripción |
|--------|------|-------------|-------------|
| `POST` | `/api/products` | `{ name: string, price: number }` | Crear producto |
| `GET` | `/api/products` | `?page=1&limit=10` | Listar productos paginados |
| `GET` | `/api/products/:id` | — | Obtener producto por ID |
| `PATCH` | `/api/products/:id` | `{ name?: string, price?: number }` | Actualizar producto |
| `DELETE` | `/api/products/:id` | — | Eliminar producto (soft delete) |

### Órdenes (`/api/orders`)

| Método | Ruta | Body / Query | Descripción |
|--------|------|-------------|-------------|
| `POST` | `/api/orders` | `{ items: [{ productId, quantity, price }] }` | Crear orden |
| `GET` | `/api/orders` | `?page=1&limit=10&status=PENDING` | Listar órdenes paginadas |
| `GET` | `/api/orders/id/:id` | — | Obtener orden por UUID |
| `GET` | `/api/orders/:status` | `?page=1&limit=10` | Listar órdenes por status |
| `PATCH` | `/api/orders/:id` | `{ status: 'PENDING' \| 'DELIVERED' \| 'CANCELLED' }` | Cambiar status de orden |

---

## Arquitectura General

```
                        HTTP (REST)                         NATS
┌──────────┐     ┌─────────────────────┐     ┌─────────────────────────────┐
│          │     │                     │     │                             │
│  Cliente │────►│   client-gateway    │────►│        Servidor NATS        │
│  (HTTP)  │◄────│   (Puerto 3000)     │◄────│                             │
│          │     │                     │     │                             │
└──────────┘     │  /api/products/* ───┼────►│──► product-ms (SQLite)      │
                 │  /api/orders/*   ───┼────►│──► orders-ms  (PostgreSQL)  │
                 │                     │     │                             │
                 │  Prefijo: /api      │     │  orders-ms ──► product-ms   │
                 │  Filtro: RpcCustom  │     │  (validate_products)        │
                 │  ExceptionFilter    │     │                             │
                 └─────────────────────┘     └─────────────────────────────┘
```

### Flujo de una petición:

1. El **cliente** envía una petición HTTP al gateway (ej: `POST /api/orders`).
2. El **gateway** valida el body con `ValidationPipe` y los DTOs (`class-validator`).
3. El **controlador** envía un mensaje NATS al microservicio correspondiente con `clientProxy.send()`.
4. El **microservicio** procesa la petición, puede comunicarse con otros microservicios vía NATS (ej: `orders-ms` → `product-ms`).
5. La **respuesta** fluye de vuelta: microservicio → NATS → gateway → cliente HTTP.
6. Si ocurre un **error**, el `RpcCustomExceptionFilter` lo convierte en una respuesta HTTP apropiada.
