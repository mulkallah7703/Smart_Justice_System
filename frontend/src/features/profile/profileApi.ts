import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';
import type { BackendUser, FrontendUser } from '../../shared/api/types';

import { mapBackendUser } from './mapUser';
import type { UserProfile } from './profile.types';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mockFrontendUser = (): FrontendUser => ({
  name: ar.profile.mock.name,
  cardLabel: ar.profile.mock.cardLabel,
  cardNumber: ar.profile.mock.cardNumber,
  tier: 'SILVER',
  discountPct: 30,
});

export const getCurrentUser = async (): Promise<FrontendUser> => {
  if (isMockApiMode()) {
    await wait(150);
    return mockFrontendUser();
  }

  const user = await apiRequest<BackendUser>(endpoints.profile.me);
  return mapBackendUser(user);
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const user = await getCurrentUser();
  return {
    name: user.name,
    cardLabel: user.cardLabel,
    cardNumber: user.cardNumber,
  };
};
