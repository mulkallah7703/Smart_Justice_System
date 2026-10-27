import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AlertBanner from '../../shared/components/AlertBanner';
import CaseCard from '../../shared/components/CaseCard';
import EmptyState from '../../shared/components/EmptyState';
import { ar } from '../../core/i18n/ar';

import AddCaseCard from './AddCaseCard';
import { createLegalCase } from './legalFileApi';

import type { BackendCaseType } from './cases.types';
import type { LegalCase } from './legalFile.types';
import styles from './CasesTab.module.css';

interface CasesTabProps {
  cases: LegalCase[];
  isLoading: boolean;
  onCreated?: () => void;
}

const CASE_TYPES: BackendCaseType[] = [
  'RENTAL',
  'COMMERCIAL',
  'PERSONAL',
  'LABOR',
  'CRIMINAL',
];

const CasesTab = ({
  cases,
  isLoading,
  onCreated,
}: CasesTabProps): JSX.Element => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [caseType, setCaseType] = useState<BackendCaseType>('PERSONAL');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      <AddCaseCard onClick={() => setShowForm(true)} />
      {showForm ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) {
              return;
            }
            setSaving(true);
            setFormError(null);
            void createLegalCase({ type: caseType })
              .then(() => {
                setShowForm(false);
                onCreated?.();
              })
              .catch(() => {
                setFormError(ar.legalFile.addCaseFailed);
              })
              .finally(() => {
                setSaving(false);
              });
          }}
        >
          <label>
            {ar.legalFile.addCaseTypeLabel}
            <select
              aria-label={ar.legalFile.addCaseTypeLabel}
              value={caseType}
              onChange={(event) => setCaseType(event.target.value as BackendCaseType)}
            >
              {CASE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ar.legalFile.caseTypes[type]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={saving}>
            {ar.legalFile.addCaseSubmit}
          </button>
        </form>
      ) : null}
      {formError ? <AlertBanner variant="info" message={formError} /> : null}
    </div>
  );
};

export default CasesTab;
