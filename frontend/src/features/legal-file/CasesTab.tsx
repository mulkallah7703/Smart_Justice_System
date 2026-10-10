import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import CaseCard from '../../shared/components/CaseCard';
import EmptyState from '../../shared/components/EmptyState';
import { ar } from '../../core/i18n/ar';
import { ApiError, getUserFacingCaseError } from '../../shared/api/errors';

import AddCaseCard from './AddCaseCard';
import { createLegalCase } from './legalFileApi';

import type { BackendCaseType } from './cases.types';
import type { LegalCase } from './legalFile.types';
import styles from './CasesTab.module.css';

const CASE_TYPES: BackendCaseType[] = [
  'RENTAL',
  'COMMERCIAL',
  'PERSONAL',
  'LABOR',
];

interface CasesTabProps {
  cases: LegalCase[];
  isLoading: boolean;
  onCreated?: () => void;
}

const CasesTab = ({
  cases,
  isLoading,
  onCreated,
}: CasesTabProps): JSX.Element => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<BackendCaseType>('RENTAL');
  const [authority, setAuthority] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createLegalCase({
        type,
        authority,
        notes,
      });
      setIsOpen(false);
      setAuthority('');
      setNotes('');
      onCreated?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CASE_RATE_LIMITED') {
        setErrorMessage(ar.legalFile.createCase.rateLimited);
      } else if (error instanceof ApiError) {
        setErrorMessage(getUserFacingCaseError(error));
      } else {
        setErrorMessage(ar.legalFile.createCase.generic);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {isOpen ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <h2 className={styles.formTitle}>{ar.legalFile.createCase.title}</h2>
          <label className={styles.field}>
            <span>{ar.legalFile.createCase.typeLabel}</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as BackendCaseType)}
            >
              {CASE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {ar.legalFile.caseTypes[option]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{ar.legalFile.createCase.authorityLabel}</span>
            <input
              value={authority}
              maxLength={200}
              placeholder={ar.legalFile.createCase.authorityPlaceholder}
              onChange={(event) => setAuthority(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>{ar.legalFile.createCase.notesLabel}</span>
            <textarea
              value={notes}
              maxLength={2000}
              rows={3}
              placeholder={ar.legalFile.createCase.notesPlaceholder}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {errorMessage ? (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              {ar.legalFile.createCase.cancel}
            </button>
            <button type="submit" className={styles.primary} disabled={isSubmitting}>
              {isSubmitting
                ? ar.legalFile.createCase.submitting
                : ar.legalFile.createCase.submit}
            </button>
          </div>
        </form>
      ) : (
        <AddCaseCard
          onClick={() => {
            setErrorMessage(null);
            setIsOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default CasesTab;
