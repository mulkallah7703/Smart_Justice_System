import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AlertBanner from '../../shared/components/AlertBanner';
import CaseCard from '../../shared/components/CaseCard';
import EmptyState from '../../shared/components/EmptyState';
import { ar } from '../../core/i18n/ar';

import AddCaseCard from './AddCaseCard';

import type { LegalCase } from './legalFile.types';
import styles from './CasesTab.module.css';

interface CasesTabProps {
  cases: LegalCase[];
  isLoading: boolean;
}

const CasesTab = ({ cases, isLoading }: CasesTabProps): JSX.Element => {
  const navigate = useNavigate();
  // There is no case-linking workflow yet (cases are read-only and linked server-side);
  // the action must say so instead of creating or implying a court case.
  const [showUnavailable, setShowUnavailable] = useState(false);

  return (
    <div className={styles.list}>
      {!isLoading && cases.length === 0 ? (
        <EmptyState
          icon="domain"
          title={ar.legalFile.empty.cases.title}
          body={ar.legalFile.empty.cases.body}
        />
      ) : null}
      {!isLoading
        ? cases.map((item) => (
            <CaseCard
              key={item.id}
              layout="detailed"
              title={item.title}
              caseNumber={item.subtitle}
              status={item.status}
              statusVariant={item.statusVariant}
              accent={item.accent}
              footer={item.footer ?? undefined}
              onClick={() => navigate(`/legal-file/${item.id}`)}
            />
          ))
        : null}
      <AddCaseCard onClick={() => setShowUnavailable(true)} />
      {showUnavailable ? (
        <AlertBanner variant="info" message={ar.legalFile.addCaseUnavailable} />
      ) : null}
    </div>
  );
};

export default CasesTab;
