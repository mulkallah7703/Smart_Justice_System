import { describe, expect, it } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { mapUserToProfile } from './mapUser';
import type { BackendUser } from '../../shared/api/types';

const backendUser: BackendUser = {
  id: 'user_1',
  name: 'Citizen',
  role: 'CITIZEN',
  card: {
    cardNumber: 'JC-2026-ABC123',
    tier: 'NORMAL',
    discountPct: 0,
  },
};

describe('mapUserToProfile', () => {
  it('maps the backend user DTO onto the existing profile UI model', () => {
    expect(mapUserToProfile(backendUser)).toEqual({
      name: 'Citizen',
      cardLabel: ar.profile.cardLabels.NORMAL,
      cardNumber: 'JC-2026-ABC123',
    });
  });

  it('does not copy nationalId or role into the profile UI model', () => {
    const mapped = mapUserToProfile(backendUser);
    expect(mapped).not.toHaveProperty('nationalId');
    expect(mapped).not.toHaveProperty('role');
    expect(mapped).not.toHaveProperty('id');
  });
});
