import type { ReactNode } from 'react';

import Icon from './Icon';
import styles from './AlertBanner.module.css';

type AlertBannerVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface AlertBannerProps {
  message: string;
  variant?: AlertBannerVariant;
  icon?: string;
  className?: string;
  children?: ReactNode;
}

const variantIconMap: Record<AlertBannerVariant, string> = {
  success: 'check_circle',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  neutral: 'lock',
};

const AlertBanner = ({
  message,
  variant = 'info',
  icon,
  className = '',
  children,
}: AlertBannerProps): JSX.Element => {
  const iconName = icon ?? variantIconMap[variant];

  return (
    <div className={`${styles.banner} ${styles[variant]} ${className}`} role="status">
      <Icon name={iconName} size={20} className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
        {children}
      </div>
    </div>
  );
};

export default AlertBanner;
