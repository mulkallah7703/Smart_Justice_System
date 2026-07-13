import { create } from 'zustand';

interface AlertsState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

export const alertsStore = create<AlertsState>((set) => ({
  unreadCount: 1,
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
