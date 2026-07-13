import Icon from '../../shared/components/Icon';

import styles from './SplashTrustBadge.module.css';

interface SplashTrustBadgeProps {
  label: string;
}

const SplashTrustBadge = ({ label }: SplashTrustBadgeProps): JSX.Element => {
  return (
    <div className={styles.badge}>
      <Icon name="shield" size={16} className={styles.icon} />
      <span className={styles.label}>{label}</span>
    </div>
  );
};

export default SplashTrustBadge;
