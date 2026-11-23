import {
  createTestApp,
  TestAppInstance,
  apiRequest,
  registerAndVerifyCustomer,
  cleanupTestData,
  TestCustomer,
} from './test-helper';

describe('E2E Concurrency & Overbooking Test Suite', () => {
  let instance: TestAppInstance;
  const createdUserIds: string[] = [];
  const createdReservationIds: string[] = [];

  beforeAll(async () => {
    instance = await createTestApp();
  }, 35000);

  afterAll(async () => {
    if (instance) {
      await cleanupTestData(instance.prisma, createdUserIds, createdReservationIds);
      await instance.app.close();
    }
  });

  it('Race condition on last available vehicle: Exactly 1 request succeeds (201) and exactly 1 request is rejected (409)', async () => {
    // 1. Identify a vehicle group with EXACTLY 1 vehicle at Istanbul Havalimanı (IST)
    const branch = await instance.prisma.branch.findFirst({
      where: { name: { contains: 'İstanbul' } },
    });
    expect(branch).toBeDefined();

    const economicSegment = await instance.prisma.segment.findUnique({
      where: { name: 'Economic' },
    });
    const sedanBody = await instance.prisma.bodyType.findUnique({
      where: { name: 'Sedan' },
    });
    const benzinFuel = await instance.prisma.fuelType.findUnique({
      where: { name: 'Benzin' },
    });
    const autoTrans = await instance.prisma.transmissionType.findUnique({
      where: { name: 'Otomatik' },
    });

    expect(economicSegment).toBeDefined();
    expect(sedanBody).toBeDefined();
    expect(benzinFuel).toBeDefined();
    expect(autoTrans).toBeDefined();

    const branchId = branch!.id;
    const segmentId = economicSegment!.id;
    const bodyTypeId = sedanBody!.id;
    const fuelTypeId = benzinFuel!.id;
    const transmissionId = autoTrans!.id;

    // Verify there is EXACTLY 1 active vehicle in this exact 5-tuple
    const matchingVehicles = await instance.prisma.vehicle.findMany({
      where: {
        branchId,
        segmentId,
        bodyTypeId,
        fuelTypeId,
        transmissionId,
        isActive: true,
        state: { notIn: ['INACTIVE', 'DAMAGED_OUT_OF_SERVICE'] },
      },
    });

    console.log(`[TEST] Matching vehicles count for target 5-tuple: ${matchingVehicles.length}`);
    expect(matchingVehicles.length).toBe(1);

    // 2. Register two independent verified customers with KYC profiles
    console.log('[TEST] Registering Customer A...');
    const customerA: TestCustomer = await registerAndVerifyCustomer(
      instance.baseUrl,
      instance.prisma,
    );
    createdUserIds.push(customerA.userId);

    console.log('[TEST] Registering Customer B...');
    const customerB: TestCustomer = await registerAndVerifyCustomer(
      instance.baseUrl,
      instance.prisma,
    );
    createdUserIds.push(customerB.userId);

    // Target rental dates: 3 days in the future, 10:00 UTC = 13:00 Europe/Istanbul
    const pickupDate = new Date('2027-08-10T10:00:00.000Z');
    const returnDate = new Date('2027-08-13T10:00:00.000Z');

    const reservationPayload = {
      branchId,
      segmentId,
      bodyTypeId,
      fuelTypeId,
      transmissionId,
      plannedPickupAt: pickupDate.toISOString(),
      plannedReturnAt: returnDate.toISOString(),
    };

    console.log('[TEST] Dispatching concurrent reservation requests via Promise.all...');

    // 3. Concurrently dispatch reservation requests for both customers
    const [resA, resB] = await Promise.all([
      apiRequest(instance.baseUrl, 'POST', '/reservations', {
        token: customerA.accessToken,
        body: reservationPayload,
      }),
      apiRequest(instance.baseUrl, 'POST', '/reservations', {
        token: customerB.accessToken,
        body: reservationPayload,
      }),
    ]);

    console.log(`[TEST] Response A: Status = ${resA.status}`, resA.body);
    console.log(`[TEST] Response B: Status = ${resB.status}`, resB.body);

    const statuses = [resA.status, resB.status];

    // Track created reservation ID for cleanup
    if (resA.status === 201 && resA.body?.id) {
      createdReservationIds.push(resA.body.id);
    }
    if (resB.status === 201 && resB.body?.id) {
      createdReservationIds.push(resB.body.id);
    }

    // 4. Verification: Exactly ONE 201 Created and exactly ONE 409 Conflict
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(1);

    const successRes = resA.status === 201 ? resA : resB;
    const conflictRes = resA.status === 409 ? resA : resB;

    // Successful response assertions
    expect(successRes.body.id).toBeDefined();
    expect(successRes.body.state).toBe('PENDING_PAYMENT');
    expect(successRes.body.expiresAt).toBeDefined();
    expect(successRes.body.priceSnapshot).toBeDefined();
    expect(successRes.body.priceSnapshot.totalDays).toBe(3);

    // Conflict response assertions
    expect(conflictRes.body.statusCode).toBe(409);
    expect(conflictRes.body.message).toMatch(/doludur|kapasite/i);

    // 5. Database Verification: EXACTLY 1 reservation exists in DB for this period
    const dbCount = await instance.prisma.reservation.count({
      where: {
        branchId,
        startTime: pickupDate,
        endTime: returnDate,
        state: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE'] },
      },
    });

    console.log(`[TEST] Database reservations count in window: ${dbCount}`);
    expect(dbCount).toBe(1);
  });
});
