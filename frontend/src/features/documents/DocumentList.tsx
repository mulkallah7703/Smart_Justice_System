import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';
import StatusBadge from '../../shared/components/StatusBadge';

import type { DocumentKind, FrontendDocument } from './documents.types';
import styles from './DocumentList.module.css';

interface DocumentListProps {
  documents: FrontendDocument[];
  downloadingId: string | null;
  onDownload: (document: FrontendDocument) => void;
}

const kindIconMap: Record<DocumentKind, string> = {
  pdf: 'picture_as_pdf',
  image: 'image',
  doc: 'description',
};

const DocumentList = ({
  documents,
  downloadingId,
  onDownload,
}: DocumentListProps): JSX.Element => {
  return (
    <ul className={styles.list} aria-label={ar.documents.listAria}>
      {documents.map((item) => {
        const isDownloading = downloadingId === item.id;

        return (
          <li key={item.id} className={styles.item}>
            <span className={styles.iconWrap} aria-hidden="true">
              <Icon name={kindIconMap[item.kind]} size={20} />
            </span>

            <div className={styles.body}>
              <p className={styles.name}>{item.name}</p>
              <p className={styles.meta}>
                {item.sizeLabel} • {item.createdAtLabel}
              </p>
              <div className={styles.badges}>
                <StatusBadge
                  label={item.statusLabel}
                  variant={item.statusVariant}
                />
                {item.isAnalyzed ? (
                  <span className={styles.analyzed}>{ar.documents.analyzed}</span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              className={styles.download}
              aria-label={`${ar.documents.downloadAria} ${item.name}`}
              aria-busy={isDownloading}
              disabled={isDownloading}
              onClick={() => onDownload(item)}
            >
              <Icon name={isDownloading ? 'hourglass_top' : 'download'} size={20} />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default DocumentList;
