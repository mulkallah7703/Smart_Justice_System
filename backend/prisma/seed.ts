/**
 * DEVELOPMENT-ONLY synthetic seed.
 * Uses obviously fake identifiers. Never use real National IDs, phones, emails,
 * licenses, or payment credentials.
 *
 * Demo password login (development only):
 *   email:    dev.citizen@localhost.local
 *   password: DevCitizen1!
 */
import { argon2id, hash } from 'argon2';
import { PrismaClient } from '@prisma/client';

import { assertDevelopmentSeed } from '../src/shared/seed/assert-development-seed';

const prisma = new PrismaClient();

const DEV_NATIONAL_ID_CITIZEN = '1999999991';
const DEV_NATIONAL_ID_LAWYER = '1999999992';
const DEV_NATIONAL_ID_OTHER = '1999999993';
const DEV_PHONE_CITIZEN = '0500000001';
const DEV_PHONE_LAWYER = '0500000002';
const DEV_PHONE_OTHER = '0500000003';
const DEV_NATIONAL_ID_LAWYER_2 = '1999999994';
const DEV_PHONE_LAWYER_2 = '0500000004';
/** DEVELOPMENT ONLY — documented in backend README / manager handoff. */
const DEV_CITIZEN_PASSWORD = 'DevCitizen1!';

async function main(): Promise<void> {
  assertDevelopmentSeed(process.env);

  const citizenPasswordHash = await hash(DEV_CITIZEN_PASSWORD, { type: argon2id });

  const citizen = await prisma.user.upsert({
    where: { nationalId: DEV_NATIONAL_ID_CITIZEN },
    update: {
      email: 'dev.citizen@localhost.local',
      passwordHash: citizenPasswordHash,
    },
    create: {
      nationalId: DEV_NATIONAL_ID_CITIZEN,
      name: 'DEV Citizen',
      phone: DEV_PHONE_CITIZEN,
      email: 'dev.citizen@localhost.local',
      passwordHash: citizenPasswordHash,
      role: 'CITIZEN',
      judicialCard: {
        create: {
          cardNumber: 'JC-DEV-0001',
          tier: 'SILVER',
          discountPct: 25,
          validUntil: new Date('2030-12-31T00:00:00.000Z'),
          qrKeyId: 'dev-qr-key-1',
        },
      },
    },
  });

  const lawyerUser = await prisma.user.upsert({
    where: { nationalId: DEV_NATIONAL_ID_LAWYER },
    update: {},
    create: {
      nationalId: DEV_NATIONAL_ID_LAWYER,
      name: 'DEV Lawyer',
      phone: DEV_PHONE_LAWYER,
      email: 'dev.lawyer@localhost.local',
      role: 'LAWYER',
    },
  });

  const lawyer = await prisma.lawyer.upsert({
    where: { licenseNumber: 'DEV-LIC-0001' },
    update: {},
    create: {
      userId: lawyerUser.id,
      licenseNumber: 'DEV-LIC-0001',
      specialties: ['RENTAL', 'COMMERCIAL'],
      city: 'Riyadh',
      bio: 'Development-only lawyer profile.',
      rating: 4.8,
      reviewCount: 12,
      experienceYrs: 10,
      priceFrom: 150,
      isAvailable: true,
      isVerified: true,
    },
  });

  const secondLawyerUser = await prisma.user.upsert({
    where: { nationalId: DEV_NATIONAL_ID_LAWYER_2 },
    update: {},
    create: {
      nationalId: DEV_NATIONAL_ID_LAWYER_2,
      name: 'DEV Lawyer 2',
      phone: DEV_PHONE_LAWYER_2,
      email: 'dev.lawyer2@localhost.local',
      role: 'LAWYER',
    },
  });

  const secondLawyer = await prisma.lawyer.upsert({
    where: { licenseNumber: 'DEV-LIC-0002' },
    update: {},
    create: {
      userId: secondLawyerUser.id,
      licenseNumber: 'DEV-LIC-0002',
      specialties: ['PERSONAL', 'LABOR'],
      city: 'Jeddah',
      bio: 'Development-only lawyer profile.',
      rating: 4.5,
      reviewCount: 30,
      experienceYrs: 6,
      priceFrom: 120,
      isAvailable: true,
      isVerified: false,
    },
  });

  const otherCitizen = await prisma.user.upsert({
    where: { nationalId: DEV_NATIONAL_ID_OTHER },
    update: {},
    create: {
      nationalId: DEV_NATIONAL_ID_OTHER,
      name: 'DEV Other Citizen',
      phone: DEV_PHONE_OTHER,
      email: 'dev.other@localhost.local',
      role: 'CITIZEN',
    },
  });

  const legalCase = await prisma.case.upsert({
    where: { caseNumber: 'DEV-CASE-0001' },
    update: {},
    create: {
      caseNumber: 'DEV-CASE-0001',
      type: 'RENTAL',
      status: 'ACTIVE',
      authority: 'DEV Commercial Court',
      userId: citizen.id,
      lawyerId: lawyer.id,
    },
  });

  const extraCitizenCases = [
    {
      caseNumber: 'DEV-CASE-0002',
      type: 'COMMERCIAL' as const,
      status: 'PENDING' as const,
      authority: 'DEV Commercial Court',
      notes: 'Development commercial claim',
    },
    {
      caseNumber: 'DEV-CASE-0003',
      type: 'LABOR' as const,
      status: 'CLOSED' as const,
      authority: 'DEV Labor Court',
      notes: 'Development closed labor case',
    },
    {
      caseNumber: 'DEV-CASE-0004',
      type: 'PERSONAL' as const,
      status: 'APPEALING' as const,
      authority: 'DEV Appeals Circuit',
      notes: 'Development appealing case',
    },
  ];

  for (const item of extraCitizenCases) {
    await prisma.case.upsert({
      where: { caseNumber: item.caseNumber },
      update: {},
      create: {
        ...item,
        userId: citizen.id,
      },
    });
  }

  const appealingCase = await prisma.case.findUniqueOrThrow({
    where: { caseNumber: 'DEV-CASE-0004' },
  });
  const existingAppealDeadline = await prisma.deadline.findFirst({
    where: { caseId: appealingCase.id, type: 'APPEAL' },
  });
  if (!existingAppealDeadline) {
    await prisma.deadline.create({
      data: {
        caseId: appealingCase.id,
        type: 'APPEAL',
        dueAt: new Date('2030-02-01T21:00:00.000Z'),
        label: 'DEV appeal window',
      },
    });
  }

  await prisma.case.upsert({
    where: { caseNumber: 'DEV-CASE-OTHER-0001' },
    update: {},
    create: {
      caseNumber: 'DEV-CASE-OTHER-0001',
      type: 'COMMERCIAL',
      status: 'ACTIVE',
      authority: 'DEV Other Court',
      notes: 'Belongs to another development user',
      userId: otherCitizen.id,
    },
  });

  const existingHearing = await prisma.hearing.findFirst({
    where: { caseId: legalCase.id },
  });
  if (!existingHearing) {
    await prisma.hearing.create({
      data: {
        caseId: legalCase.id,
        scheduledAt: new Date('2030-01-15T09:00:00.000Z'),
        location: 'DEV Courtroom 1',
        notes: 'Development seed hearing',
      },
    });
  }

  const existingDeadline = await prisma.deadline.findFirst({
    where: { caseId: legalCase.id },
  });
  const deadline =
    existingDeadline ??
    (await prisma.deadline.create({
      data: {
        caseId: legalCase.id,
        type: 'DOCUMENT_SUBMIT',
        dueAt: new Date('2030-01-10T21:00:00.000Z'),
        label: 'DEV seed deadline',
      },
    }));

  const availabilityWindows = [
    {
      lawyerId: lawyer.id,
      startAt: '2030-01-20T08:00:00.000Z',
      endAt: '2030-01-20T08:20:00.000Z',
      status: 'AVAILABLE' as const,
    },
    {
      lawyerId: lawyer.id,
      startAt: '2030-02-03T06:00:00.000Z',
      endAt: '2030-02-03T10:00:00.000Z',
      status: 'AVAILABLE' as const,
    },
    {
      lawyerId: lawyer.id,
      startAt: '2030-02-04T06:00:00.000Z',
      endAt: '2030-02-04T08:00:00.000Z',
      status: 'BLOCKED' as const,
    },
    {
      lawyerId: secondLawyer.id,
      startAt: '2030-02-05T07:00:00.000Z',
      endAt: '2030-02-05T09:00:00.000Z',
      status: 'AVAILABLE' as const,
    },
  ];

  // Rolling near-term windows so the booking screen has something to show in
  // development. The fixed 2030 windows above stay for deterministic tests.
  const midnightUtc = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  const DAY = 24 * 60 * 60 * 1000;

  for (let dayOffset = 1; dayOffset <= 5; dayOffset += 1) {
    for (const lawyerRef of [lawyer.id, secondLawyer.id]) {
      const startAt = new Date(midnightUtc + dayOffset * DAY + 6 * 60 * 60 * 1000);
      availabilityWindows.push({
        lawyerId: lawyerRef,
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        status: 'AVAILABLE' as const,
      });
    }
  }

  for (const window of availabilityWindows) {
    const existingWindow = await prisma.lawyerAvailabilitySlot.findFirst({
      where: {
        lawyerId: window.lawyerId,
        startAt: new Date(window.startAt),
      },
    });
    if (!existingWindow) {
      await prisma.lawyerAvailabilitySlot.create({
        data: {
          lawyerId: window.lawyerId,
          startAt: new Date(window.startAt),
          endAt: new Date(window.endAt),
          status: window.status,
        },
      });
    }
  }

  const consultation = await prisma.consultation.findFirst({
    where: { userId: citizen.id, lawyerId: lawyer.id },
  });
  const booked =
    consultation ??
    (await prisma.consultation.create({
      data: {
        userId: citizen.id,
        lawyerId: lawyer.id,
        type: 'INSTANT',
        scheduledAt: new Date('2030-01-20T08:00:00.000Z'),
        status: 'CONFIRMED',
        durationMin: 20,
      },
    }));

  const existingPayment = await prisma.payment.findFirst({
    where: { consultationId: booked.id },
  });
  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        userId: citizen.id,
        consultationId: booked.id,
        amount: '112.50',
        originalAmount: '150.00',
        discountPct: 25,
        method: 'MADA',
        status: 'PENDING',
        purpose: 'CONSULTATION',
      },
    });
  }

  const existingDocument = await prisma.document.findFirst({
    where: { storageKey: 'dev/seed/lease.pdf' },
  });
  const document =
    existingDocument ??
    (await prisma.document.create({
      data: {
        userId: citizen.id,
        caseId: legalCase.id,
        originalName: 'dev-lease.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksum: 'sha256:dev-seed-not-a-real-file',
        storageKey: 'dev/seed/lease.pdf',
        status: 'UPLOADED',
        isAnalyzed: false,
      },
    }));

  const existingAlert = await prisma.alert.findFirst({
    where: { userId: citizen.id, deadlineId: deadline.id },
  });
  if (!existingAlert) {
    await prisma.alert.create({
      data: {
        userId: citizen.id,
        caseId: legalCase.id,
        deadlineId: deadline.id,
        type: 'DEADLINE',
        severity: 'WARNING',
        title: 'قرب انتهاء مهلة',
        body: 'تذكير تطويري بمهلة مرتبطة بملفك العدلي.',
        isRead: false,
      },
    });
  } else if (existingAlert.title === 'DEV seed alert') {
    await prisma.alert.update({
      where: { id: existingAlert.id },
      data: {
        title: 'قرب انتهاء مهلة',
        body: 'تذكير تطويري بمهلة مرتبطة بملفك العدلي.',
      },
    });
  }

  const seedAlertTemplates = [
    {
      type: 'MISSING_DOC' as const,
      severity: 'WARNING' as const,
      title: 'مستند ناقص',
      body: 'تنبيه تطويري: يلزم إرفاق مستند قبل الجلسة.',
      isRead: false,
    },
    {
      type: 'HEARING_REMINDER' as const,
      severity: 'URGENT' as const,
      title: 'تذكير بموعد الجلسة',
      body: 'تنبيه تطويري: لديك جلسة قادمة مرتبطة بملفك.',
      isRead: false,
    },
    {
      type: 'LAW_UPDATE' as const,
      severity: 'INFO' as const,
      title: 'تحديث نظامي',
      body: 'تنبيه تطويري إعلامي حول تحديث قد يخص قضيتك.',
      isRead: true,
    },
  ];

  for (const template of seedAlertTemplates) {
    const existingTypeAlert = await prisma.alert.findFirst({
      where: {
        userId: citizen.id,
        type: template.type,
        title: template.title,
      },
    });
    if (!existingTypeAlert) {
      await prisma.alert.create({
        data: {
          userId: citizen.id,
          caseId: legalCase.id,
          ...template,
        },
      });
    }
  }

  const existingNotification = await prisma.notification.findFirst({
    where: { userId: citizen.id, title: 'DEV notification' },
  });
  if (!existingNotification) {
    await prisma.notification.create({
      data: {
        userId: citizen.id,
        channel: 'PUSH',
        title: 'DEV notification',
        body: 'Development-only notification row',
        status: 'QUEUED',
      },
    });
  }

  const device = await prisma.kioskDevice.upsert({
    where: { deviceId: 'kiosk-lobby-01' },
    update: { status: 'ACTIVE', name: 'DEV lobby kiosk' },
    create: {
      deviceId: 'kiosk-lobby-01',
      name: 'DEV lobby kiosk',
      status: 'ACTIVE',
    },
  });

  const existingSession = await prisma.kioskSession.findFirst({
    where: { kioskDeviceId: device.id, userId: citizen.id },
  });
  if (!existingSession) {
    await prisma.kioskSession.create({
      data: {
        kioskDeviceId: device.id,
        userId: citizen.id,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      },
    });
  }

  const guide = await prisma.aiGuideSession.findFirst({
    where: { userId: citizen.id },
  });
  const guideSession =
    guide ??
    (await prisma.aiGuideSession.create({
      data: {
        userId: citizen.id,
        status: 'ACTIVE',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        messages: {
          create: {
            role: 'ASSISTANT',
            content: 'DEV seed guide message',
          },
        },
      },
    }));

  const existingJob = await prisma.aiJob.findFirst({
    where: { userId: citizen.id },
  });
  if (!existingJob) {
    await prisma.aiJob.create({
      data: {
        userId: citizen.id,
        type: 'DOCUMENT_ANALYSIS',
        status: 'PENDING',
        progress: 0,
        stageIndex: 0,
        idempotencyKey: 'dev-seed-ai-job',
        documents: {
          create: {
            documentId: document.id,
          },
        },
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorType: 'SYSTEM',
      actorUserId: citizen.id,
      action: 'DEV_SEED',
      resourceType: 'Seed',
      resourceId: guideSession.id,
      metadata: { environment: 'development', note: 'synthetic seed' },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
