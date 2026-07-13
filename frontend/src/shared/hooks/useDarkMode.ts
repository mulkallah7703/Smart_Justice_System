import { useEffect } from 'react';

import { settingsStore } from '../store/settingsStore';

/** Syncs settingsStore.darkMode → <html class="dark"> per DesignSystem. */
export const useDarkMode = (): boolean => {
  const darkMode = settingsStore((state) => state.darkMode);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', darkMode);
    root.style.colorScheme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  return darkMode;
};
