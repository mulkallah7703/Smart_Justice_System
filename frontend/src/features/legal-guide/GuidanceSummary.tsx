import { useNavigate, useParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import AlertBanner from '../../shared/components/AlertBanner';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import Icon from '../../shared/components/Icon';
import ReportSection from '../../shared/components/ReportSection';
import ScreenShell from '../../shared/components/ScreenShell';

import DurationCard from './DurationCard';
import SummaryFieldCard from './SummaryFieldCard';
import { useGuidanceSummary } from './useGuidanceSummary';
import styles from './GuidanceSummary.module.css';

const GuidanceSummary = (): JSX.Element => {
  const navigate = useNavigate();
  const { sessionId = 'demo' } = useParams<{ sessionId: string }>();
  const { summary, isLoading } = useGuidanceSummary(sessionId);

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.guide.summary.title}
          onBack={() => navigate(-1)}
        />

        <div className={styles.content}>
          {!isLoading && summary ? (
            <>
              <AlertBanner
                variant="success"
                icon="check_circle"
                message={summary.resultTitle}
              >
                <p className={styles.resultBody}>{summary.resultBody}</p>
              </AlertBanner>

              <SummaryFieldCard
                label={summary.caseTypeLabel}
                value={summary.caseTypeValue}
                icon="category"
              />

              <SummaryFieldCard
                label={summary.authorityLabel}
                value={summary.authorityValue}
                icon="account_balance"
              />

              <DurationCard
                label={summary.durationLabel}
                value={summary.durationValue}
                days={summary.durationDays}
                unit={summary.durationUnit}
              />

              <ReportSection title={summary.docsTitle} icon="description">
                {summary.docs.map((doc) => (
                  <div key={doc.id} className={styles.docRow}>
                    <Icon
                      name={doc.done ? 'check_circle' : 'radio_button_unchecked'}
                      size={20}
                      filled={doc.done}
                      className={
                        doc.done ? styles.docIconDone : styles.docIconPending
                      }
                    />
                    <p className={styles.docLabel}>{doc.label}</p>
                  </div>
                ))}
              </ReportSection>

              <ReportSection title={summary.stepsTitle} icon="format_list_numbered">
                {summary.steps.map((step, index) => {
                  const isActive = index === 0;

                  return (
                    <div key={step.number} className={styles.stepRow}>
                      <span
                        className={`${styles.stepBadge} ${
                          isActive ? styles.stepActive : styles.stepPending
                        }`}
                      >
                        {step.number}
                      </span>
                      <p className={styles.stepLabel}>{step.label}</p>
                    </div>
                  );
                })}
              </ReportSection>
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            className={styles.secondaryBtn}
            onClick={() => navigate('/legal-file')}
          >
            {ar.guide.summary.saveToFile}
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => navigate('/lawyers')}
          >
            {ar.guide.summary.consultLawyer}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
};

export default GuidanceSummary;
