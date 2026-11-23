import {
  createTestApp,
  TestAppInstance,
  apiRequest,
  getSuperAdminToken,
  cleanupTestData,
  generateValidTcKimlikNo,
  generateRandomPhone,
} from './test-helper';

describe('E2E Lifecycle Happy Path Test Suite', () => {
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

  // ─── SENARYO A: Kiralama ve İade (Full Rental -> Return) ───
  it('Scenario A: Register -> SMS -> KYC -> Reservation -> Idempotent Payment -> Deliver -> Return', async () => {
    const phone = generateRandomPhone();
    const email = `lifecycle_a_${Date.now()}@test.local`;
    const password = 'GuvenliParola123!';
    const tcKimlikNo = generateValidTcKimlikNo();

    // 1. SMS Verification Code
    const smsRes = await apiRequest(instance.baseUrl, 'POST', '/auth/send-sms', {
      body: { phone, purpose: 'REGISTER' },
    });
    expect(smsRes.status).toBe(200);

    const smsRecord = await instance.prisma.smsVerificationCode.findFirst({
      where: { phone, purpose: 'REGISTER' },
      orderBy: { createdAt: 'desc' },
    });
    expect(smsRecord).toBeDefined();
    const smsCode = smsRecord!.code;

    // 2. Customer Registration
    const regRes = await apiRequest(instance.baseUrl, 'POST', '/auth/register', {
      body: { phone, email, password, smsCode },
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.accessToken).toBeDefined();

    const customerToken = regRes.body.accessToken;
    const customerId = regRes.body.user.id;
    createdUserIds.push(customerId);

    // 3. KYC Profile Creation
    const profileRes = await apiRequest(instance.baseUrl, 'PUT', '/users/me/profile', {
      token: customerToken,
      body: {
        firstName: 'Mehmet',
        lastName: 'Demir',
        birthDate: '1996-03-20',
        licenseDate: '2016-04-10',
        nationalId: tcKimlikNo,
      },
    });
    expect([200, 201]).toContain(profileRes.status);
    expect(profileRes.body.firstName).toBe('Mehmet');

    // 4. Vehicle & Branch Identification
    const branch = await instance.prisma.branch.findFirst({
      where: { name: { contains: 'İstanbul' } },
    });
    const segment = await instance.prisma.segment.findUnique({ where: { name: 'Economic' } });
    const bodyType = await instance.prisma.bodyType.findUnique({ where: { name: 'Hatchback' } });
    const fuelType = await instance.prisma.fuelType.findUnique({ where: { name: 'Benzin' } });
    const trans = await instance.prisma.transmissionType.findUnique({ where: { name: 'Manuel' } });

    const vehicle = await instance.prisma.vehicle.findFirst({
      where: {
        branchId: branch!.id,
        segmentId: segment!.id,
        bodyTypeId: bodyType!.id,
        fuelTypeId: fuelType!.id,
        transmissionId: trans!.id,
        isActive: true,
      },
    });
    expect(vehicle).toBeDefined();
    const initialMileage = vehicle!.mileage;

    // 5. Reservation Creation (PENDING_PAYMENT)
    const pickupDate = new Date('2027-10-10T10:00:00.000Z');
    const returnDate = new Date('2027-10-12T10:00:00.000Z');

    const resRes = await apiRequest(instance.baseUrl, 'POST', '/reservations', {
      token: customerToken,
      body: {
        branchId: branch!.id,
        segmentId: segment!.id,
        bodyTypeId: bodyType!.id,
        fuelTypeId: fuelType!.id,
        transmissionId: trans!.id,
        plannedPickupAt: pickupDate.toISOString(),
        plannedReturnAt: returnDate.toISOString(),
      },
    });

    expect(resRes.status).toBe(201);
    expect(resRes.body.state).toBe('PENDING_PAYMENT');
    expect(resRes.body.expiresAt).toBeDefined();
    const reservationId = resRes.body.id;
    const totalAmount = resRes.body.priceSnapshot.totalAmount;
    createdReservationIds.push(reservationId);

    // 6. Idempotent Payment (CONFIRMED)
    const idempotencyKey = `idem_lifecycle_${Date.now()}`;

    // First charge request -> 200 OK
    const payRes1 = await apiRequest(instance.baseUrl, 'POST', '/payments/charge', {
      token: customerToken,
      body: {
        reservationId,
        idempotencyKey,
        cardHolderName: 'Mehmet Demir',
      },
    });
    expect(payRes1.status).toBe(200);
    expect(payRes1.body.status).toBe('SUCCESS');
    expect(payRes1.body.type).toBe('CHARGE');
    expect(payRes1.body.amount).toBe(totalAmount);

    // Verify reservation transitioned to CONFIRMED
    const confirmedRes = await instance.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    expect(confirmedRes!.state).toBe('CONFIRMED');

    // Second identical charge request (Idempotency test) -> 200 OK, returns same payment without duplicates
    const payRes2 = await apiRequest(instance.baseUrl, 'POST', '/payments/charge', {
      token: customerToken,
      body: {
        reservationId,
        idempotencyKey,
        cardHolderName: 'Mehmet Demir',
      },
    });
    expect(payRes2.status).toBe(200);
    expect(payRes2.body.id).toBe(payRes1.body.id);

    const paymentCount = await instance.prisma.payment.count({
      where: { reservationId },
    });
    expect(paymentCount).toBe(1);

    // 7. Handover Delivery at Branch (Reservation: ACTIVE, Vehicle: RENTED)
    const deliveryMileage = initialMileage;
    const deliverRes = await apiRequest(instance.baseUrl, 'POST', '/handover/deliver', {
      token: adminToken,
      body: {
        reservationId,
        vehicleId: vehicle!.id,
        mileageOut: deliveryMileage,
        fuelLevelOut: 100,
      },
    });
    expect(deliverRes.status).toBe(201);

    const activeRes = await instance.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    expect(activeRes!.state).toBe('ACTIVE');
    expect(activeRes!.vehicleId).toBe(vehicle!.id);

    const rentedVehicle = await instance.prisma.vehicle.findUnique({
      where: { id: vehicle!.id },
    });
    expect(rentedVehicle!.state).toBe('RENTED');

    // 8. Handover Return (Reservation: COMPLETED, Vehicle: AVAILABLE)
    const returnMileage = deliveryMileage + 350;
    const returnRes = await apiRequest(instance.baseUrl, 'POST', '/handover/return', {
      token: adminToken,
      body: {
        reservationId,
        mileageIn: returnMileage,
        fuelLevelIn: 100,
        hasDamage: false,
      },
    });
    expect(returnRes.status).toBe(200);

    const completedRes = await instance.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { handoverRecord: true, returnRecord: true },
    });
    expect(completedRes!.state).toBe('COMPLETED');
    expect(completedRes!.returnRecord!.mileageIn).toBe(returnMileage);
    expect(completedRes!.returnRecord!.hasDamage).toBe(false);

    const availableVehicle = await instance.prisma.vehicle.findUnique({
      where: { id: vehicle!.id },
    });
    expect(availableVehicle!.state).toBe('AVAILABLE');
    expect(availableVehicle!.mileage).toBe(returnMileage);
  });

  // ─── SENARYO B: İptal ve Tam İade (Cancel & Full Refund) ───
  it('Scenario B: Reservation -> Payment (CONFIRMED) -> Customer Cancel -> CANCELLED with REFUND record', async () => {
    const phone = generateRandomPhone();
    const email = `lifecycle_b_${Date.now()}@test.local`;
    const tcKimlikNo = generateValidTcKimlikNo();

    // 1. Register customer via DB code
    const smsCode = '123456';
    await instance.prisma.smsVerificationCode.create({
      data: {
        phone,
        purpose: 'REGISTER',
        code: smsCode,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        maxAttempts: 3,
      },
    });

    const regRes = await apiRequest(instance.baseUrl, 'POST', '/auth/register', {
      body: { phone, email, password: 'GuvenliParola123!', smsCode },
    });
    expect(regRes.status).toBe(201);
    const customerToken = regRes.body.accessToken;
    const customerId = regRes.body.user.id;
    createdUserIds.push(customerId);

    // 2. KYC Profile
    await apiRequest(instance.baseUrl, 'PUT', '/users/me/profile', {
      token: customerToken,
      body: {
        firstName: 'Ayşe',
        lastName: 'Kaya',
        birthDate: '1994-07-15',
        licenseDate: '2015-02-20',
        nationalId: tcKimlikNo,
      },
    });

    // 3. Find vehicle group (Golf: Economic, Hatchback, Dizel, Otomatik)
    const branch = await instance.prisma.branch.findFirst({
      where: { name: { contains: 'İstanbul' } },
    });
    const segment = await instance.prisma.segment.findUnique({ where: { name: 'Economic' } });
    const bodyType = await instance.prisma.bodyType.findUnique({ where: { name: 'Hatchback' } });
    const fuelType = await instance.prisma.fuelType.findUnique({ where: { name: 'Dizel' } });
    const trans = await instance.prisma.transmissionType.findUnique({ where: { name: 'Otomatik' } });

    // 4. Create Reservation
    const pickupDate = new Date('2027-11-20T10:00:00.000Z');
    const returnDate = new Date('2027-11-23T10:00:00.000Z');

    const resRes = await apiRequest(instance.baseUrl, 'POST', '/reservations', {
      token: customerToken,
      body: {
        branchId: branch!.id,
        segmentId: segment!.id,
        bodyTypeId: bodyType!.id,
        fuelTypeId: fuelType!.id,
        transmissionId: trans!.id,
        plannedPickupAt: pickupDate.toISOString(),
        plannedReturnAt: returnDate.toISOString(),
      },
    });
    expect(resRes.status).toBe(201);
    const reservationId = resRes.body.id;
    const totalAmount = resRes.body.priceSnapshot.totalAmount;
    createdReservationIds.push(reservationId);

    // 5. Pay to confirm reservation
    const payRes = await apiRequest(instance.baseUrl, 'POST', '/payments/charge', {
      token: customerToken,
      body: {
        reservationId,
        idempotencyKey: `idem_cancel_${Date.now()}`,
      },
    });
    expect(payRes.status).toBe(200);

    const confirmedRes = await instance.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    expect(confirmedRes!.state).toBe('CONFIRMED');

    // 6. Customer Cancels Reservation
    const cancelRes = await apiRequest(
      instance.baseUrl,
      'POST',
      `/reservations/${reservationId}/cancel`,
      {
        token: customerToken,
        body: { reason: 'Uçuş saatim değişti, kiralama iptali talep ediyorum' },
      },
    );
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.message).toMatch(/iptal edildi/i);

    // 7. DB Verification: CANCELLED state and REFUND payment record
    const updatedRes = await instance.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { payments: true },
    });
    expect(updatedRes!.state).toBe('CANCELLED');

    const refundPayment = updatedRes!.payments.find((p) => p.type === 'REFUND');
    expect(refundPayment).toBeDefined();
    expect(refundPayment!.status).toBe('SUCCESS');
    expect(Number(refundPayment!.amount)).toBe(totalAmount);
    expect(refundPayment!.type).toBe('REFUND');
  });
});
