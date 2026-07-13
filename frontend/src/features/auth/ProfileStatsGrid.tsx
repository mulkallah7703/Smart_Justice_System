import { Fragment } from 'react';

import { toArabicNumerals } from '../../shared/utils/arabicNumerals';
import Divider from '../../shared/components/Divider';

import styles from './ProfileStatsGrid.module.css';

export interface ProfileStatItem {
  value: number;
  label: string;
}

interface ProfileStatsGridProps {
  items: ProfileStatItem[];
}

const ProfileStatsGrid = ({ items }: ProfileStatsGridProps): JSX.Element => {
  return (
    <div className={styles.grid} role="list">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? <Divider orientation="vertical" className={styles.divider} /> : null}
          <div className={styles.stat} role="listitem">
            <span className={styles.value}>{toArabicNumerals(item.value)}</span>
            <span className={styles.label}>{item.label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
};

export default ProfileStatsGrid;
