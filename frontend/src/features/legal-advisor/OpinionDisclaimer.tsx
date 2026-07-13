import Icon from '../../shared/components/Icon';

import styles from './OpinionDisclaimer.module.css';

interface OpinionDisclaimerProps {
  message: string;
}

const OpinionDisclaimer = ({
  message,
}: OpinionDisclaimerProps): JSX.Element => {
  return (
    <div className={styles.banner} role="note">
      <Icon name="gavel" size={20} className={styles.icon} />
      <p className={styles.message}>{message}</p>
    </div>
  );
};

export default OpinionDisclaimer;
