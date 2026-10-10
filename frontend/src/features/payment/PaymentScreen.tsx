import BookingConfirmation from '../booking/BookingConfirmation';

/**
 * Payment stays deferred. This route must not present a checkout or a
 * successful charge. Bookings land on the confirmation screen instead.
 */
const PaymentScreen = (): JSX.Element => {
  return <BookingConfirmation />;
};

export default PaymentScreen;
