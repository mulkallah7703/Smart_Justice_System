import Avatar from '../../shared/components/Avatar';
import Icon from '../../shared/components/Icon';

import type { LawyerProfileData } from './lawyers.types';
import styles from './LawyerProfileHeader.module.css';

interface LawyerProfileHeaderProps {
  profile: LawyerProfileData;
  isFavorite: boolean;
  reviewsLabel: string;
  onBack: () => void;
  onToggleFavorite: () => void;
}

const LawyerProfileHeader = ({
  profile,
  isFavorite,
  reviewsLabel,
  onBack,
  onToggleFavorite,
}: LawyerProfileHeaderProps): JSX.Element => {
  return (
    <header className={styles.header}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onBack}
          aria-label="العودة للخلف"
        >
          <Icon name="arrow_back" size={24} className={styles.backIcon} />
        </button>
        <h1 className={styles.title}>{profile.profileTitle}</h1>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onToggleFavorite}
          aria-label="المفضلة"
          aria-pressed={isFavorite}
        >
          <Icon
            name="favorite"
            size={24}
            filled={isFavorite}
            className={isFavorite ? styles.favoriteFilled : ''}
          />
        </button>
      </div>

      <div className={styles.profile}>
        <Avatar
          name={profile.name}
          tone={profile.avatarTone}
          size={72}
          verified={profile.isVerified}
        />
        <div className={styles.copy}>
          <p className={styles.name}>{profile.name}</p>
          <p className={styles.role}>{profile.title}</p>
          <div className={styles.ratingRow}>
            <span className={styles.rating}>
              <Icon name="star" size={16} filled />
              <span className={styles.ratingValue}>
                {profile.rating.toFixed(1)}
              </span>
            </span>
            <span className={styles.reviews}>
              {profile.reviewCount} {reviewsLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default LawyerProfileHeader;
