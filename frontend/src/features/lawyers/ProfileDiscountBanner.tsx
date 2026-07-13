import Icon from '../../shared/components/Icon';

import styles from './ProfileDiscountBanner.module.css';

interface ProfileDiscountBannerProps {
  title: string;
  subtitle: string;
}

const ProfileDiscountBanner = ({
  title,
  subtitle,
}: ProfileDiscountBannerProps): JSX.Element => {
  return (
    <div className={styles.banner} role="status">
      <div className={styles.iconWrap} aria-hidden="true">
        <Icon name="redeem" size={20} />
      </div>
      <div className={styles.copy}>
        <p className={styles.title}>{title}</p>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </div>
  );
};

export default ProfileDiscountBanner;
