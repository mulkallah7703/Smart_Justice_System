import { useSearchParams, useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import ScreenShell from '../../shared/components/ScreenShell';

import AnalysisOrb from './AnalysisOrb';
import AnalysisStepCard from './AnalysisStepCard';
import AnalyzingHeader from './AnalyzingHeader';
import { useAnalysisJob } from './useAnalysisJob';
import styles from './AnalyzingLoader.module.css';

const AnalyzingLoader = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') ?? 'demo';
  const { steps, title, subtitle } = useAnalysisJob(jobId);

  return (
    <ScreenShell variant="dark" noNav>
      <div className={styles.screen}>
        <AnalyzingHeader
          title={ar.advisor.analyzing.headerTitle}
          onBack={() => navigate('/advisor')}
        />

        <div className={styles.body}>
          <AnalysisOrb />

          <div className={styles.copy}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          <div className={styles.steps}>
            {steps.map((step) => (
              <AnalysisStepCard
                key={step.id}
                label={step.label}
                status={step.status}
              />
            ))}
          </div>
        </div>

        <p className={styles.footer}>{ar.advisor.analyzing.footer}</p>
      </div>
    </ScreenShell>
  );
};

export default AnalyzingLoader;
