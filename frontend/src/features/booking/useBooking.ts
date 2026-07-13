import { useMemo, useState } from 'react';

import {
  bookConsultation,
  getBookingDates,
  getBookingTimeSlots,
  getConsultationTypes,
} from './bookingApi';

import type {
  BookingDateOption,
  BookingTimeSlot,
  ConsultationTypeId,
  ConsultationTypeOption,
} from './booking.types';

interface UseBookingResult {
  types: ConsultationTypeOption[];
  dates: BookingDateOption[];
  slots: BookingTimeSlot[];
  selectedType: ConsultationTypeId;
  selectedDateId: string;
  selectedTimeId: string;
  selectedTypeOption: ConsultationTypeOption;
  setSelectedType: (id: ConsultationTypeId) => void;
  setSelectedDateId: (id: string) => void;
  setSelectedTimeId: (id: string) => void;
  isSubmitting: boolean;
  canContinue: boolean;
  submitBooking: (lawyerId: string) => Promise<string | null>;
}

export const useBooking = (): UseBookingResult => {
  const types = useMemo(() => getConsultationTypes(), []);
  const dates = useMemo(() => getBookingDates(), []);
  const slots = useMemo(() => getBookingTimeSlots(), []);

  const [selectedType, setSelectedType] =
    useState<ConsultationTypeId>('INSTANT');
  const [selectedDateId, setSelectedDateId] = useState('d-29');
  const [selectedTimeId, setSelectedTimeId] = useState('t-1330');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTypeOption =
    types.find((type) => type.id === selectedType) ?? types[0];

  const canContinue = Boolean(
    selectedType && selectedDateId && selectedTimeId && !isSubmitting,
  );

  const submitBooking = async (lawyerId: string): Promise<string | null> => {
    if (!canContinue) {
      return null;
    }

    setIsSubmitting(true);
    try {
      const result = await bookConsultation({
        lawyerId,
        type: selectedType,
        dateId: selectedDateId,
        timeId: selectedTimeId,
      });
      return result.consultationId;
    } catch {
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    types,
    dates,
    slots,
    selectedType,
    selectedDateId,
    selectedTimeId,
    selectedTypeOption,
    setSelectedType,
    setSelectedDateId,
    setSelectedTimeId,
    isSubmitting,
    canContinue,
    submitBooking,
  };
};
