import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import BottomNav from '../../shared/components/BottomNav';
import ScreenShell from '../../shared/components/ScreenShell';
import ScrollContent from '../../shared/components/ScrollContent';

import LawyerCard from './LawyerCard';
import LawyersFilter from './LawyersFilter';
import LawyersSearch from './LawyersSearch';
import { useLawyers } from './useLawyers';
import styles from './LawyersList.module.css';

const LawyersList = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    lawyers,
    isLoading,
    errorMessage,
    search,
    setSearch,
    specialty,
    setSpecialty,
  } = useLawyers();

  return (
    <ScreenShell variant="default">
      <div className={styles.screen}>
        <div className={styles.header}>
          <h1 className={styles.title}>{ar.lawyers.title}</h1>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <LawyersSearch value={search} onChange={setSearch} />
          </div>
          <LawyersFilter
            activeSpecialty={specialty}
            onChange={setSpecialty}
          />
        </div>

        <ScrollContent className={styles.content}>
          <div className={styles.list}>
            {!isLoading ? (
              <>
                {errorMessage ? (
                  <p className={styles.message} role="alert">
                    {errorMessage}
                  </p>
                ) : null}
                {!errorMessage && lawyers.length === 0 ? (
                  <p className={styles.message}>{ar.lawyers.empty}</p>
                ) : null}
                {lawyers.map((lawyer) => (
                  <LawyerCard
                    key={lawyer.id}
                    lawyer={lawyer}
                    onOpen={(id) => navigate(`/lawyers/${id}`)}
                    onBook={(id) => navigate(`/lawyers/${id}/book`)}
                  />
                ))}
              </>
            ) : null}
          </div>
        </ScrollContent>

        <BottomNav />
      </div>
    </ScreenShell>
  );
};

export default LawyersList;
