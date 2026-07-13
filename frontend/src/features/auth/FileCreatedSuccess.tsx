import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import { animationClass } from '../../core/theme/animations';
import Button from '../../shared/components/Button';
import ScreenShell from '../../shared/components/ScreenShell';

import ProfileSummaryCard from './ProfileSummaryCard';
import SuccessHeader from './SuccessHeader';
import styles from './FileCreatedSuccess.module.css';

const FileCreatedSuccess = (): JSX.Element => {
  const navigate = useNavigate();

  const handleGoHome = (): void => {
    navigate('/', { replace: true });
  };

  const stats = [
    { value: ar.success.stats.cases, label: ar.success.stats.casesLabel },
    { value: ar.success.stats.appointments, label: ar.success.stats.appointmentsLabel },
    { value: ar.success.stats.documents, label: ar.success.stats.documentsLabel },
  ];

  return (
    <ScreenShell noNav variant="default">
      <div className={`${styles.screen} ${animationClass.screenEnter}`}>
        <main className={styles.main}>
          <SuccessHeader
            title={ar.success.title}
            description={ar.success.description}
          />

          <ProfileSummaryCard
            name={ar.success.profile.name}
            cardLabel={ar.success.profile.cardLabel}
            tierLabel={ar.success.profile.tierLabel}
            stats={stats}
          />
        </main>

        <footer className={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            icon="arrow_back"
            iconPosition="end"
            className={`${animationClass.fadeInUp} ${styles.ctaDelay}`}
            onClick={handleGoHome}
          >
            {ar.success.cta}
          </Button>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default FileCreatedSuccess;
