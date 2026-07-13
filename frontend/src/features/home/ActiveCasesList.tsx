import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import CaseCard from '../../shared/components/CaseCard';
import SectionHeader from '../../shared/components/SectionHeader';

import type { HomeCase } from './home.types';
import styles from './ActiveCasesList.module.css';

interface ActiveCasesListProps {
  cases: HomeCase[];
}

const ActiveCasesList = ({ cases }: ActiveCasesListProps): JSX.Element => {
  const navigate = useNavigate();

  return (
    <section className={styles.section}>
      <SectionHeader
        title={ar.home.cases.title}
        actionLabel={ar.home.cases.viewAll}
        onAction={() => navigate('/legal-file')}
      />

      <div className={styles.list}>
        {cases.map((caseItem) => (
          <CaseCard
            key={caseItem.id}
            title={caseItem.title}
            caseNumber={caseItem.caseNumber}
            status={caseItem.status}
            statusVariant={caseItem.statusVariant}
            icon={caseItem.icon}
            onClick={() => navigate('/legal-file')}
          />
        ))}
      </div>
    </section>
  );
};

export default ActiveCasesList;
