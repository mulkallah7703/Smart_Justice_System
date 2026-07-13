import Icon from '../../shared/components/Icon';

import styles from './AlertCountdown.module.css';

interface AlertCountdownProps {
  timeLeft: string;
  label: string;
}

const AlertCountdown = ({ timeLeft, label }: AlertCountdownProps): JSX.Element => {
  return (
    <div className={styles.box}>
      <Icon name="schedule" size={20} className={styles.icon} />
      <div className={styles.content}>
        <span className={styles.time}>{timeLeft}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
};

export default AlertCountdown;
