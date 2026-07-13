import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type { UserProfile } from './profile.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getUserProfile = async (): Promise<UserProfile> => {
  if (!API_BASE_URL) {
    await wait(150);
    return {
      name: ar.profile.mock.name,
      cardLabel: ar.profile.mock.cardLabel,
      cardNumber: ar.profile.mock.cardNumber,
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.profile.me}`);

  if (!response.ok) {
    throw new Error('PROFILE_FAILED');
  }

  const json = (await response.json()) as { data: UserProfile };
  return json.data;
};
