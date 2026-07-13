import styles from './StepIndicator.module.css';

interface StepIndicatorProps {
  totalSteps: number;
  currentStep: number;
  className?: string;
}

const StepIndicator = ({
  totalSteps,
  currentStep,
  className = '',
}: StepIndicatorProps): JSX.Element => {
  return (
    <div
      className={`${styles.container} ${className}`}
      role="tablist"
      aria-label="مؤشر الصفحات"
    >
      {Array.from({ length: totalSteps }, (_, index) => {
        const isActive = index === currentStep;

        return (
          <span
            key={index}
            className={`${styles.dot} ${isActive ? styles.active : ''}`}
            role="tab"
            aria-selected={isActive}
            aria-label={`الصفحة ${index + 1}`}
          />
        );
      })}
    </div>
  );
};

export default StepIndicator;
