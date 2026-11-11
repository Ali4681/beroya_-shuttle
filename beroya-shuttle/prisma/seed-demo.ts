import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const SCHOOL_ADMIN = '+963910010010';
const UNI_ADMIN = '+963910010020';

async function main(): Promise<void> {
  const existing = await prisma.institution.findFirst({
    where: { name: 'Demo Al Houssein School' },
  });
  if (existing) {
    console.log(`Demo seed already applied: ${existing.id}`);
    return;
  }

  const now = new Date();
  const school = await prisma.institution.create({
    data: {
      name: 'Demo Al Houssein School',
      type: 'SCHOOL',
      operationModel: 'BEROYA_OPERATED',
      status: 'ACTIVE',
      settings: { create: {} },
      branding: { create: { supportPhone: '+963110010010' } },
    },
  });
  const schoolMain = await prisma.institutionBranch.create({
    data: {
      institutionId: school.id,
      name: 'Aziziyeh',
      latitude: 36.207,
      longitude: 37.152,
    },
  });
  const schoolSecond = await prisma.institutionBranch.create({
    data: {
      institutionId: school.id,
      name: 'New Aleppo',
      latitude: 36.2,
      longitude: 37.107,
    },
  });
  const schoolAdmin = await prisma.shuttleUser.create({
    data: {
      fullName: 'Demo School Admin',
      phone: SCHOOL_ADMIN,
      role: 'INSTITUTION_ADMIN',
      institutionId: school.id,
      branchId: schoolMain.id,
      phoneVerifiedAt: now,
    },
  });
  await prisma.institution.update({
    where: { id: school.id },
    data: { primaryAdminUserId: schoolAdmin.id },
  });
  await prisma.institutionSubscription.create({
    data: {
      institutionId: school.id,
      billingPeriod: 'MONTHLY',
      status: 'ACTIVE',
      startsAt: now,
      endsAt: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000),
      agreedAmount: 250,
      activatedAt: now,
    },
  });

  const parent = await prisma.shuttleUser.create({
    data: {
      fullName: 'Demo Parent',
      phone: '+963910010011',
      role: 'PARENT',
      institutionId: school.id,
      branchId: schoolMain.id,
    },
  });
  const students = Array.from({ length: 30 }, (_, index) => ({
    id: randomUUID(),
    institutionId: school.id,
    branchId: index < 20 ? schoolMain.id : schoolSecond.id,
    fullName: `Demo Student ${String(index + 1).padStart(2, '0')}`,
    guardianUserId: parent.id,
    grade: String(1 + (index % 6)),
    createdAt: now,
    updatedAt: now,
  }));
  await prisma.schoolStudent.createMany({ data: students });

  const driverUser = await prisma.shuttleUser.create({
    data: {
      fullName: 'Demo Driver',
      phone: '+963910010012',
      role: 'DRIVER',
      institutionId: school.id,
      branchId: schoolMain.id,
    },
  });
  const driver = await prisma.driverProfile.create({
    data: {
      userId: driverUser.id,
      institutionId: school.id,
      ownerType: 'INSTITUTION',
    },
  });
  const attendantUser = await prisma.shuttleUser.create({
    data: {
      fullName: 'Demo Attendant',
      phone: '+963910010013',
      role: 'ATTENDANT',
      institutionId: school.id,
      branchId: schoolMain.id,
    },
  });
  await prisma.attendantProfile.create({
    data: {
      userId: attendantUser.id,
      institutionId: school.id,
    },
  });
  const vehicle = await prisma.shuttleVehicle.create({
    data: {
      institutionId: school.id,
      ownerType: 'INSTITUTION',
      plateNumber: 'DEMO-S-01',
      capacity: 30,
      updatedAt: now,
    },
  });

  for (const [index, name] of ['Morning A', 'Morning B', 'Afternoon'].entries()) {
    await prisma.shuttleRoute.create({
      data: {
        institutionId: school.id,
        branchId: index === 2 ? schoolSecond.id : schoolMain.id,
        name,
        originLat: 36.207,
        originLng: 37.152,
        defaultDriverId: driver.id,
        defaultVehicleId: vehicle.id,
      },
    });
  }

  const uni = await prisma.institution.create({
    data: {
      name: 'Demo Aleppo University',
      type: 'UNIVERSITY',
      operationModel: 'INSTITUTION_OPERATED',
      status: 'ACTIVE',
      settings: { create: {} },
      branding: { create: { supportPhone: '+963110010020' } },
    },
  });
  const uniBranch = await prisma.institutionBranch.create({
    data: {
      institutionId: uni.id,
      name: 'Main',
      latitude: 36.211,
      longitude: 37.137,
    },
  });
  const uniAdmin = await prisma.shuttleUser.create({
    data: {
      fullName: 'Demo University Admin',
      phone: UNI_ADMIN,
      role: 'INSTITUTION_ADMIN',
      institutionId: uni.id,
      branchId: uniBranch.id,
      phoneVerifiedAt: now,
    },
  });
  await prisma.institution.update({
    where: { id: uni.id },
    data: { primaryAdminUserId: uniAdmin.id },
  });
  await prisma.institutionSubscription.create({
    data: {
      institutionId: uni.id,
      billingPeriod: 'TERM',
      status: 'ACTIVE',
      startsAt: now,
      endsAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      agreedAmount: 400,
      activatedAt: now,
    },
  });

  console.log(
    `Demo seed ready — school ${school.id} (${SCHOOL_ADMIN}), university ${uni.id} (${UNI_ADMIN})`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
