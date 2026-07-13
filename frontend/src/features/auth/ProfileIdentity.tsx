import Icon from '../../shared/components/Icon';

import styles from './ProfileIdentity.module.css';

interface ProfileIdentityProps {
  name: string;
  cardLabel: string;
  tierLabel: string;
}

const ProfileIdentity = ({
  name,
  cardLabel,
  tierLabel,
}: ProfileIdentityProps): JSX.Element => {
  return (
    <div className={styles.identity}>
      <div className={styles.iconWrap}>
        <Icon name="credit_card" size={24} className={styles.icon} />
      </div>
      <div className={styles.content}>
        <p className={styles.name}>{name}</p>
        <p className={styles.meta}>
          {cardLabel} • {tierLabel}
        </p>
      </div>
    </div>
  );
};

export default ProfileIdentity;
