import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { UserRole } from '@prisma/client';

export interface TestAppInstance {
  app: INestApplication;
  baseUrl: string;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestAppInstance> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(0);
  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'string' ? address : address?.port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const prisma = app.get(PrismaService);

  return { app, baseUrl, prisma };
}

export function generateValidTcKimlikNo(): string {
  const digits = [Math.floor(1 + Math.random() * 9)];
  for (let i = 1; i < 9; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  let d10 = (odd * 7 - even) % 10;
  if (d10 < 0) d10 += 10;
  digits.push(d10);
  const sum10 = digits.reduce((a, b) => a + b, 0);
  digits.push(sum10 % 10);
  return digits.join('');
}

export function generateRandomPhone(): string {
  const rand = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `+9053${rand.substring(0, 8)}`;
}

export interface HttpResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export async function apiRequest<T = any>(
  baseUrl: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: {
    body?: any;
    token?: string;
    headers?: Record<string, string>;
  },
): Promise<HttpResponse<T>> {
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  if (options?.token) {
    reqHeaders['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let body: any = null;
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  return {
    status: res.status,
    body,
    headers: res.headers,
  };
}

export interface TestCustomer {
  userId: string;
  phone: string;
  email: string;
  password: string;
  accessToken: string;
  tcKimlikNo: string;
}

export async function registerAndVerifyCustomer(
  baseUrl: string,
  prisma: PrismaService,
  overrides?: {
    phone?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    licenseDate?: string;
    nationalId?: string;
  },
): Promise<TestCustomer> {
  const phone = overrides?.phone || generateRandomPhone();
  const email = overrides?.email || `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}@test.local`;
  const password = overrides?.password || 'GuvenliParola123!';
  const tcKimlikNo = overrides?.nationalId || generateValidTcKimlikNo();
  const firstName = overrides?.firstName || 'Ahmet';
  const lastName = overrides?.lastName || 'Yılmaz';
  const birthDate = overrides?.birthDate || '1995-05-15'; // 31+ years old
  const licenseDate = overrides?.licenseDate || '2015-08-20'; // 10+ years license

  // 1. Insert SMS verification code in DB (avoids consuming global IP throttler quota)
  const smsCode = '123456';
  await prisma.smsVerificationCode.create({
    data: {
      phone,
      purpose: 'REGISTER',
      code: smsCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      maxAttempts: 3,
    },
  });

  // 2. Register
  const regRes = await apiRequest(baseUrl, 'POST', '/auth/register', {
    body: {
      phone,
      email,
      password,
      smsCode,
    },
  });
  if (regRes.status !== 201) {
    throw new Error(`Failed to register: ${JSON.stringify(regRes.body)}`);
  }

  const accessToken = regRes.body.accessToken;
  const userId = regRes.body.user.id;

  // 4. Create KYC Profile
  const profileRes = await apiRequest(baseUrl, 'PUT', '/users/me/profile', {
    token: accessToken,
    body: {
      firstName,
      lastName,
      birthDate,
      licenseDate,
      nationalId: tcKimlikNo,
    },
  });
  if (profileRes.status !== 200 && profileRes.status !== 201) {
    throw new Error(`Failed to create KYC profile: ${JSON.stringify(profileRes.body)}`);
  }

  return {
    userId,
    phone,
    email,
    password,
    accessToken,
    tcKimlikNo,
  };
}

export async function getSuperAdminToken(
  baseUrl: string,
): Promise<{ accessToken: string; userId: string }> {
  const adminPhone = '+905000000001';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!Test';

  const loginRes = await apiRequest(baseUrl, 'POST', '/auth/login', {
    body: {
      phone: adminPhone,
      password: adminPassword,
    },
  });

  if (loginRes.status !== 200) {
    throw new Error(`Super admin login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return {
    accessToken: loginRes.body.accessToken,
    userId: loginRes.body.user.id,
  };
}

export async function createTestStaff(
  baseUrl: string,
  prisma: PrismaService,
  permissions: {
    canManageVehicles?: boolean;
    canManageReservations?: boolean;
    canManageUsers?: boolean;
    canManageBranches?: boolean;
    canManagePricing?: boolean;
  },
): Promise<{ userId: string; accessToken: string; phone: string }> {
  const phone = generateRandomPhone();
  const email = `staff_${Date.now()}_${Math.floor(Math.random() * 1000)}@test.local`;
  const password = 'StaffPassword123!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      phone,
      email,
      passwordHash,
      role: UserRole.STAFF,
      staffPermission: {
        create: {
          canManageVehicles: permissions.canManageVehicles ?? false,
          canManageReservations: permissions.canManageReservations ?? false,
          canManageUsers: permissions.canManageUsers ?? false,
          canManageBranches: permissions.canManageBranches ?? false,
          canManagePricing: permissions.canManagePricing ?? false,
        },
      },
    },
  });

  // Login to get access token
  const loginRes = await apiRequest(baseUrl, 'POST', '/auth/login', {
    body: { phone, password },
  });

  return {
    userId: user.id,
    accessToken: loginRes.body.accessToken,
    phone,
  };
}

export async function cleanupTestData(
  prisma: PrismaService,
  userIds: string[],
  reservationIds: string[] = [],
): Promise<void> {
  try {
    if (reservationIds.length > 0) {
      await prisma.returnRecord.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.handoverRecord.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.payment.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.reservationStatusHistory.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.reservationPriceSnapshot.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.reservationChangeRequest.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: reservationIds } },
      });
    }

    if (userIds.length > 0) {
      // Find all reservations owned by these users
      const userRes = await prisma.reservation.findMany({
        where: { customerId: { in: userIds } },
        select: { id: true },
      });
      const userResIds = userRes.map((r) => r.id);

      if (userResIds.length > 0) {
        await prisma.returnRecord.deleteMany({
          where: { reservationId: { in: userResIds } },
        });
        await prisma.handoverRecord.deleteMany({
          where: { reservationId: { in: userResIds } },
        });
        await prisma.payment.deleteMany({
          where: { reservationId: { in: userResIds } },
        });
        await prisma.reservationStatusHistory.deleteMany({
          where: { reservationId: { in: userResIds } },
        });
        await prisma.reservationPriceSnapshot.deleteMany({
          where: { reservationId: { in: userResIds } },
        });
        await prisma.reservationChangeRequest.deleteMany({
          where: { reservationId: { in: userResIds } },
        });
        await prisma.reservation.deleteMany({
          where: { id: { in: userResIds } },
        });
      }

      await prisma.customerProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.staffPermission.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { performedByUserId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  } catch (err) {
    // Non-fatal cleanup log
    console.error('Error during cleanupTestData:', err);
  }
}
