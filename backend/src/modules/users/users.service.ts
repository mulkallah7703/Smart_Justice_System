import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import { userNotFound } from '../auth/auth.errors';

import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserMeDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<UserMeDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        role: true,
        judicialCard: {
          select: {
            cardNumber: true,
            tier: true,
            discountPct: true,
          },
        },
      },
    });

    if (!user) {
      throw userNotFound();
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      card: user.judicialCard,
    };
  }

  async updateMe(userId: string, input: UpdateUserDto): Promise<UserMeDto> {
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      throw userNotFound();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
    });

    return this.getMe(userId);
  }
}
