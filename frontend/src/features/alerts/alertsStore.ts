import { create } from 'zustand';

interface AlertsState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

export const alertsStore = create<AlertsState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
