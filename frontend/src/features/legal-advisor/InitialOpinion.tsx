import { useNavigate, useSearchParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import AICard from '../../shared/components/AICard';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import ScreenShell from '../../shared/components/ScreenShell';

import AdvisorExperimentalNote from './AdvisorExperimentalNote';
import FindingCard from './FindingCard';
import OpinionDisclaimer from './OpinionDisclaimer';
import { useAdvisorQuestion } from './useAdvisor';
import styles from './InitialOpinion.module.css';

const InitialOpinion = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') ?? '';
  const {
    query,
    setQuery,
    phase,
    answer,
    findings,
    errorMessage,
    isBusy,
    submit,
  } = useAdvisorQuestion(jobId || 'demo');

  const loadingLabel =
    phase === 'retrieving'
      ? ar.advisor.opinion.retrieving
      : phase === 'answering'
        ? ar.advisor.opinion.answering
        : null;

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.advisor.opinion.headerTitle}
          onBack={() => navigate(-1)}
        />

        <div className={styles.content}>
          <AdvisorExperimentalNote />
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {ar.advisor.opinion.readyTitle}
            </h2>
            <p className={styles.readyBody}>{ar.advisor.opinion.readyBody}</p>
          </div>

          <label className={styles.questionField}>
            <span className={styles.questionLabel}>
              {ar.advisor.opinion.questionLabel}
            </span>
            <textarea
              className={styles.questionInput}
              value={query}
              disabled={isBusy}
              rows={4}
              placeholder={ar.advisor.opinion.questionPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <Button
            variant="ai"
            size="md"
            fullWidth
            icon="auto_awesome"
            iconFilled
            disabled={isBusy || !query.trim()}
            onClick={() => {
              void submit();
            }}
          >
            {ar.advisor.opinion.askCta}
          </Button>

          {loadingLabel ? (
            <p className={styles.status} role="status">
              {loadingLabel}
            </p>
          ) : null}

          {errorMessage ? (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}

          {answer?.insufficientEvidence ? (
            <AICard
              title={ar.advisor.opinion.insufficientTitle}
              body={ar.advisor.opinion.insufficientBody}
              icon="info"
            />
          ) : null}

          {answer && !answer.insufficientEvidence ? (
            <>
              <AICard
                title={ar.advisor.opinion.answerTitle}
                body={answer.answer}
                icon="auto_awesome"
              />

              {findings.length > 0 ? (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    {ar.advisor.opinion.claimsTitle}
                  </h2>
                  <div className={styles.list}>
                    {findings.map((finding) => (
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
              ) : null}
            </>
          ) : null}

          <OpinionDisclaimer message={ar.advisor.opinion.disclaimer} />
        </div>

        <div className={styles.footer}>
          <Button
            variant="ai"
            size="lg"
            fullWidth
            icon="description"
            className={styles.cta}
            disabled={!answer}
            onClick={() =>
              navigate(`/advisor/report/${encodeURIComponent(jobId || 'demo')}`)
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
