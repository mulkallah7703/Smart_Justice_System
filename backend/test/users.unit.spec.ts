import { UsersService } from '../src/modules/users/users.service';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('UsersService profile fields', () => {
  it('returns the phone and email written by updateMe', async () => {
    const stored = {
      id: 'user-a',
      name: 'Citizen',
      role: 'CITIZEN',
      phone: '0555000000',
      email: 'old@example.com',
      judicialCard: null,
    };
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-a' })
      .mockResolvedValueOnce({
        ...stored,
        phone: '0555111222',
        email: 'new@example.com',
      });
    const update = jest.fn().mockResolvedValue({ id: 'user-a' });
    const service = new UsersService({
      user: { findFirst, update },
    } as unknown as PrismaService);

    const me = await service.updateMe('user-a', {
      phone: '0555111222',
      email: 'new@example.com',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-a' },
      data: { phone: '0555111222', email: 'new@example.com' },
    });
    expect(me.phone).toBe('0555111222');
    expect(me.email).toBe('new@example.com');
  });
});
