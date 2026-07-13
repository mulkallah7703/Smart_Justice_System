import type { ReactNode } from 'react';

import Icon from '../../shared/components/Icon';

import styles from './SettingsRow.module.css';

interface SettingsRowProps {
  icon: string;
  label: string;
  children?: ReactNode;
  onClick?: () => void;
  trailingText?: string;
  showChevron?: boolean;
}

const SettingsRow = ({
  icon,
  label,
  children,
  onClick,
  trailingText,
  showChevron = false,
}: SettingsRowProps): JSX.Element => {
  const content = (
    <>
      <span className={styles.iconWrap} aria-hidden>
        <Icon name={icon} size={20} className={styles.icon} />
      </span>
      <span className={styles.label}>{label}</span>
      <div className={styles.trailing}>
        {children}
        {trailingText ? (
          <span className={styles.trailingText}>{trailingText}</span>
        ) : null}
        {showChevron ? (
          <Icon name="chevron_left" size={20} className={styles.chevron} />
        ) : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`${styles.row} ${styles.clickable}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={styles.row}>{content}</div>;
};

export default SettingsRow;
