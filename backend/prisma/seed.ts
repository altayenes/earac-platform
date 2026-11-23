import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { PrismaClient, UserRole } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ─── 1. Segments (with age/license requirements - Sabit İş Kuralı Referansı) ───
  const segments = await Promise.all([
    prisma.segment.upsert({
      where: { name: 'Economic' },
      update: { minAge: 21, minLicenseYears: 2 },
      create: { name: 'Economic', minAge: 21, minLicenseYears: 2 },
    }),
    prisma.segment.upsert({
      where: { name: 'Medium' },
      update: { minAge: 23, minLicenseYears: 3 },
      create: { name: 'Medium', minAge: 23, minLicenseYears: 3 },
    }),
    prisma.segment.upsert({
      where: { name: 'Premium' },
      update: { minAge: 25, minLicenseYears: 5 },
      create: { name: 'Premium', minAge: 25, minLicenseYears: 5 },
    }),
  ]);
  const [economic, medium, premium] = segments;
  console.log(`  ✅ ${segments.length} segments seeded`);

  // ─── 2. Body Types ───
  const bodyTypes = await Promise.all([
    prisma.bodyType.upsert({ where: { name: 'Sedan' }, update: {}, create: { name: 'Sedan' } }),
    prisma.bodyType.upsert({ where: { name: 'Hatchback' }, update: {}, create: { name: 'Hatchback' } }),
    prisma.bodyType.upsert({ where: { name: 'SUV' }, update: {}, create: { name: 'SUV' } }),
    prisma.bodyType.upsert({ where: { name: 'Station Wagon' }, update: {}, create: { name: 'Station Wagon' } }),
  ]);
  const [sedan, hatchback, suv, stationWagon] = bodyTypes;
  console.log(`  ✅ ${bodyTypes.length} body types seeded`);

  // ─── 3. Fuel Types ───
  const fuelTypes = await Promise.all([
    prisma.fuelType.upsert({ where: { name: 'Benzin' }, update: {}, create: { name: 'Benzin' } }),
    prisma.fuelType.upsert({ where: { name: 'Dizel' }, update: {}, create: { name: 'Dizel' } }),
    prisma.fuelType.upsert({ where: { name: 'Hibrit' }, update: {}, create: { name: 'Hibrit' } }),
    prisma.fuelType.upsert({ where: { name: 'Elektrik' }, update: {}, create: { name: 'Elektrik' } }),
  ]);
  const [benzin, dizel, hibrit, elektrik] = fuelTypes;
  console.log(`  ✅ ${fuelTypes.length} fuel types seeded`);

  // ─── 4. Transmission Types ───
  const transmissionTypes = await Promise.all([
    prisma.transmissionType.upsert({ where: { name: 'Manuel' }, update: {}, create: { name: 'Manuel' } }),
    prisma.transmissionType.upsert({ where: { name: 'Otomatik' }, update: {}, create: { name: 'Otomatik' } }),
  ]);
  const [manuel, otomatik] = transmissionTypes;
  console.log(`  ✅ ${transmissionTypes.length} transmission types seeded`);

  // ─── 5. Brands & Models ───
  const toyota = await prisma.brand.upsert({
    where: { name: 'Toyota' },
    update: {},
    create: { name: 'Toyota' },
  });
  const corolla = await prisma.model.upsert({
    where: { brandId_name: { brandId: toyota.id, name: 'Corolla' } },
    update: {},
    create: { name: 'Corolla', brandId: toyota.id },
  });
  const yaris = await prisma.model.upsert({
    where: { brandId_name: { brandId: toyota.id, name: 'Yaris' } },
    update: {},
    create: { name: 'Yaris', brandId: toyota.id },
  });

  const volkswagen = await prisma.brand.upsert({
    where: { name: 'Volkswagen' },
    update: {},
    create: { name: 'Volkswagen' },
  });
  const passat = await prisma.model.upsert({
    where: { brandId_name: { brandId: volkswagen.id, name: 'Passat' } },
    update: {},
    create: { name: 'Passat', brandId: volkswagen.id },
  });
  const golf = await prisma.model.upsert({
    where: { brandId_name: { brandId: volkswagen.id, name: 'Golf' } },
    update: {},
    create: { name: 'Golf', brandId: volkswagen.id },
  });

  const bmw = await prisma.brand.upsert({
    where: { name: 'BMW' },
    update: {},
    create: { name: 'BMW' },
  });
  const bmw3 = await prisma.model.upsert({
    where: { brandId_name: { brandId: bmw.id, name: '320i' } },
    update: {},
    create: { name: '320i', brandId: bmw.id },
  });
  const bmwX3 = await prisma.model.upsert({
    where: { brandId_name: { brandId: bmw.id, name: 'X3' } },
    update: {},
    create: { name: 'X3', brandId: bmw.id },
  });
  console.log('  ✅ 3 brands, 6 models seeded');

  // ─── 6. Branches (İstanbul Havalimanı Şube & Ankara Esenboğa Havalimanı) ───
  const branches = await Promise.all([
    prisma.branch.upsert({
      where: { name: 'İstanbul Havalimanı Şube' },
      update: {
        address: 'İstanbul Havalimanı İç/Dış Hatlar Terminali, Arnavutköy/İstanbul',
        openingTime: '07:00',
        closingTime: '23:00',
      },
      create: {
        name: 'İstanbul Havalimanı Şube',
        address: 'İstanbul Havalimanı İç/Dış Hatlar Terminali, Arnavutköy/İstanbul',
        openingTime: '07:00',
        closingTime: '23:00',
      },
    }),
    prisma.branch.upsert({
      where: { name: 'Ankara Esenboğa Havalimanı' },
      update: {
        address: 'Esenboğa Havalimanı, 06790 Çubuk/Ankara',
        openingTime: '08:00',
        closingTime: '22:00',
      },
      create: {
        name: 'Ankara Esenboğa Havalimanı',
        address: 'Esenboğa Havalimanı, 06790 Çubuk/Ankara',
        openingTime: '08:00',
        closingTime: '22:00',
      },
    }),
  ]);
  const [istanbulBranch, ankaraBranch] = branches;
  console.log(`  ✅ ${branches.length} branches seeded`);

  // ─── 7. Segment × BodyType Pricing ───
  const pricingData = [
    // Economic
    { segmentId: economic.id, bodyTypeId: sedan.id, dailyPrice: 850.00 },
    { segmentId: economic.id, bodyTypeId: hatchback.id, dailyPrice: 750.00 },
    { segmentId: economic.id, bodyTypeId: suv.id, dailyPrice: 1100.00 },
    // Medium
    { segmentId: medium.id, bodyTypeId: sedan.id, dailyPrice: 1200.00 },
    { segmentId: medium.id, bodyTypeId: hatchback.id, dailyPrice: 1050.00 },
    { segmentId: medium.id, bodyTypeId: suv.id, dailyPrice: 1500.00 },
    { segmentId: medium.id, bodyTypeId: stationWagon.id, dailyPrice: 1350.00 },
    // Premium
    { segmentId: premium.id, bodyTypeId: sedan.id, dailyPrice: 2200.00 },
    { segmentId: premium.id, bodyTypeId: suv.id, dailyPrice: 2800.00 },
  ];
  for (const p of pricingData) {
    await prisma.segmentBodyTypePrice.upsert({
      where: { segmentId_bodyTypeId: { segmentId: p.segmentId, bodyTypeId: p.bodyTypeId } },
      update: { dailyPrice: p.dailyPrice },
      create: p,
    });
  }
  console.log(`  ✅ ${pricingData.length} segment-bodytype prices seeded`);

  // ─── 8. Test Vehicles (8 vehicles) ───
  const vehicleData = [
    { vin: 'TEST00000000000001', licensePlate: '34 AK 001', modelId: corolla.id, segmentId: economic.id, bodyTypeId: sedan.id, fuelTypeId: benzin.id, transmissionId: otomatik.id, branchId: istanbulBranch.id, year: 2024, mileage: 15000 },
    { vin: 'TEST00000000000002', licensePlate: '34 AK 002', modelId: yaris.id, segmentId: economic.id, bodyTypeId: hatchback.id, fuelTypeId: benzin.id, transmissionId: manuel.id, branchId: istanbulBranch.id, year: 2024, mileage: 12000 },
    { vin: 'TEST00000000000003', licensePlate: '34 AK 003', modelId: golf.id, segmentId: economic.id, bodyTypeId: hatchback.id, fuelTypeId: dizel.id, transmissionId: otomatik.id, branchId: istanbulBranch.id, year: 2023, mileage: 28000 },
    { vin: 'TEST00000000000004', licensePlate: '06 AK 001', modelId: passat.id, segmentId: medium.id, bodyTypeId: sedan.id, fuelTypeId: dizel.id, transmissionId: otomatik.id, branchId: ankaraBranch.id, year: 2024, mileage: 20000 },
    { vin: 'TEST00000000000005', licensePlate: '06 AK 002', modelId: corolla.id, segmentId: medium.id, bodyTypeId: sedan.id, fuelTypeId: hibrit.id, transmissionId: otomatik.id, branchId: ankaraBranch.id, year: 2025, mileage: 5000 },
    { vin: 'TEST00000000000006', licensePlate: '34 AK 004', modelId: bmw3.id, segmentId: premium.id, bodyTypeId: sedan.id, fuelTypeId: benzin.id, transmissionId: otomatik.id, branchId: istanbulBranch.id, year: 2025, mileage: 3000 },
    { vin: 'TEST00000000000007', licensePlate: '06 AK 003', modelId: bmwX3.id, segmentId: premium.id, bodyTypeId: suv.id, fuelTypeId: dizel.id, transmissionId: otomatik.id, branchId: ankaraBranch.id, year: 2024, mileage: 18000 },
    { vin: 'TEST00000000000008', licensePlate: '34 AK 005', modelId: passat.id, segmentId: medium.id, bodyTypeId: stationWagon.id, fuelTypeId: dizel.id, transmissionId: otomatik.id, branchId: istanbulBranch.id, year: 2023, mileage: 35000 },
  ];
  for (const v of vehicleData) {
    await prisma.vehicle.upsert({
      where: { vin: v.vin },
      update: {
        licensePlate: v.licensePlate,
        branchId: v.branchId,
        mileage: v.mileage,
        year: v.year,
      },
      create: v,
    });
  }
  console.log(`  ✅ ${vehicleData.length} test vehicles seeded`);

  // ─── 9. Super Admin User (Telefon: +905000000001, Giriş: Telefon + Parola) ───
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!Test';
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const adminPhone = '+905000000001';
  const adminEmail = 'admin@arackiralama.local';

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      email: adminEmail,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      email: adminEmail,
      phone: adminPhone,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      staffPermission: {
        create: {
          canManageVehicles: true,
          canManageReservations: true,
          canManageUsers: true,
          canManageBranches: true,
          canManagePricing: true,
        },
      },
    },
  });
  console.log(`  ✅ Super admin user seeded (Phone: ${adminPhone}, Email: ${adminEmail})`);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
