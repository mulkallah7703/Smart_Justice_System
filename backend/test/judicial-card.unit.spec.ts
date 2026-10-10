import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpgradeJudicialCardDto } from '../src/modules/judicial-card/dto/upgrade-judicial-card.dto';
import {
  mapJudicialCard,
  mapJudicialCardQr,
} from '../src/modules/judicial-card/mappers/judicial-card.mapper';
import { QrGeneratorService } from '../src/modules/judicial-card/qr-generator.service';
import { JudicialCardService } from '../src/modules/judicial-card/judicial-card.service';
import { CardTierService } from '../src/modules/judicial-card/card-tier.service';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('UpgradeJudicialCardDto', () => {
  it('accepts a valid tier', () => {
    const dto = plainToInstance(UpgradeJudicialCardDto, { tier: 'GOLD' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects unexpected userId', () => {
    const dto = plainToInstance(UpgradeJudicialCardDto, {
      tier: 'GOLD',
      userId: 'u1',
    });
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length,
    ).toBeGreaterThan(0);
  });
});

describe('judicial card mappers', () => {
  it('maps card without userId or nationalId', () => {
    const mapped = mapJudicialCard({
      cardNumber: 'JC-DEV-0001',
      tier: 'SILVER',
      discountPct: 25,
      validUntil: new Date('2030-12-31T00:00:00.000Z'),
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { name: 'DEV Citizen' },
    });

    expect(mapped).toEqual({
      cardNumber: 'JC-DEV-0001',
      holderName: 'DEV Citizen',
      tier: 'SILVER',
      discountPct: 25,
      validUntil: '2030-12-31T00:00:00.000Z',
      issuedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(mapped).not.toHaveProperty('userId');
    expect(mapped).not.toHaveProperty('nationalId');
    expect(mapped).not.toHaveProperty('qrKeyId');
  });

  it('maps qr payload', () => {
    expect(
      mapJudicialCardQr({
        payload: 'sjc:v1:JC-1:SILVER:1:abc',
        expiresAt: new Date('2030-01-01T00:05:00.000Z'),
      }),
    ).toEqual({
      payload: 'sjc:v1:JC-1:SILVER:1:abc',
      expiresAt: '2030-01-01T00:05:00.000Z',
    });
  });
});

describe('QrGeneratorService', () => {
  it('builds an opaque payload without JWT or nationalId', () => {
    const service = new QrGeneratorService();
    const { payload, expiresAt } = service.buildPayload({
      cardNumber: 'JC-DEV-0001',
      tier: 'SILVER',
    });

    expect(payload.startsWith('sjc:v1:JC-DEV-0001:SILVER:')).toBe(true);
    expect(payload.toLowerCase()).not.toContain('bearer');
    expect(payload).not.toMatch(/national/i);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('JudicialCardService', () => {
  it('returns the caller card', async () => {
    const prisma = {
      judicialCard: {
        findUnique: jest.fn().mockResolvedValue({
          cardNumber: 'JC-1',
          tier: 'SILVER',
          discountPct: 25,
          validUntil: new Date('2030-01-01T00:00:00.000Z'),
          issuedAt: new Date('2026-01-01T00:00:00.000Z'),
          user: { name: 'Citizen' },
        }),
      },
    } as unknown as PrismaService;

    const service = new JudicialCardService(
      prisma,
      new QrGeneratorService(),
      new CardTierService(),
    );

    const result = await service.getMine('user-1');
    expect(result.cardNumber).toBe('JC-1');
    expect(result.holderName).toBe('Citizen');
  });

  it('throws the same not-found code when missing', async () => {
    const prisma = {
      judicialCard: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const service = new JudicialCardService(
      prisma,
      new QrGeneratorService(),
      new CardTierService(),
    );

    await expect(service.getMine('user-x')).rejects.toMatchObject({
      code: 'JUDICIAL_CARD_NOT_FOUND',
    });
  });

  it('blocks upgrade until payment phase', async () => {
    const prisma = {
      judicialCard: {
        findUnique: jest.fn().mockResolvedValue({ tier: 'SILVER' }),
      },
    } as unknown as PrismaService;

    const service = new JudicialCardService(
      prisma,
      new QrGeneratorService(),
      new CardTierService(),
    );

    await expect(
      service.upgrade('user-1', { tier: 'GOLD' }),
    ).rejects.toMatchObject({ code: 'JUDICIAL_CARD_UPGRADE_UNAVAILABLE' });
  });
});
