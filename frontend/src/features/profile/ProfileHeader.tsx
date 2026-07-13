import { ar } from '../../core/i18n/ar';
import Avatar from '../../shared/components/Avatar';
import Icon from '../../shared/components/Icon';

import type { UserProfile } from './profile.types';
import styles from './ProfileHeader.module.css';

interface ProfileHeaderProps {
  profile: UserProfile;
  onEdit?: () => void;
  onBack?: () => void;
}

const ProfileHeader = ({
  profile,
  onEdit,
  onBack,
}: ProfileHeaderProps): JSX.Element => {
  return (
    <header className={styles.header}>
      {onBack ? (
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label={ar.profile.backAria}
        >
          <Icon name="arrow_forward" size={24} />
        </button>
      ) : null}

      <div className={styles.row}>
        <Avatar
          name={profile.name}
          size={56}
          tone="gold"
          className={styles.avatar}
        />
        <div className={styles.info}>
          <h1 className={styles.name}>{profile.name}</h1>
          <p className={styles.meta}>
            {profile.cardLabel}
            <span className={styles.dot} aria-hidden>
              •
            </span>
            {profile.cardNumber}
          </p>
        </div>
        <button
          type="button"
          className={styles.edit}
          onClick={onEdit}
          aria-label={ar.profile.editAria}
        >
          <Icon name="edit" size={20} className={styles.editIcon} />
        </button>
      </div>
    </header>
  );
};

export default ProfileHeader;
