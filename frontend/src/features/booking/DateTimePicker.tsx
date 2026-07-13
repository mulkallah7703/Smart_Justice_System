import { ar } from '../../core/i18n/ar';
import DatePicker from '../../shared/components/DatePicker';
import TimeSlotPicker from '../../shared/components/TimeSlotPicker';

import type { BookingDateOption, BookingTimeSlot } from './booking.types';
import styles from './DateTimePicker.module.css';

interface DateTimePickerProps {
  title: string;
  dates: BookingDateOption[];
  slots: BookingTimeSlot[];
  selectedDateId: string;
  selectedTimeId: string;
  onDateChange: (id: string) => void;
  onTimeChange: (id: string) => void;
}

const DateTimePicker = ({
  title,
  dates,
  slots,
  selectedDateId,
  selectedTimeId,
  onDateChange,
  onTimeChange,
}: DateTimePickerProps): JSX.Element => {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <DatePicker
        dates={dates}
        selectedId={selectedDateId}
        onChange={onDateChange}
      />
      <TimeSlotPicker
        slots={slots}
        selectedId={selectedTimeId}
        onChange={onTimeChange}
        className={styles.times}
      />
      <p className={styles.hint}>{ar.booking.scheduleHint}</p>
    </section>
  );
};

export default DateTimePicker;
