import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo api excluyendo internal, health y socket.io
  app.setGlobalPrefix('api', { exclude: ['internal/{*path}', 'health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Sin enableCors: el CORS se configura solo en Nginx
  // IoAdapter es el default, no necesita configuración manual

  await app.listen(process.env.PORT ?? 3006);
}
bootstrap();
