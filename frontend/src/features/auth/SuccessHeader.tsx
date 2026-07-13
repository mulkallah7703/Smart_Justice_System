import { animationClass } from '../../core/theme/animations';
import Icon from '../../shared/components/Icon';

import styles from './SuccessHeader.module.css';

interface SuccessHeaderProps {
  title: string;
  description: string;
}

const SuccessHeader = ({ title, description }: SuccessHeaderProps): JSX.Element => {
  return (
    <header className={styles.header}>
      <div className={`${styles.iconWrap} ${animationClass.scaleIn}`}>
        <Icon name="check" size={40} className={styles.icon} />
      </div>
      <h1 className={`${styles.title} ${animationClass.fadeInUp} ${styles.titleDelay}`}>
        {title}
      </h1>
      <p className={`${styles.description} ${animationClass.fadeInUp} ${styles.descriptionDelay}`}>
        {description}
      </p>
    </header>
  );
};

export default SuccessHeader;
