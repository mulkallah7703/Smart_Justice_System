import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppLanguage = 'ar' | 'en';
export type CalendarType = 'hijri' | 'gregorian';
export type NumeralsType = 'arabic' | 'western';

interface SettingsState {
  language: AppLanguage;
  calendar: CalendarType;
  numerals: NumeralsType;
  largeFont: boolean;
  highContrast: boolean;
  darkMode: boolean;
  alertsEnabled: boolean;
  biometric: boolean;
  setLanguage: (language: AppLanguage) => void;
  setCalendar: (calendar: CalendarType) => void;
  setNumerals: (numerals: NumeralsType) => void;
  setLargeFont: (largeFont: boolean) => void;
  setHighContrast: (highContrast: boolean) => void;
  setDarkMode: (darkMode: boolean) => void;
  setAlertsEnabled: (alertsEnabled: boolean) => void;
  setBiometric: (biometric: boolean) => void;
}

export const settingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ar',
      calendar: 'hijri',
      numerals: 'arabic',
      largeFont: true,
      highContrast: false,
      darkMode: false,
      alertsEnabled: true,
      biometric: true,
      setLanguage: (language) => set({ language }),
      setCalendar: (calendar) => set({ calendar }),
      setNumerals: (numerals) => set({ numerals }),
      setLargeFont: (largeFont) => set({ largeFont }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setAlertsEnabled: (alertsEnabled) => set({ alertsEnabled }),
      setBiometric: (biometric) => set({ biometric }),
    }),
    { name: 'settings' },
  ),
);
