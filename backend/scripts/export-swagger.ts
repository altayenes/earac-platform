import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env before NestJS bootstrap
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function exportSwagger() {
  // Prevent database connection attempt during static OpenAPI JSON export
  PrismaService.prototype.onModuleInit = async () => {};

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('AracKiralama API')
    .setDescription(
      'AracKiralama Sistemi Backend RESTful API Sözleşmesi – NestJS + Prisma + PostgreSQL',
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
  const outputPath = path.resolve(process.cwd(), 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`✅ OpenAPI JSON başarıyla dışa aktarıldı: ${outputPath}`);
  await app.close();
  process.exit(0);
}

exportSwagger().catch((err) => {
  console.error('❌ Swagger export failed:', err);
  process.exit(1);
});
