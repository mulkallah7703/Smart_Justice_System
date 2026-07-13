import BackButton from '../../shared/components/BackButton';
import Icon from '../../shared/components/Icon';

import styles from './GuideChatHeader.module.css';

interface GuideChatHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

const GuideChatHeader = ({
  title,
  subtitle,
  onBack,
}: GuideChatHeaderProps): JSX.Element => {
  return (
    <header className={styles.header}>
      <BackButton onClick={onBack} />
      <div className={styles.brand}>
        <div className={styles.aiLogo} aria-hidden="true">
          <Icon name="auto_awesome" size={20} filled className={styles.aiIcon} />
        </div>
        <div className={styles.copy}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.subtitleRow}>
            <span className={styles.onlineDot} aria-hidden="true" />
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default GuideChatHeader;
