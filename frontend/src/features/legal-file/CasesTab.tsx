import { useNavigate } from 'react-router-dom';

import CaseCard from '../../shared/components/CaseCard';
import EmptyState from '../../shared/components/EmptyState';
import { ar } from '../../core/i18n/ar';

import AddCaseCard from './AddCaseCard';

import type { LegalCase } from './legalFile.types';
import styles from './CasesTab.module.css';

interface CasesTabProps {
  cases: LegalCase[];
  isLoading: boolean;
  onAddCase?: () => void;
}

const CasesTab = ({
  cases,
  isLoading,
  onAddCase,
}: CasesTabProps): JSX.Element => {
  const navigate = useNavigate();

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
      <AddCaseCard onClick={onAddCase} />
    </div>
  );
};

export default CasesTab;
