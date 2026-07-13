import CaseCard from '../../shared/components/CaseCard';

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
  return (
    <div className={styles.list}>
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
              footer={item.footer}
            />
          ))
        : null}
      <AddCaseCard onClick={onAddCase} />
    </div>
  );
};

export default CasesTab;
