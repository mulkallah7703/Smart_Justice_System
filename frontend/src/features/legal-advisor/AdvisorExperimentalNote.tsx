import { ar } from '../../core/i18n/ar';

import { advisorExperimentalEnabled } from './advisorExperimental';
import styles from './AdvisorExperimentalNote.module.css';

interface AdvisorExperimentalNoteProps {
  tone?: 'light' | 'dark';
}

const AdvisorExperimentalNote = ({
  tone = 'light',
}: AdvisorExperimentalNoteProps): JSX.Element | null => {
  if (!advisorExperimentalEnabled()) {
    return null;
  }

  const noteClass = tone === 'dark' ? `${styles.note} ${styles.noteDark}` : styles.note;

  return (
    <div className={noteClass} role="note">
      <span className={styles.badge}>{ar.advisor.experimental.badge}</span>
      <p className={styles.disclaimer}>{ar.advisor.experimental.disclaimer}</p>
    </div>
  );
};

export default AdvisorExperimentalNote;
