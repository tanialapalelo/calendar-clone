import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './utils/e2e-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health', async () => {
    await request(app.getHttpServer()).get('/v1/health').expect(200);
  });

  it('GET /v1/db-health', async () => {
    await request(app.getHttpServer()).get('/v1/db-health').expect(200);
  });
});
