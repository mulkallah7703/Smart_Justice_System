import type { ReactNode } from 'react';

import Icon from './Icon';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  trailing?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

const SearchInput = ({
  value,
  onChange,
  placeholder,
  onClear,
  trailing,
  ariaLabel,
  className = '',
}: SearchInputProps): JSX.Element => {
  return (
    <div className={`${styles.wrap} ${className}`}>
      <Icon name="search" size={20} className={styles.searchIcon} />
      <input
        className={styles.input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
      <div className={styles.trailing}>
        {value && onClear ? (
          <button
            type="button"
            className={styles.clear}
            onClick={onClear}
            aria-label="مسح البحث"
          >
            <Icon name="close" size={16} />
          </button>
        ) : (
          trailing
        )}
      </div>
    </div>
  );
};

export default SearchInput;
