import Icon from '../../shared/components/Icon';

import styles from './AnalyzingHeader.module.css';

interface AnalyzingHeaderProps {
  title: string;
  onBack: () => void;
}

const AnalyzingHeader = ({
  title,
  onBack,
}: AnalyzingHeaderProps): JSX.Element => {
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.back}
        onClick={onBack}
        aria-label="العودة للخلف"
      >
        <Icon name="arrow_back" size={24} className={styles.backIcon} />
      </button>
      <h1 className={styles.title}>{title}</h1>
      <div aria-hidden="true" />
    </header>
  );
};

export default AnalyzingHeader;
