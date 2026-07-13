import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';

import styles from './AddCaseCard.module.css';

interface AddCaseCardProps {
  onClick?: () => void;
}

const AddCaseCard = ({ onClick }: AddCaseCardProps): JSX.Element => {
  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <span className={styles.iconWrap} aria-hidden>
        <Icon name="add" size={24} className={styles.icon} />
      </span>
      <span className={styles.label}>{ar.legalFile.addCase}</span>
    </button>
  );
};

export default AddCaseCard;
