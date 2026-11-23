import {
  createTestApp,
  TestAppInstance,
  apiRequest,
  registerAndVerifyCustomer,
  getSuperAdminToken,
  createTestStaff,
  cleanupTestData,
  TestCustomer,
  generateRandomPhone,
} from './test-helper';

describe('E2E Security Negative & Access Control Test Suite', () => {
  let instance: TestAppInstance;
  let adminToken: string;
  const createdUserIds: string[] = [];
  const createdReservationIds: string[] = [];

  beforeAll(async () => {
    instance = await createTestApp();
    const admin = await getSuperAdminToken(instance.baseUrl);
    adminToken = admin.accessToken;
  }, 35000);

  afterAll(async () => {
    if (instance) {
      await cleanupTestData(instance.prisma, createdUserIds, createdReservationIds);
      await instance.app.close();
    }
  });

  // ─── 1. IDOR Koruması (403 Forbidden) ───
  describe('IDOR (Insecure Direct Object Reference) Protection', () => {
    let customerA: TestCustomer;
    let customerB: TestCustomer;
    let reservationAId: string;

    beforeAll(async () => {
      customerA = await registerAndVerifyCustomer(instance.baseUrl, instance.prisma);
      createdUserIds.push(customerA.userId);

      customerB = await registerAndVerifyCustomer(instance.baseUrl, instance.prisma);
      createdUserIds.push(customerB.userId);

      // Branch & Specs for reservation
      const branch = await instance.prisma.branch.findFirst();
      const segment = await instance.prisma.segment.findUnique({ where: { name: 'Economic' } });
      const bodyType = await instance.prisma.bodyType.findUnique({ where: { name: 'Sedan' } });
      const fuelType = await instance.prisma.fuelType.findUnique({ where: { name: 'Benzin' } });
      const trans = await instance.prisma.transmissionType.findUnique({ where: { name: 'Otomatik' } });

      const pickup = new Date('2027-09-01T10:00:00.000Z');
      const ret = new Date('2027-09-03T10:00:00.000Z');

      const res = await apiRequest(instance.baseUrl, 'POST', '/reservations', {
        token: customerA.accessToken,
        body: {
          branchId: branch!.id,
          segmentId: segment!.id,
          bodyTypeId: bodyType!.id,
          fuelTypeId: fuelType!.id,
          transmissionId: trans!.id,
          plannedPickupAt: pickup.toISOString(),
          plannedReturnAt: ret.toISOString(),
        },
      });

      expect(res.status).toBe(201);
      reservationAId = res.body.id;
      createdReservationIds.push(reservationAId);
    });

    it('IDOR 1: Customer B cannot inspect Customer A reservation -> 403 Forbidden', async () => {
      const res = await apiRequest(
        instance.baseUrl,
        'GET',
        `/reservations/${reservationAId}`,
        { token: customerB.accessToken },
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/yetkiniz bulunmamaktadır/i);
    });

    it('IDOR 2: Customer B cannot cancel Customer A reservation -> 403 Forbidden', async () => {
      const res = await apiRequest(
        instance.baseUrl,
        'POST',
        `/reservations/${reservationAId}/cancel`,
        {
          token: customerB.accessToken,
          body: { reason: 'Unauthorized cancellation attempt' },
        },
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/kendi rezervasyonunuzu/i);
    });

    it('IDOR 3: Customer B cannot charge/pay for Customer A reservation -> 403 Forbidden', async () => {
      const res = await apiRequest(
        instance.baseUrl,
        'POST',
        '/payments/charge',
        {
          token: customerB.accessToken,
          body: {
            reservationId: reservationAId,
            idempotencyKey: `idem_idor_${Date.now()}`,
          },
        },
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/kendi rezervasyonunuz için ödeme/i);
    });
  });

  // ─── 2. Yetkisiz Personel Erişimi (403 Forbidden) ───
  describe('Unauthorized Staff Access Control', () => {
    let unprivStaffToken: string;

    beforeAll(async () => {
      const staff = await createTestStaff(instance.baseUrl, instance.prisma, {
        canManageVehicles: false,
        canManageReservations: true,
      });
      createdUserIds.push(staff.userId);
      unprivStaffToken = staff.accessToken;
    });

    it('Staff with canManageVehicles=false cannot create a vehicle -> 403 Forbidden', async () => {
      const branch = await instance.prisma.branch.findFirst();
      const model = await instance.prisma.model.findFirst();
      const segment = await instance.prisma.segment.findFirst();
      const bodyType = await instance.prisma.bodyType.findFirst();
      const fuelType = await instance.prisma.fuelType.findFirst();
      const trans = await instance.prisma.transmissionType.findFirst();

      const res = await apiRequest(instance.baseUrl, 'POST', '/admin/vehicles', {
        token: unprivStaffToken,
        body: {
          vin: 'TEST1234567890123',
          licensePlate: '34 HACK 01',
          modelId: model!.id,
          segmentId: segment!.id,
          bodyTypeId: bodyType!.id,
          fuelTypeId: fuelType!.id,
          transmissionId: trans!.id,
          branchId: branch!.id,
          year: 2024,
          mileage: 1000,
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/canManageVehicles yetkisi gereklidir/i);
    });

    it('Staff with canManageVehicles=false cannot deactivate reference data -> 403 Forbidden', async () => {
      const model = await instance.prisma.model.findFirst();

      const res = await apiRequest(
        instance.baseUrl,
        'PATCH',
        `/admin/vehicles/references/models/${model!.id}/deactivate`,
        { token: unprivStaffToken },
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/canManageVehicles yetkisi gereklidir/i);
    });
  });

  // ─── 3. Filo Kilitleme Engeli (409 Conflict) ───
  describe('Fleet Lock Protection (OWASP API6)', () => {
    let customer: TestCustomer;

    beforeAll(async () => {
      customer = await registerAndVerifyCustomer(instance.baseUrl, instance.prisma);
      createdUserIds.push(customer.userId);

      const branch = await instance.prisma.branch.findFirst();
      const segment = await instance.prisma.segment.findUnique({ where: { name: 'Economic' } });
      const bodyType = await instance.prisma.bodyType.findUnique({ where: { name: 'Sedan' } });
      const fuelType = await instance.prisma.fuelType.findUnique({ where: { name: 'Benzin' } });
      const trans = await instance.prisma.transmissionType.findUnique({ where: { name: 'Otomatik' } });

      const res = await apiRequest(instance.baseUrl, 'POST', '/reservations', {
        token: customer.accessToken,
        body: {
          branchId: branch!.id,
          segmentId: segment!.id,
          bodyTypeId: bodyType!.id,
          fuelTypeId: fuelType!.id,
          transmissionId: trans!.id,
          plannedPickupAt: '2027-10-01T10:00:00.000Z',
          plannedReturnAt: '2027-10-03T10:00:00.000Z',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.state).toBe('PENDING_PAYMENT');
      createdReservationIds.push(res.body.id);
    });

    it('Customer with active PENDING_PAYMENT reservation cannot open a second hold -> 409 Conflict', async () => {
      const branch = await instance.prisma.branch.findFirst();
      const segment = await instance.prisma.segment.findUnique({ where: { name: 'Economic' } });
      const bodyType = await instance.prisma.bodyType.findUnique({ where: { name: 'Hatchback' } });
      const fuelType = await instance.prisma.fuelType.findUnique({ where: { name: 'Benzin' } });
      const trans = await instance.prisma.transmissionType.findUnique({ where: { name: 'Manuel' } });

      const res = await apiRequest(instance.baseUrl, 'POST', '/reservations', {
        token: customer.accessToken,
        body: {
          branchId: branch!.id,
          segmentId: segment!.id,
          bodyTypeId: bodyType!.id,
          fuelTypeId: fuelType!.id,
          transmissionId: trans!.id,
          plannedPickupAt: '2027-11-01T10:00:00.000Z',
          plannedReturnAt: '2027-11-03T10:00:00.000Z',
        },
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Aktif bir ödeme süreciniz bulunmaktadır/i);
    });
  });

  // ─── 4. Korunan Profil Alanları Değiştirilemezlik ───
  describe('KYC Profile Immutability Protection', () => {
    let customer: TestCustomer;

    beforeAll(async () => {
      customer = await registerAndVerifyCustomer(instance.baseUrl, instance.prisma, {
        firstName: 'OrijinalAd',
        lastName: 'OrijinalSoyad',
      });
      createdUserIds.push(customer.userId);
    });

    it('PATCH /api/users/me/profile rejects unauthorized KYC fields -> 400 Bad Request', async () => {
      const res = await apiRequest(instance.baseUrl, 'PATCH', '/users/me/profile', {
        token: customer.accessToken,
        body: {
          firstName: 'DegistirilmisAd',
          lastName: 'DegistirilmisSoyad',
          nationalId: '12345678901',
          birthDate: '1990-01-01',
        },
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/should not exist|property/i);

      // Verify DB record is untouched
      const profile = await instance.prisma.customerProfile.findUnique({
        where: { userId: customer.userId },
      });
      expect(profile!.firstName).toBe('OrijinalAd');
      expect(profile!.lastName).toBe('OrijinalSoyad');
    });

    it('PUT /api/users/me/profile prevents rewriting existing KYC profile -> 400 Bad Request', async () => {
      const res = await apiRequest(instance.baseUrl, 'PUT', '/users/me/profile', {
        token: customer.accessToken,
        body: {
          firstName: 'IkinciDeneme',
          lastName: 'Soyad',
          birthDate: '1992-01-01',
          licenseDate: '2014-01-01',
          nationalId: customer.tcKimlikNo,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Müşteri profiliniz zaten mevcuttur/i);
    });
  });

  // ─── 5. Public Uçlarda Veri Gizliliği ───
  describe('Public Endpoints Data Privacy (No VIN, No License Plate)', () => {
    it('GET /api/vehicles list: neither licensePlate nor vin is exposed', async () => {
      const res = await apiRequest(instance.baseUrl, 'GET', '/vehicles');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      for (const vehicle of res.body) {
        expect(vehicle.licensePlate).toBeUndefined();
        expect(vehicle.vin).toBeUndefined();
      }
    });

    it('GET /api/vehicles/:id detail: neither licensePlate nor vin is exposed', async () => {
      const listRes = await apiRequest(instance.baseUrl, 'GET', '/vehicles');
      const targetVehicle = listRes.body[0];

      const detailRes = await apiRequest(
        instance.baseUrl,
        'GET',
        `/vehicles/${targetVehicle.id}`,
      );
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.licensePlate).toBeUndefined();
      expect(detailRes.body.vin).toBeUndefined();
    });
  });

  // ─── 6. Kilometre Manipülasyon Engeli (400 BadRequest) ───
  describe('Mileage Tampering Prevention', () => {
    let customer: TestCustomer;
    let reservationId: string;
    let vehicleId: string;

    beforeAll(async () => {
      customer = await registerAndVerifyCustomer(instance.baseUrl, instance.prisma);
      createdUserIds.push(customer.userId);

      const branch = await instance.prisma.branch.findFirst({
        where: { name: { contains: 'İstanbul' } },
      });
      const segment = await instance.prisma.segment.findUnique({ where: { name: 'Economic' } });
      const bodyType = await instance.prisma.bodyType.findUnique({ where: { name: 'Sedan' } });
      const fuelType = await instance.prisma.fuelType.findUnique({ where: { name: 'Benzin' } });
      const trans = await instance.prisma.transmissionType.findUnique({ where: { name: 'Otomatik' } });

      // Find vehicle
      const vehicle = await instance.prisma.vehicle.findFirst({
        where: {
          branchId: branch!.id,
          segmentId: segment!.id,
          bodyTypeId: bodyType!.id,
          fuelTypeId: fuelType!.id,
          transmissionId: trans!.id,
          isActive: true,
          state: 'AVAILABLE',
        },
      });
      expect(vehicle).toBeDefined();
      vehicleId = vehicle!.id;

      // 1. Create reservation
      const res = await apiRequest(instance.baseUrl, 'POST', '/reservations', {
        token: customer.accessToken,
        body: {
          branchId: branch!.id,
          segmentId: segment!.id,
          bodyTypeId: bodyType!.id,
          fuelTypeId: fuelType!.id,
          transmissionId: trans!.id,
          plannedPickupAt: '2027-12-01T10:00:00.000Z',
          plannedReturnAt: '2027-12-03T10:00:00.000Z',
        },
      });
      expect(res.status).toBe(201);
      reservationId = res.body.id;
      createdReservationIds.push(reservationId);

      // 2. Pay to CONFIRM reservation
      const payRes = await apiRequest(instance.baseUrl, 'POST', '/payments/charge', {
        token: customer.accessToken,
        body: {
          reservationId,
          idempotencyKey: `idem_km_test_${Date.now()}`,
        },
      });
      expect(payRes.status).toBe(200);

      // 3. Deliver vehicle with mileageOut: 20000
      const deliverRes = await apiRequest(instance.baseUrl, 'POST', '/handover/deliver', {
        token: adminToken,
        body: {
          reservationId,
          vehicleId,
          mileageOut: 20000,
          fuelLevelOut: 100,
        },
      });
      expect(deliverRes.status).toBe(201);
    });

    afterAll(async () => {
      // Revert vehicle back to AVAILABLE in case it stayed rented
      await instance.prisma.vehicle.update({
        where: { id: vehicleId },
        data: { state: 'AVAILABLE', mileage: 15000 },
      });
    });

    it('Attempting return with mileageIn (19000) < mileageOut (20000) -> 400 BadRequestException', async () => {
      const res = await apiRequest(instance.baseUrl, 'POST', '/handover/return', {
        token: adminToken,
        body: {
          reservationId,
          mileageIn: 19000, // Invalid: less than 20000
          fuelLevelIn: 100,
          hasDamage: false,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/daha az olamaz/i);

      // Verify reservation is still ACTIVE and vehicle is still RENTED
      const currentRes = await instance.prisma.reservation.findUnique({
        where: { id: reservationId },
      });
      expect(currentRes!.state).toBe('ACTIVE');

      const currentVehicle = await instance.prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });
      expect(currentVehicle!.state).toBe('RENTED');
    });
  });

  // ─── 7. Rate Limit Koruması (429 Too Many Requests) ───
  describe('Rate Limiting & SMS Cooldown (429 Too Many Requests)', () => {
    it('Consecutive SMS requests within 60s trigger 429 Too Many Requests cooldown', async () => {
      const phone = generateRandomPhone();

      // First request -> 200 OK
      const firstRes = await apiRequest(instance.baseUrl, 'POST', '/auth/send-sms', {
        body: { phone, purpose: 'REGISTER' },
      });
      expect(firstRes.status).toBe(200);

      // Immediate second request with same phone -> 429 Too Many Requests
      const secondRes = await apiRequest(instance.baseUrl, 'POST', '/auth/send-sms', {
        body: { phone, purpose: 'REGISTER' },
      });

      expect(secondRes.status).toBe(429);
      expect(secondRes.body.message).toMatch(/60 saniye bekleyiniz|Too Many Requests/i);
    });
  });
});
