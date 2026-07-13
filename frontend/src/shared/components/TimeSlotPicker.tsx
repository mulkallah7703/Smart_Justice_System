import styles from './TimeSlotPicker.module.css';

export interface TimeSlotOption {
  id: string;
  label: string;
  available: boolean;
}

interface TimeSlotPickerProps {
  slots: TimeSlotOption[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

const TimeSlotPicker = ({
  slots,
  selectedId,
  onChange,
  className = '',
}: TimeSlotPickerProps): JSX.Element => {
  return (
    <div
      className={`${styles.grid} ${className}`}
      role="listbox"
      aria-label="booking-time"
    >
      {slots.map((slot) => {
        const isSelected = slot.id === selectedId;
        const isUnavailable = !slot.available;

        return (
          <button
            key={slot.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={isUnavailable}
            className={`${styles.slot} ${isSelected ? styles.selected : ''} ${isUnavailable ? styles.unavailable : ''}`}
            onClick={() => onChange(slot.id)}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
};

export default TimeSlotPicker;
