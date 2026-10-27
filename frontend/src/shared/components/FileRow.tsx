import Icon from './Icon';

import styles from './FileRow.module.css';

type FileRowStatus = 'uploading' | 'done' | 'error';
type FileRowKind = 'pdf' | 'image' | 'doc';

interface FileRowProps {
  name: string;
  sizeMB: number;
  progress: number;
  status: FileRowStatus;
  kind?: FileRowKind;
  doneLabel: string;
  onRemove?: () => void;
}

const kindIconMap: Record<FileRowKind, string> = {
  pdf: 'picture_as_pdf',
  image: 'image',
  doc: 'description',
};

const kindClassMap: Record<FileRowKind, string> = {
  pdf: styles.iconPdf,
  image: styles.iconImage,
  doc: styles.iconDoc,
};

/** Megabytes under 1 are shown in KB so a 270 KB file is not labelled 270 MB. */
export const formatSizeLabel = (sizeMB: number): string => {
  if (!Number.isFinite(sizeMB) || sizeMB <= 0) {
    return '0 ك.ب';
  }
  if (sizeMB < 1) {
    return `${Math.max(1, Math.round(sizeMB * 1024))} ك.ب`;
  }
  const rounded = Math.round(sizeMB * 10) / 10;
  return `${rounded} م.ب`;
};

const progressFillClass = (progress: number): string => {
  const snapped = Math.min(100, Math.max(0, Math.round(progress / 5) * 5));
  const key = `p${snapped}` as keyof typeof styles;
  return styles[key] ?? styles.p0;
};

const FileRow = ({
  name,
  sizeMB,
  progress,
  status,
  kind = 'doc',
  doneLabel,
  onRemove,
}: FileRowProps): JSX.Element => {
  const sizeLabel = formatSizeLabel(sizeMB);

  return (
    <div className={styles.row}>
      <div
        className={`${styles.iconWrap} ${kindClassMap[kind]}`}
        aria-hidden="true"
      >
        <Icon name={kindIconMap[kind]} size={20} />
      </div>

      <div className={styles.content}>
        <p className={styles.name}>{name}</p>
        {status === 'done' ? (
          <p className={styles.meta}>
            {sizeLabel} - {doneLabel}
          </p>
        ) : null}
        {status === 'uploading' ? (
          <div className={styles.progressBlock}>
            <div className={styles.progressRow}>
              <span className={styles.percent}>{Math.round(progress)}%</span>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className={`${styles.fill} ${progressFillClass(progress)}`}
              />
            </div>
          </div>
        ) : null}
        {status === 'error' ? (
          <p className={`${styles.meta} ${styles.error}`}>تعذر الرفع</p>
        ) : null}
      </div>

      {status === 'done' ? (
        <Icon
          name="check_circle"
          size={24}
          filled
          className={`${styles.statusIcon} ${styles.done}`}
        />
      ) : null}

      {status === 'error' && onRemove ? (
        <button type="button" onClick={onRemove} aria-label="إزالة الملف">
          <Icon name="close" size={20} className={styles.error} />
        </button>
      ) : null}
    </div>
  );
};

export default FileRow;
