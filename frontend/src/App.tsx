import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

import AppRouter from './core/router/AppRouter';
import { useDarkMode } from './shared/hooks/useDarkMode';

const ThemeRoot = ({ children }: { children: ReactNode }): JSX.Element => {
  useDarkMode();
  return <>{children}</>;
};

const App = (): JSX.Element => {
  return (
    <BrowserRouter>
      <ThemeRoot>
        <AppRouter />
      </ThemeRoot>
    </BrowserRouter>
  );
};

export default App;
