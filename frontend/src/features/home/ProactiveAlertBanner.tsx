import Icon from '../../shared/components/Icon';

import styles from './ProactiveAlertBanner.module.css';

interface ProactiveAlertBannerProps {
  title: string;
  subtitle: string;
  onClick?: () => void;
}

const ProactiveAlertBanner = ({
  title,
  subtitle,
  onClick,
}: ProactiveAlertBannerProps): JSX.Element => {
  return (
    <button type="button" className={styles.banner} onClick={onClick}>
      <div className={styles.iconWrap}>
        <Icon name="error" size={20} className={styles.icon} filled />
      </div>
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <Icon name="chevron_left" size={20} className={styles.chevron} />
    </button>
  );
};

export default ProactiveAlertBanner;
