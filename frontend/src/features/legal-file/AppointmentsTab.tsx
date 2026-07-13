import { ar } from '../../core/i18n/ar';
import EmptyState from '../../shared/components/EmptyState';

const AppointmentsTab = (): JSX.Element => {
  return (
    <EmptyState
      icon="event"
      title={ar.legalFile.empty.appointments.title}
      body={ar.legalFile.empty.appointments.body}
    />
  );
};

export default AppointmentsTab;
