import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createE2eApp } from './utils/e2e-app';
import { makeAuthCookie } from './utils/auth-cookie';

describe('Events (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let userId: string;
  let calendarId: string;
  let authCookie: string;

  beforeAll(async () => {
    // Ensure these exist for guard/cookie logic during tests
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.COOKIE_NAME = process.env.COOKIE_NAME ?? 'access_token';

    app = await createE2eApp();
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    // Reset DB state for deterministic tests
    await prisma.event.deleteMany();
    await prisma.calendar.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'e2e@example.com',
        name: 'E2E User',
        googleSub: 'e2e-google-sub',
      },
    });

    userId = user.id;

    const calendar = await prisma.calendar.create({
      data: {
        ownerId: userId,
        name: 'Default',
        color: '#0B57D0',
      },
    });

    calendarId = calendar.id;
    authCookie = makeAuthCookie({ userId, email: user.email });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /v1/events returns 401 when not authenticated', async () => {
    await request(app.getHttpServer()).get('/v1/events').expect(401);
  });

  it('POST /v1/events returns 401 when not authenticated', async () => {
    await request(app.getHttpServer())
      .post('/v1/events')
      .send({
        title: 'No auth',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 60_000).toISOString(),
        allDay: false,
        calendarId,
      })
      .expect(401);
  });

  it('creates, lists, updates, and deletes an event', async () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-02-01T00:00:00.000Z');

    // CREATE
    const createRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Cookie', authCookie)
      .send({
        title: 'My Event',
        startAt: '2026-01-15T10:00:00.000Z',
        endAt: '2026-01-15T11:00:00.000Z',
        allDay: false,
        description: 'desc',
        location: 'somewhere',
        calendarId,
      })
      .expect(201);

    const created = createRes.body as { id: string; title: string };
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('My Event');

    // LIST
    const listRes = await request(app.getHttpServer())
      .get('/v1/events')
      .set('Cookie', authCookie)
      .query({ from: from.toISOString(), to: to.toISOString() })
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((e: any) => e.id === created.id)).toBe(true);

    // UPDATE (PATCH)
    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/events/${created.id}`)
      .set('Cookie', authCookie)
      .send({ title: 'Updated Title' })
      .expect(200);

    expect(patchRes.body.title).toBe('Updated Title');

    // DELETE
    await request(app.getHttpServer())
      .delete(`/v1/events/${created.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    // LIST again => deleted
    const listAfter = await request(app.getHttpServer())
      .get('/v1/events')
      .set('Cookie', authCookie)
      .query({ from: from.toISOString(), to: to.toISOString() })
      .expect(200);

    expect(listAfter.body.some((e: any) => e.id === created.id)).toBe(false);
  });

  it("returns 403 when modifying another user's event", async () => {
    // Create an event owned by user A (the default setup user)
    const createRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Cookie', authCookie)
      .send({
        title: 'User A Event',
        startAt: '2026-01-10T10:00:00.000Z',
        endAt: '2026-01-10T11:00:00.000Z',
        allDay: false,
        calendarId,
      })
      .expect(201);

    const eventId = createRes.body.id as string;

    // Create user B + calendar B
    const userB = await prisma.user.create({
      data: {
        email: 'e2e-b@example.com',
        name: 'E2E User B',
        googleSub: 'e2e-google-sub-b',
      },
    });

    const calendarB = await prisma.calendar.create({
      data: {
        ownerId: userB.id,
        name: 'B Default',
        color: '#188038',
      },
    });

    const cookieB = makeAuthCookie({ userId: userB.id, email: userB.email });

    // User B tries to update User A's event -> 403
    await request(app.getHttpServer())
      .patch(`/v1/events/${eventId}`)
      .set('Cookie', cookieB)
      .send({ title: 'Hacked' })
      .expect(403);

    // User B tries to delete User A's event -> 403
    await request(app.getHttpServer())
      .delete(`/v1/events/${eventId}`)
      .set('Cookie', cookieB)
      .expect(403);

    // (Optional) sanity: User B can create their own event in their calendar
    await request(app.getHttpServer())
      .post('/v1/events')
      .set('Cookie', cookieB)
      .send({
        title: 'User B Event',
        startAt: '2026-01-12T10:00:00.000Z',
        endAt: '2026-01-12T11:00:00.000Z',
        calendarId: calendarB.id,
      })
      .expect(201);
  });

  it('PATCH /v1/events/:id returns 400 when endAt <= startAt', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Cookie', authCookie)
      .send({
        title: 'Test',
        startAt: '2026-01-15T10:00:00.000Z',
        endAt: '2026-01-15T11:00:00.000Z',
        calendarId,
      })
      .expect(201);

    const eventId = createRes.body.id as string;

    await request(app.getHttpServer())
      .patch(`/v1/events/${eventId}`)
      .set('Cookie', authCookie)
      .send({
        startAt: '2026-01-15T12:00:00.000Z',
        endAt: '2026-01-15T11:00:00.000Z',
      })
      .expect(400);
  });

  it('PATCH /v1/events/:id validates partial updates against existing values', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Cookie', authCookie)
      .send({
        title: 'Test',
        startAt: '2026-01-15T10:00:00.000Z',
        endAt: '2026-01-15T11:00:00.000Z',
        calendarId,
      })
      .expect(201);

    const eventId = createRes.body.id as string;

    // Only endAt provided, but it becomes invalid vs existing startAt
    await request(app.getHttpServer())
      .patch(`/v1/events/${eventId}`)
      .set('Cookie', authCookie)
      .send({
        endAt: '2026-01-15T09:00:00.000Z',
      })
      .expect(400);
  });

  it('PATCH /v1/events/:id can update timeZone', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Cookie', authCookie)
      .send({
        title: 'TZ Event',
        startAt: '2026-01-15T10:00:00.000Z',
        endAt: '2026-01-15T11:00:00.000Z',
        calendarId,
        timeZone: 'UTC',
      })
      .expect(201);

    const eventId = createRes.body.id as string;

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/events/${eventId}`)
      .set('Cookie', authCookie)
      .send({ timeZone: 'America/Los_Angeles' })
      .expect(200);

    expect(patchRes.body.timeZone).toBe('America/Los_Angeles');
  });
});
