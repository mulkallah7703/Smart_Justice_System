import { useNavigate, useSearchParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import AICard from '../../shared/components/AICard';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import ScreenShell from '../../shared/components/ScreenShell';
import StrengthMeter from '../../shared/components/StrengthMeter';

import FindingCard from './FindingCard';
import OpinionDisclaimer from './OpinionDisclaimer';
import { useInitialOpinion } from './useInitialOpinion';
import styles from './InitialOpinion.module.css';

const InitialOpinion = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') ?? 'demo';
  const { opinion, isLoading } = useInitialOpinion(jobId);

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.advisor.opinion.headerTitle}
          onBack={() => navigate(-1)}
        />

        <div className={styles.content}>
          {!isLoading && opinion ? (
            <>
              <AICard
                title={opinion.summaryTitle}
                body={opinion.summaryBody}
                icon="auto_awesome"
              >
                <StrengthMeter
                  score={opinion.strengthScore}
                  label={opinion.strengthLabel}
                  valueLabel={opinion.strengthValue}
                  level={opinion.strengthLevel}
                />
              </AICard>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>{opinion.findingsTitle}</h2>
                <div className={styles.list}>
                  {opinion.findings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      title={finding.title}
                      subtitle={finding.subtitle}
                      icon={finding.icon}
                      tone={finding.tone}
                    />
                  ))}
                </div>
              </div>

              <OpinionDisclaimer message={opinion.disclaimer} />
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          <Button
            variant="ai"
            size="lg"
            fullWidth
            icon="description"
            className={styles.cta}
            disabled={!opinion}
            onClick={() =>
              navigate(`/advisor/report/${opinion?.jobId ?? jobId}`)
            }
          >
            {ar.advisor.opinion.cta}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
};

export default InitialOpinion;
