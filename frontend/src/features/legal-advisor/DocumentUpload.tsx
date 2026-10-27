import { useLocation, useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Button from '../../shared/components/Button';
import FileRow from '../../shared/components/FileRow';
import FileUploadZone from '../../shared/components/FileUploadZone';
import Header from '../../shared/components/Header';
import ScreenShell from '../../shared/components/ScreenShell';

import AdvisorExperimentalNote from './AdvisorExperimentalNote';
import { useDocumentAnalysis } from './useDocumentAnalysis';
import styles from './DocumentUpload.module.css';

const DocumentUpload = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationError =
    (location.state as { error?: string | boolean } | null)?.error;
  const {
    files,
    canAnalyze,
    isAnalyzing,
    errorMessage,
    addFiles,
    removeFile,
    startAnalyze,
  } = useDocumentAnalysis();

  const bannerError =
    errorMessage ??
    (locationError === 'TIMEOUT'
      ? ar.advisor.errors.timeout
      : locationError
        ? ar.advisor.errors.failed
        : null);

  const handleAnalyze = async (): Promise<void> => {
    const jobId = await startAnalyze();
    if (jobId) {
      navigate(`/advisor/analyzing?jobId=${encodeURIComponent(jobId)}`);
    }
  };

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.advisor.upload.headerTitle}
          onBack={() => navigate(-1)}
        />

        <div className={styles.content}>
          <div className={styles.hero}>
            <h2 className={styles.heroTitle}>{ar.advisor.upload.title}</h2>
            <p className={styles.heroSubtitle}>{ar.advisor.upload.subtitle}</p>
          </div>

          <AdvisorExperimentalNote />

          {bannerError ? (
            <p className={styles.errorBanner} role="alert">
              {bannerError}
            </p>
          ) : null}

          <FileUploadZone
            title={ar.advisor.upload.zoneTitle}
            hint={ar.advisor.upload.zoneHint}
            filesLabel={ar.advisor.upload.filesBtn}
            cameraLabel={ar.advisor.upload.cameraBtn}
            onFiles={addFiles}
            maxSizeMB={10}
          />

          <div className={styles.filesSection}>
            <p className={styles.sectionTitle}>
              {ar.advisor.upload.attachedLabel.replace(
                '{count}',
                String(files.length),
              )}
            </p>
            {files.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>
                  {ar.advisor.upload.emptyTitle}
                </p>
                <p className={styles.emptyBody}>{ar.advisor.upload.emptyBody}</p>
              </div>
            ) : (
              <div className={styles.list}>
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    name={file.name}
                    sizeMB={file.sizeMB}
                    progress={file.progress}
                    status={file.status}
                    kind={file.kind}
                    doneLabel={ar.advisor.upload.doneLabel}
                    onRemove={() => removeFile(file.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <Button
            variant="ai"
            size="lg"
            fullWidth
            icon="auto_awesome"
            iconFilled
            className={styles.analyzeBtn}
            disabled={!canAnalyze || isAnalyzing}
            onClick={() => {
              void handleAnalyze();
            }}
          >
            {ar.advisor.upload.analyzeCta}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
};

export default DocumentUpload;
