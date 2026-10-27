import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';
import type { LawyerListQueryDto } from './dto/lawyer-list-query.dto';
import type { LawyerDetailDto, LawyerListResult } from './dto/lawyer-response.dto';
import { citySearchTerms } from './city-search';
import { specialtyFromArabicQuery } from './specialty-search';
import { lawyerNotFound } from './lawyers.errors';
import { mapLawyerDetail, mapLawyerListItem } from './mappers/lawyer.mapper';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * Sorting is fixed on the server. Clients cannot supply an order.
 * Available lawyers first, then the strongest ratings, with a stable tiebreak.
 */
const LAWYER_ORDER: Prisma.LawyerOrderByWithRelationInput[] = [
  { isAvailable: 'desc' },
  { rating: 'desc' },
  { reviewCount: 'desc' },
  { id: 'asc' },
];

/** Public projection. Nothing from the linked User beyond the display name. */
const LIST_SELECT = {
  id: true,
  specialties: true,
  city: true,
  rating: true,
  reviewCount: true,
  experienceYrs: true,
  priceFrom: true,
  isAvailable: true,
  isVerified: true,
  user: { select: { name: true } },
} satisfies Prisma.LawyerSelect;

@Injectable()
export class LawyersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: LawyerListQueryDto): Promise<LawyerListResult> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const search = query.q?.trim();
    const cities = search ? citySearchTerms(search) : [];
    const arabicSpecialty = search ? specialtyFromArabicQuery(search) : null;

    const where: Prisma.LawyerWhereInput = {
      ...(query.specialty ? { specialties: { has: query.specialty } } : {}),
      ...(search
        ? {
            OR: [
              { user: { name: { contains: search, mode: 'insensitive' } } },
              ...cities.map((city) => ({
                city: { contains: city, mode: 'insensitive' as const },
              })),
              ...(arabicSpecialty
                ? [{ specialties: { has: arabicSpecialty } }]
                : []),
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.lawyer.findMany({
        where,
        orderBy: LAWYER_ORDER,
        skip: (page - 1) * limit,
        take: limit,
        select: LIST_SELECT,
      }),
      this.prisma.lawyer.count({ where }),
    ]);

    return {
      items: rows.map(mapLawyerListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(lawyerId: string): Promise<LawyerDetailDto> {
    const record = await this.prisma.lawyer.findUnique({
      where: { id: lawyerId },
      select: { ...LIST_SELECT, licenseNumber: true, bio: true },
    });

    if (!record) {
      throw lawyerNotFound();
    }

    return mapLawyerDetail(record);
  }
}
