/**
 * 006 search·notification·file 통합 부팅 테스트 — [env:integration]
 *
 * 목적 (PATCH-01):
 *   SearchModule·NotificationModule·FileModule 이 AppModule 에 정상 등록되어
 *   DI 그래프가 깨지지 않고 부팅되는지 검증한다.
 *
 * 검증:
 *   - GET /search/products → 200 + {items,total,page,size} (공개, 인증 불필요)
 *   - GET /notifications (no token) → 401 (인증 필수 라우트 등록 확인)
 *   - POST /files/presign (no token) → 401 (인증 필수 라우트 등록 확인)
 *
 * 실행 전제: PostgreSQL 기동 + 마이그레이션 적용 + .env 환경변수.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('006 search/notification/file (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SearchModule', () => {
    it('when_get_search_products_then_200_with_page_meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/search/products')
        .query({ size: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toMatchObject({ page: 1, size: 5 });
    });

    it('when_invalid_sort_then_400', async () => {
      const res = await request(app.getHttpServer())
        .get('/search/products')
        .query({ sort: 'not_a_sort' });

      expect(res.status).toBe(400);
    });
  });

  describe('NotificationModule', () => {
    it('when_get_notifications_without_token_then_401', async () => {
      const res = await request(app.getHttpServer()).get('/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('FileModule', () => {
    it('when_presign_without_token_then_401', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .send({ purpose: 'PRODUCT_IMAGE', contentType: 'image/png' });
      expect(res.status).toBe(401);
    });
  });
});
