import { create } from 'zustand';

import { authStore } from '../auth/authStore';

interface AlertsState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

export const alertsStore = create<AlertsState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
}));

// The count belongs to one account; drop it on logout or account switch.
authStore.subscribe((state, previous) => {
  if (state.accessToken !== previous.accessToken) {
    alertsStore.getState().setUnreadCount(0);
  }
});
