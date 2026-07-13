import Icon from '../../shared/components/Icon';

import type { AnalysisStepStatus } from './advisor.types';
import styles from './AnalysisStepCard.module.css';

interface AnalysisStepCardProps {
  label: string;
  status: AnalysisStepStatus;
}

const statusClassMap: Record<AnalysisStepStatus, string> = {
  done: styles.done,
  active: styles.active,
  pending: styles.pending,
};

const AnalysisStepCard = ({
  label,
  status,
}: AnalysisStepCardProps): JSX.Element => {
  return (
    <div className={`${styles.card} ${statusClassMap[status]}`}>
      <div className={styles.status} aria-hidden="true">
        {status === 'done' ? (
          <Icon name="check_circle" size={24} filled className={styles.check} />
        ) : null}
        {status === 'active' ? <span className={styles.spinner} /> : null}
        {status === 'pending' ? <span className={styles.pendingIcon} /> : null}
      </div>
      <p className={styles.label}>{label}</p>
    </div>
  );
};

export default AnalysisStepCard;
