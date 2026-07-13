import styles from './CountdownTimer.module.css';

interface CountdownTimerProps {
  timeLeft: string;
  showRing?: boolean;
  className?: string;
}

const CountdownTimer = ({
  timeLeft,
  showRing = false,
  className = '',
}: CountdownTimerProps): JSX.Element => {
  return (
    <div className={`${styles.wrap} ${className}`}>
      {showRing ? <span className={styles.ring} aria-hidden="true" /> : null}
      <span className={styles.time}>{timeLeft}</span>
    </div>
  );
};

export default CountdownTimer;
