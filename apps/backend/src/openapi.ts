/**
 * OpenAPI 문서 생성기 (Phase 0 — 프론트 코드젠 SSOT).
 *
 * AppModule 을 부팅(listen 없이)하여 라우트·DTO 메타데이터로 OpenAPI 3 문서를 만들고
 * `openapi.json` 으로 출력한다. 프론트(console: openapi-typescript, Flutter: openapi-generator)가 이를 소비한다.
 *
 * 실행: `pnpm --filter backend openapi:gen` (NODE_ENV=production 강제 — pino-pretty 회피).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('DOA Market API')
    .setDescription('DOA Market 백엔드 HTTP 계약 (프론트 코드젠 SSOT).')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outPath = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  // eslint-disable-next-line no-console
  console.log(`OpenAPI document written: ${outPath}`);
  console.log(`paths: ${Object.keys(document.paths ?? {}).length}`);

  await app.close();
}

generate()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('OpenAPI generation failed', err);
    process.exit(1);
  });
