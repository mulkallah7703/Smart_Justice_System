import { animationClass } from '../../core/theme/animations';
import Divider from '../../shared/components/Divider';

import ProfileIdentity from './ProfileIdentity';
import ProfileStatsGrid, { type ProfileStatItem } from './ProfileStatsGrid';
import styles from './ProfileSummaryCard.module.css';

interface ProfileSummaryCardProps {
  name: string;
  cardLabel: string;
  tierLabel: string;
  stats: ProfileStatItem[];
}

const ProfileSummaryCard = ({
  name,
  cardLabel,
  tierLabel,
  stats,
}: ProfileSummaryCardProps): JSX.Element => {
  return (
    <article className={`${styles.card} ${animationClass.fadeInUp} ${styles.cardDelay}`}>
      <ProfileIdentity name={name} cardLabel={cardLabel} tierLabel={tierLabel} />
      <Divider className={styles.divider} />
      <ProfileStatsGrid items={stats} />
    </article>
  );
};

export default ProfileSummaryCard;
