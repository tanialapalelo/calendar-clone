import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@calendar-clone.local' },
    update: {},
    create: {
      email: 'demo@calendar-clone.local',
      name: 'Demo User',
      calendars: {
        create: [
          {
            name: 'Personal',
            color: '#3b82f6',
            events: {
              create: [
                {
                  title: 'All-day example',
                  allDay: true,
                  startAt: new Date('2026-01-25T00:00:00.000Z'),
                  endAt: new Date('2026-01-26T00:00:00.000Z'),
                  timeZone: 'UTC',
                },
                {
                  title: 'Timed example',
                  allDay: false,
                  startAt: new Date('2026-01-25T15:00:00.000Z'),
                  endAt: new Date('2026-01-25T16:00:00.000Z'),
                  timeZone: 'UTC',
                },
              ],
            },
          },
        ],
      },
    },
    include: { calendars: true },
  });

  console.log('Seeded user:', user.email);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
