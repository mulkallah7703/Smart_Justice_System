import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserFacingBookingError } from '../../shared/api/errors';

import {
  bookConsultation,
  getConsultationTypes,
  getLawyerAvailability,
} from './bookingApi';

import type {
  BookingDateOption,
  BookingDay,
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
  isLoadingSlots: boolean;
  isSubmitting: boolean;
  canContinue: boolean;
  errorMessage: string | null;
  submitBooking: (lawyerId: string) => Promise<string | null>;
}

export const useBooking = (lawyerId: string): UseBookingResult => {
  const types = useMemo(() => getConsultationTypes(), []);

  const [days, setDays] = useState<BookingDay[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [selectedType, setSelectedType] =
    useState<ConsultationTypeId>('INSTANT');
  const [selectedDateId, setSelectedDateId] = useState('');
  const [selectedTimeId, setSelectedTimeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      // Stale availability must never survive a lawyer change.
      setDays([]);
      setSelectedDateId('');
      setSelectedTimeId('');
      setErrorMessage(null);
      setIsLoadingSlots(true);

      try {
        const result = await getLawyerAvailability(lawyerId);
        if (!active) {
          return;
        }
        setDays(result);
        setSelectedDateId(result[0]?.id ?? '');
        setSelectedTimeId(result[0]?.slots[0]?.id ?? '');
      } catch (error) {
        if (active) {
          setErrorMessage(getUserFacingBookingError(error));
        }
      } finally {
        if (active) {
          setIsLoadingSlots(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [lawyerId]);

  const dates = useMemo(
    () => days.map(({ id, dayLabel, dateLabel }) => ({ id, dayLabel, dateLabel })),
    [days],
  );

  const slots = useMemo(
    () => days.find((day) => day.id === selectedDateId)?.slots ?? [],
    [days, selectedDateId],
  );

  const selectDate = useCallback(
    (id: string) => {
      setSelectedDateId(id);
      setSelectedTimeId(days.find((day) => day.id === id)?.slots[0]?.id ?? '');
      setErrorMessage(null);
    },
    [days],
  );

  const selectTime = useCallback((id: string) => {
    setSelectedTimeId(id);
    setErrorMessage(null);
  }, []);

  const selectedTypeOption =
    types.find((type) => type.id === selectedType) ?? types[0];

  const canContinue = Boolean(
    selectedType && selectedTimeId && !isSubmitting && !isLoadingSlots,
  );

  const submitBooking = async (
    targetLawyerId: string,
  ): Promise<string | null> => {
    if (!canContinue) {
      return null;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await bookConsultation({
        lawyerId: targetLawyerId,
        type: selectedType,
        scheduledAt: selectedTimeId,
      });
      return result.consultationId;
    } catch (error) {
      setErrorMessage(getUserFacingBookingError(error));
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
    setSelectedDateId: selectDate,
    setSelectedTimeId: selectTime,
    isLoadingSlots,
    isSubmitting,
    canContinue,
    errorMessage,
    submitBooking,
  };
};
