import type { ReactNode } from 'react';

import styles from './ScreenShell.module.css';

interface ScreenShellProps {
  children: ReactNode;
  noNav?: boolean;
  variant?: 'default' | 'primary' | 'dark';
}

const ScreenShell = ({
  children,
  noNav = false,
  variant = 'default',
}: ScreenShellProps): JSX.Element => {
  const variantClass =
    variant === 'primary'
      ? styles.primary
      : variant === 'dark'
        ? styles.dark
        : styles.default;

  return (
    <div
      className={`${styles.shell} ${variantClass} ${noNav ? styles.noNav : ''}`}
      data-variant={variant}
    >
      {children}
    </div>
  );
};

export default ScreenShell;
