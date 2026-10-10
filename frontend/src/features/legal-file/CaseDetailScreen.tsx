import { useNavigate, useParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import CaseCard from '../../shared/components/CaseCard';
import EmptyState from '../../shared/components/EmptyState';
import Header from '../../shared/components/Header';
import Icon from '../../shared/components/Icon';
import ScreenShell from '../../shared/components/ScreenShell';
import CaseDocumentsSection from '../documents/CaseDocumentsSection';

import { useCaseDetail } from './useCaseDetail';

import styles from './CaseDetailScreen.module.css';

const CaseDetailScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const { caseId = '' } = useParams<{ caseId: string }>();
  const { detail, isLoading, notFound } = useCaseDetail(caseId);

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.legalFile.detailTitle}
          onBack={() => navigate(-1)}
        />

        <div className={styles.content}>
          {!isLoading && notFound ? (
            <EmptyState
              icon="domain"
              title={ar.legalFile.notFound.title}
              body={ar.legalFile.notFound.body}
            />
          ) : null}

          {!isLoading && detail ? (
            <>
              <CaseCard
                layout="detailed"
                title={detail.title}
                caseNumber={detail.subtitle}
                status={detail.status}
                statusVariant={detail.statusVariant}
                accent={detail.accent}
                footer={detail.footer ?? undefined}
              />

              {detail.notes ? (
                <p className={styles.notes}>{detail.notes}</p>
              ) : null}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  {ar.legalFile.hearingsTitle}
                </h2>
                {detail.hearings.length === 0 ? (
                  <p className={styles.emptyLine}>{ar.legalFile.noHearings}</p>
                ) : (
                  <ul className={styles.relationList}>
                    {detail.hearings.map((hearing) => (
                      <li key={hearing.id} className={styles.relationItem}>
                        <Icon name="event" size={20} className={styles.relationIcon} />
                        <div className={styles.relationBody}>
                          <p className={styles.relationTitle}>
                            {hearing.scheduledAtLabel}
                          </p>
                          {hearing.location ? (
                            <p className={styles.relationMeta}>{hearing.location}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  {ar.legalFile.deadlinesTitle}
                </h2>
                {detail.deadlines.length === 0 ? (
                  <p className={styles.emptyLine}>{ar.legalFile.noDeadlines}</p>
                ) : (
                  <ul className={styles.relationList}>
                    {detail.deadlines.map((deadline) => (
                      <li key={deadline.id} className={styles.relationItem}>
                        <Icon
                          name="schedule"
                          size={20}
                          className={styles.relationIcon}
                        />
                        <div className={styles.relationBody}>
                          <p className={styles.relationTitle}>{deadline.label}</p>
                          <p className={styles.relationMeta}>{deadline.dueAtLabel}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <CaseDocumentsSection caseId={detail.id} />
            </>
          ) : null}
        </div>
      </div>
    </ScreenShell>
  );
};

export default CaseDetailScreen;
