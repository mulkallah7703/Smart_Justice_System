import { ar } from '../../core/i18n/ar';
import EmptyState from '../../shared/components/EmptyState';
import DocumentList from '../documents/DocumentList';
import { useDocuments } from '../documents/useDocuments';

import styles from './DocumentsTab.module.css';

const DocumentsTab = (): JSX.Element => {
  const { documents, isLoading, downloadingId, errorMessage, download } =
    useDocuments();

  if (isLoading) {
    return <div className={styles.tab} />;
  }

  return (
    <div className={styles.tab}>
      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title={ar.legalFile.empty.documents.title}
          body={ar.legalFile.empty.documents.body}
        />
      ) : (
        <DocumentList
          documents={documents}
          downloadingId={downloadingId}
          onDownload={(item) => {
            void download(item);
          }}
        />
      )}
    </div>
  );
};

export default DocumentsTab;
