import { animationClass } from '../../core/theme/animations';

import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  variant?: 'default' | 'splash';
  className?: string;
}

const ProgressBar = ({
  variant = 'default',
  className = '',
}: ProgressBarProps): JSX.Element => {
  const variantClass = variant === 'splash' ? styles.splash : styles.default;

  return (
    <div
      className={`${styles.track} ${variantClass} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="جاري التحميل"
    >
      <div
        className={`${styles.fill} ${variant === 'splash' ? styles.splashFill : ''} ${animationClass.splashProgressFill}`}
      />
    </div>
  );
};

export default ProgressBar;
