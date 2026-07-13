import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';
import SearchInput from '../../shared/components/SearchInput';

import styles from './LawyersSearch.module.css';

interface LawyersSearchProps {
  value: string;
  onChange: (value: string) => void;
  onFilterClick?: () => void;
}

const LawyersSearch = ({
  value,
  onChange,
  onFilterClick,
}: LawyersSearchProps): JSX.Element => {
  return (
    <SearchInput
      value={value}
      onChange={onChange}
      placeholder={ar.lawyers.searchPlaceholder}
      trailing={
        <button
          type="button"
          className={styles.filterButton}
          aria-label={ar.lawyers.filterAria}
          onClick={onFilterClick}
        >
          <Icon name="tune" size={20} />
        </button>
      }
    />
  );
};

export default LawyersSearch;
