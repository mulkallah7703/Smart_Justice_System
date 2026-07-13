import styles from './StrengthMeter.module.css';

interface StrengthMeterProps {
  score: number;
  label: string;
  valueLabel: string;
  level?: 'strong' | 'medium' | 'weak';
  className?: string;
}

const resolveLevel = (
  score: number,
  level?: 'strong' | 'medium' | 'weak',
): 'strong' | 'medium' | 'weak' => {
  if (level) return level;
  if (score >= 75) return 'strong';
  if (score >= 45) return 'medium';
  return 'weak';
};

const scoreClass = (score: number): string => {
  const snapped = Math.min(100, Math.max(0, Math.round(score / 10) * 10));
  const key = `p${snapped}` as keyof typeof styles;
  return styles[key] ?? styles.p0;
};

const StrengthMeter = ({
  score,
  label,
  valueLabel,
  level,
  className = '',
}: StrengthMeterProps): JSX.Element => {
  const resolved = resolveLevel(score, level);
  const valueClass =
    resolved === 'strong'
      ? styles.strong
      : resolved === 'medium'
        ? styles.medium
        : styles.weak;
  const fillTone =
    resolved === 'strong'
      ? styles.fillStrong
      : resolved === 'medium'
        ? styles.fillMedium
        : styles.fillWeak;

  return (
    <div className={`${styles.meter} ${className}`}>
      <div className={styles.row}>
        <p className={styles.label}>{label}</p>
        <p className={`${styles.value} ${valueClass}`}>{valueLabel}</p>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(score)}
        aria-label={label}
      >
        <div
          className={`${styles.fill} ${fillTone} ${scoreClass(score)}`}
        />
      </div>
    </div>
  );
};

export default StrengthMeter;
