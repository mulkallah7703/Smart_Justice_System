import type { ChangeEvent, DragEvent } from 'react';
import { useRef, useState } from 'react';

import Button from './Button';
import Icon from './Icon';
import styles from './FileUploadZone.module.css';

interface FileUploadZoneProps {
  title: string;
  hint: string;
  filesLabel: string;
  cameraLabel: string;
  onFiles: (files: File[]) => void;
  onRejected?: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

const FileUploadZone = ({
  title,
  hint,
  filesLabel,
  cameraLabel,
  onFiles,
  onRejected,
  accept = '.pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/*,.doc,.docx',
  maxSizeMB = 10,
  disabled = false,
}: FileUploadZoneProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const emitValidFiles = (list: FileList | File[]): void => {
    const maxBytes = maxSizeMB * 1024 * 1024;
    const all = Array.from(list);
    const files = all.filter((file) => file.size <= maxBytes);
    const rejected = all.filter((file) => file.size > maxBytes);

    if (files.length > 0) {
      onFiles(files);
    }
    if (rejected.length > 0) {
      onRejected?.(rejected);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files) {
      emitValidFiles(event.target.files);
      // Reset so selecting the same file again still fires a change event.
      event.target.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) {
      return;
    }
    if (event.dataTransfer.files) {
      emitValidFiles(event.dataTransfer.files);
    }
  };

  return (
    <div
      className={`${styles.zone} ${isDragOver ? styles.dragOver : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className={styles.iconWrap} aria-hidden="true">
        <Icon name="upload_file" size={24} />
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.hint}>{hint}</p>

      <div className={styles.actions}>
        <Button
          type="button"
          variant="primary"
          size="md"
          fullWidth
          icon="folder_open"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {filesLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          icon="photo_camera"
          className={styles.cameraBtn}
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          {cameraLabel}
        </Button>
      </div>

      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept={accept}
        multiple
        aria-label={filesLabel}
        disabled={disabled}
        onChange={handleChange}
      />
      <input
        ref={cameraRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={cameraLabel}
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  );
};

export default FileUploadZone;
