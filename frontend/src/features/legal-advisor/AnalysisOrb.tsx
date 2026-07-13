import Icon from '../../shared/components/Icon';

import styles from './AnalysisOrb.module.css';

interface AnalysisOrbProps {
  className?: string;
}

const AnalysisOrb = ({ className = '' }: AnalysisOrbProps): JSX.Element => {
  return (
    <div className={`${styles.wrap} ${className}`} aria-hidden="true">
      <span className={styles.ring} />
      <span className={styles.ringActive} />
      <div className={styles.orb}>
        <div className={styles.inner}>
          <Icon name="auto_awesome" size={32} filled className={styles.icon} />
        </div>
      </div>
    </div>
  );
};

export default AnalysisOrb;
