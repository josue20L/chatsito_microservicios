import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

// Los id de la BD son BigInt y JSON no sabe serializarlos
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Todo lleva /api, menos las rutas internas y health
  app.setGlobalPrefix('api', { exclude: ['internal/{*path}', 'health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Sin enableCors: el CORS se configura solo en Nginx

  await app.listen(process.env.PORT ?? 3003);
}
bootstrap();
