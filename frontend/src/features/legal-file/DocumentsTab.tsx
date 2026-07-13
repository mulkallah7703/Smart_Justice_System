import { ar } from '../../core/i18n/ar';
import EmptyState from '../../shared/components/EmptyState';

const DocumentsTab = (): JSX.Element => {
  return (
    <EmptyState
      icon="folder_open"
      title={ar.legalFile.empty.documents.title}
      body={ar.legalFile.empty.documents.body}
    />
  );
};

export default DocumentsTab;
