import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import { animationClass } from '../../core/theme/animations';
import { splash as splashTokens } from '../../core/theme/tokens';
import ProgressBar from '../../shared/components/ProgressBar';
import ScreenShell from '../../shared/components/ScreenShell';

import { authStore } from './authStore';
import SplashLogo from './SplashLogo';
import SplashTrustBadge from './SplashTrustBadge';
import styles from './SplashScreen.module.css';

const SplashScreen = (): JSX.Element => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hasToken = Boolean(authStore.getState().accessToken);
      navigate(hasToken ? '/' : '/onboarding', { replace: true });
    }, splashTokens.durationMs);

    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <ScreenShell noNav variant="primary">
      <div className={styles.screen}>
        <div className={styles.content}>
          <SplashLogo />

          <h1 className={`${styles.title} ${animationClass.fadeInUp}`}>{ar.splash.title}</h1>

          <div className={styles.accent} aria-hidden="true" />

          <p className={`${styles.subtitle} ${animationClass.fadeInUp} ${styles.subtitleDelay}`}>
            {ar.splash.subtitle}
          </p>
        </div>

        <footer className={styles.footer}>
          <SplashTrustBadge label={ar.splash.trustBadge} />
          <ProgressBar variant="splash" className={styles.progress} />
        </footer>
      </div>
    </ScreenShell>
  );
};

export default SplashScreen;
