import { useMemo } from 'react';

import { ar } from '../../core/i18n/ar';
import FilterPills from '../../shared/components/FilterPills';

import type { AlertFilterId } from './alerts.types';

interface AlertsFilterProps {
  activeFilter: AlertFilterId;
  totalCount: number;
  onChange: (filter: AlertFilterId) => void;
}

const AlertsFilter = ({
  activeFilter,
  totalCount,
  onChange,
}: AlertsFilterProps): JSX.Element => {
  const options = useMemo(
    () => [
      {
        id: 'all',
        label: ar.alerts.filters.all,
        count: totalCount,
      },
      { id: 'urgent', label: ar.alerts.filters.urgent },
      { id: 'warning', label: ar.alerts.filters.warning },
      { id: 'info', label: ar.alerts.filters.info },
    ],
    [totalCount],
  );

  return (
    <FilterPills
      options={options}
      activeId={activeFilter}
      onChange={(id) => onChange(id as AlertFilterId)}
      ariaLabel={ar.alerts.filtersAria}
    />
  );
};

export default AlertsFilter;
