import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create a Manager User
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash('password123', salt);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@sportivo.com' },
    update: {},
    create: {
      name: 'Admin Manager',
      email: 'manager@sportivo.com',
      password_hash,
      role: 'MANAGER',
      phone: '081234567890'
    },
  });

  // 2. Create mock facilities
  const facilitiesData = [
    {
      name: 'Gelora Bung Karno Futsal',
      description: 'Premium indoor futsal court with synthetic grass and excellent lighting.',
      address: 'Jl. Pintu Satu Senayan',
      city: 'Jakarta Pusat',
      sport_type: 'Futsal',
      price_per_hour: 250000,
      images: ['https://example.com/gbk-futsal.jpg'],
      operating_hours: {
        monday: { open: '08:00', close: '23:00' },
        tuesday: { open: '08:00', close: '23:00' },
        wednesday: { open: '08:00', close: '23:00' },
        thursday: { open: '08:00', close: '23:00' },
        friday: { open: '08:00', close: '24:00' },
        saturday: { open: '06:00', close: '24:00' },
        sunday: { open: '06:00', close: '23:00' }
      },
      manager_id: manager.id,
    },
    {
      name: 'Cilandak Sport Center - Badminton',
      description: 'Spacious badminton courts with wooden flooring and good ventilation.',
      address: 'Jl. TB Simatupang',
      city: 'Jakarta Selatan',
      sport_type: 'Badminton',
      price_per_hour: 75000,
      images: ['https://example.com/cilandak-badminton.jpg'],
      operating_hours: {
        monday: { open: '07:00', close: '22:00' },
        tuesday: { open: '07:00', close: '22:00' },
        wednesday: { open: '07:00', close: '22:00' },
        thursday: { open: '07:00', close: '22:00' },
        friday: { open: '07:00', close: '23:00' },
        saturday: { open: '06:00', close: '23:00' },
        sunday: { open: '06:00', close: '22:00' }
      },
      manager_id: manager.id,
    },
    {
      name: 'Depok Basketball Arena',
      description: 'Standard outdoor basketball court perfect for weekend games with friends.',
      address: 'Jl. Margonda Raya',
      city: 'Depok',
      sport_type: 'Basketball',
      price_per_hour: 150000,
      images: ['https://example.com/depok-basketball.jpg'],
      operating_hours: {
        monday: { open: '08:00', close: '20:00' },
        tuesday: { open: '08:00', close: '20:00' },
        wednesday: { open: '08:00', close: '20:00' },
        thursday: { open: '08:00', close: '20:00' },
        friday: { open: '08:00', close: '22:00' },
        saturday: { open: '07:00', close: '22:00' },
        sunday: { open: '07:00', close: '20:00' }
      },
      manager_id: manager.id,
    }
  ];

  for (const facility of facilitiesData) {
    await prisma.facility.create({
      data: facility
    });
  }

  console.log('Database seeded successfully with manager and facilities.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
