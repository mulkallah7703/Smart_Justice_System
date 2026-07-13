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
  accept?: string;
  maxSizeMB?: number;
}

const FileUploadZone = ({
  title,
  hint,
  filesLabel,
  cameraLabel,
  onFiles,
  accept = '.pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/*,.doc,.docx',
  maxSizeMB = 20,
}: FileUploadZoneProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const emitValidFiles = (list: FileList | File[]): void => {
    const files = Array.from(list).filter(
      (file) => file.size <= maxSizeMB * 1024 * 1024,
    );
    if (files.length > 0) {
      onFiles(files);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files) {
      emitValidFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragOver(false);
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
        onChange={handleChange}
      />
      <input
        ref={cameraRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
      />
    </div>
  );
};

export default FileUploadZone;
