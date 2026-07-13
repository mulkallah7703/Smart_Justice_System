import styles from './SegmentedControl.module.css';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>): JSX.Element => {
  return (
    <div className={styles.control} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`${styles.option} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
