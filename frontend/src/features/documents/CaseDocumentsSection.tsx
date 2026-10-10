import { ar } from '../../core/i18n/ar';
import FileUploadZone from '../../shared/components/FileUploadZone';

import DocumentList from './DocumentList';
import {
  DOCUMENT_ACCEPT_ATTRIBUTE,
  MAX_DOCUMENT_SIZE_MB,
} from './documentValidation';
import { useDocuments } from './useDocuments';

import styles from './CaseDocumentsSection.module.css';

interface CaseDocumentsSectionProps {
  caseId: string;
}

const CaseDocumentsSection = ({
  caseId,
}: CaseDocumentsSectionProps): JSX.Element => {
  const {
    documents,
    isLoading,
    isUploading,
    downloadingId,
    errorMessage,
    upload,
    download,
  } = useDocuments(caseId);

  const handleFiles = (files: File[]): void => {
    const [file] = files;
    if (file) {
      void upload(file);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{ar.documents.sectionTitle}</h2>

      <FileUploadZone
        title={ar.documents.uploadTitle}
        hint={ar.documents.uploadHint}
        filesLabel={ar.documents.filesBtn}
        cameraLabel={ar.documents.cameraBtn}
        accept={DOCUMENT_ACCEPT_ATTRIBUTE}
        maxSizeMB={MAX_DOCUMENT_SIZE_MB}
        disabled={isUploading}
        onFiles={handleFiles}
        onRejected={handleFiles}
      />

      {isUploading ? (
        <p className={styles.status} role="status">
          {ar.documents.uploading}
        </p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && documents.length === 0 ? (
        <p className={styles.emptyLine}>
          {ar.legalFile.empty.caseDocuments.body}
        </p>
      ) : null}

      {!isLoading && documents.length > 0 ? (
        <DocumentList
          documents={documents}
          downloadingId={downloadingId}
          onDownload={(item) => {
            void download(item);
          }}
        />
      ) : null}
    </section>
  );
};

export default CaseDocumentsSection;
