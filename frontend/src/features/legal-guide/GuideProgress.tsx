import styles from './GuideProgress.module.css';

interface GuideProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

const stepFillClass = (
  currentStep: number,
  totalSteps: number,
): string => {
  if (totalSteps <= 0 || currentStep <= 0) {
    return styles.step0;
  }

  const ratio = currentStep / totalSteps;
  if (ratio >= 1) return styles.step4;
  if (ratio >= 0.75) return styles.step3;
  if (ratio >= 0.5) return styles.step2;
  if (ratio >= 0.25) return styles.step1;
  return styles.step0;
};

const GuideProgress = ({
  currentStep,
  totalSteps,
  className = '',
}: GuideProgressProps): JSX.Element => {
  const safeTotal = Math.max(totalSteps, 1);
  const safeCurrent = Math.min(Math.max(currentStep, 0), safeTotal);
  const percent = Math.round((safeCurrent / safeTotal) * 100);

  return (
    <div className={`${styles.wrap} ${className}`}>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`الخطوة ${safeCurrent} من ${safeTotal}`}
      >
        <div
          className={`${styles.fill} ${stepFillClass(safeCurrent, safeTotal)}`}
        />
      </div>
    </div>
  );
};

export default GuideProgress;
