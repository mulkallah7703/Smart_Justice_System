import { animationClass } from '../../core/theme/animations';

import styles from './SplashLogo.module.css';

const SplashLogo = (): JSX.Element => {
  return (
    <div className={styles.wrapper}>
      <div className={`${styles.ring} ${animationClass.ringPulse}`} aria-hidden="true" />
      <div className={`${styles.container} ${animationClass.fadeInUp}`}>
        <svg
          className={styles.icon}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M24 6V42"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 12H38"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 12L14 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M38 12L34 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 24H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M28 24H40"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 24C8 24 8 32 14 32C20 32 20 24 20 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M28 24C28 24 28 32 34 32C40 32 40 24 40 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="24" cy="6" r="2.5" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
};

export default SplashLogo;
