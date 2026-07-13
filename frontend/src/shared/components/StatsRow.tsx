import styles from './StatsRow.module.css';

export interface StatItem {
  label: string;
  value: string | number;
}

interface StatsRowProps {
  stats: StatItem[];
  className?: string;
}

const StatsRow = ({ stats, className = '' }: StatsRowProps): JSX.Element => {
  return (
    <div className={`${styles.row} ${className}`}>
      {stats.map((stat) => (
        <div key={`${stat.label}-${stat.value}`} className={styles.item}>
          <p className={styles.value}>{stat.value}</p>
          <p className={styles.label}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
};

export default StatsRow;
