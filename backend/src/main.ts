import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { validateEnvironment } from './common/config/env.validation';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  // Fail-Fast: Zorunlu ortam değişkenlerini uygulama başlamadan önce doğrula
  validateEnvironment();

  const app = await NestFactory.create(AppModule);

  // OWASP Security Headers (Helmet)
  app.use(helmet());

  // Express Request Body Payload Limiti (100kb)
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  // Cookie Parser for HttpOnly refresh tokens
  app.use(cookieParser());

  // Global prefix for all API routes: /api/*
  app.setGlobalPrefix('api');

  // Global Exception Filter: Veritabanı iç detaylarını ve 500 stack trace'leri gizleyen standart hata zarfı
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Swagger / OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('EAraç Kiralama API')
    .setDescription(
      'EAraç Kiralama Sistemi Backend RESTful API Sözleşmesi – NestJS + Prisma + PostgreSQL',
    )
    .setVersion('0.3.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '15 dakikalık JWT Erişim Belirteci',
      },
      'bearer',
    )
    .addCookieAuth('jid', {
      type: 'apiKey',
      in: 'cookie',
      name: 'jid',
      description: '7 günlük HttpOnly Refresh Token çerezi',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Backend running on http://localhost:${port}/api`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
