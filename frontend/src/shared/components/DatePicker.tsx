import styles from './DatePicker.module.css';

export interface DateChipOption {
  id: string;
  dayLabel: string;
  dateLabel: string;
}

interface DatePickerProps {
  dates: DateChipOption[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

const DatePicker = ({
  dates,
  selectedId,
  onChange,
  className = '',
}: DatePickerProps): JSX.Element => {
  return (
    <div
      className={`${styles.row} ${className}`}
      role="listbox"
      aria-label="booking-date"
    >
      {dates.map((date) => {
        const isSelected = date.id === selectedId;

        return (
          <button
            key={date.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`${styles.chip} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(date.id)}
          >
            <span className={styles.day}>{date.dayLabel}</span>
            <span className={styles.date}>{date.dateLabel}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DatePicker;
