import { useMemo } from 'react';

import { ar } from '../../core/i18n/ar';
import FilterPills from '../../shared/components/FilterPills';

import type { LawyerSpecialty } from './lawyers.types';

interface LawyersFilterProps {
  activeSpecialty: LawyerSpecialty;
  onChange: (specialty: LawyerSpecialty) => void;
}

const LawyersFilter = ({
  activeSpecialty,
  onChange,
}: LawyersFilterProps): JSX.Element => {
  const options = useMemo(
    () => [
      { id: 'RENTAL', label: ar.lawyers.filters.rental },
      { id: 'PERSONAL', label: ar.lawyers.filters.personal },
      { id: 'COMMERCIAL', label: ar.lawyers.filters.commercial },
      { id: 'LABOR', label: ar.lawyers.filters.labor },
      { id: 'CRIMINAL', label: ar.lawyers.filters.criminal },
    ],
    [],
  );

  return (
    <FilterPills
      options={options}
      activeId={activeSpecialty}
      onChange={(id) => onChange(id as LawyerSpecialty)}
      ariaLabel={ar.lawyers.filtersAria}
    />
  );
};

export default LawyersFilter;
