import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Button from '../../shared/components/Button';
import ScreenShell from '../../shared/components/ScreenShell';
import StepIndicator from '../../shared/components/StepIndicator';

import OnboardingServiceList from './OnboardingServiceList';
import styles from './OnboardingScreen.module.css';

const OnboardingScreen = (): JSX.Element => {
  const navigate = useNavigate();

  const handleContinue = (): void => {
    navigate('/auth/verify');
  };

  return (
    <ScreenShell noNav variant="default">
      <div className={styles.screen}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.skip}
            onClick={handleContinue}
            aria-label={ar.onboarding.skip}
          >
            {ar.onboarding.skip}
          </button>
        </header>

        <main className={styles.main}>
          <section className={styles.intro}>
            <h1 className={styles.title}>{ar.onboarding.title}</h1>
            <p className={styles.subtitle}>{ar.onboarding.subtitle}</p>
          </section>

          <OnboardingServiceList />
        </main>

        <footer className={styles.footer}>
          <StepIndicator totalSteps={3} currentStep={0} />
          <Button
            variant="primary"
            size="xl"
            icon="verified_user"
            iconFilled
            iconTone="gold"
            onClick={handleContinue}
          >
            {ar.onboarding.cta}
          </Button>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default OnboardingScreen;
