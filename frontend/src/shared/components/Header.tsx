import type { ReactNode } from 'react';

import BackButton from './BackButton';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  trailing?: ReactNode;
  className?: string;
}

const Header = ({
  title,
  onBack,
  showBack = true,
  trailing,
  className = '',
}: HeaderProps): JSX.Element => {
  return (
    <header className={`${styles.header} ${className}`}>
      <div className={styles.side}>
        {showBack && onBack ? <BackButton onClick={onBack} /> : null}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={`${styles.side} ${styles.trailing}`}>
        {trailing ?? null}
      </div>
    </header>
  );
};

export default Header;
