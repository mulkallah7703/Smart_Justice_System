import styles from './FileUploadProgress.module.css';

interface FileUploadProgressProps {
  progress: number;
  className?: string;
}

const clampProgressClass = (progress: number): string => {
  const snapped = Math.min(100, Math.max(0, Math.round(progress / 5) * 5));
  const key = `p${snapped}` as keyof typeof styles;
  return styles[key] ?? styles.p0;
};

/** Feature-level progress bar (also mirrored inside FileRow for upload rows). */
const FileUploadProgress = ({
  progress,
  className = '',
}: FileUploadProgressProps): JSX.Element => {
  return (
    <div
      className={`${styles.track} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div className={`${styles.fill} ${clampProgressClass(progress)}`} />
    </div>
  );
};

export default FileUploadProgress;
