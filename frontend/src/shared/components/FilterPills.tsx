import styles from './FilterPills.module.css';

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterPillsProps {
  options: FilterOption[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

const FilterPills = ({
  options,
  activeId,
  onChange,
  ariaLabel,
}: FilterPillsProps): JSX.Element => {
  return (
    <div className={styles.row} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.id === activeId;

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.pill} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(option.id)}
          >
            <span>{option.label}</span>
            {option.count !== undefined ? (
              <span className={styles.count}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default FilterPills;
