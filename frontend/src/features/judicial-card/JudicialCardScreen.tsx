import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import BottomNav from '../../shared/components/BottomNav';
import Icon from '../../shared/components/Icon';
import ScreenShell from '../../shared/components/ScreenShell';

import CardActions from './CardActions';
import CardVisual from './CardVisual';
import { useJudicialCard } from './useJudicialCard';
import styles from './JudicialCardScreen.module.css';

const JudicialCardScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    card,
    isLoading,
    isFlipped,
    errorMessage,
    toggleFlip,
    showIdentity,
    qrPayload,
  } = useJudicialCard();

  return (
    <ScreenShell variant="default">
      <div className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.title}>{ar.judicialCard.headerTitle}</h1>
        </header>

        <div className={styles.content}>
          {errorMessage ? (
            <p className={styles.hint} role="alert">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && card && qrPayload ? (
            <>
              <CardVisual
                card={card}
                isFlipped={isFlipped}
                qrPayload={qrPayload}
                onFlip={toggleFlip}
              />

              <p className={styles.hint}>
                <Icon
                  name="touch_app"
                  size={16}
                  className={styles.hintIcon}
                />
                <span>{ar.judicialCard.flipHint}</span>
              </p>

              <CardActions
                onShowIdentity={showIdentity}
                onUpgrade={() => navigate('/card/upgrade')}
              />
            </>
          ) : null}
        </div>

        <BottomNav />
      </div>
    </ScreenShell>
  );
};

export default JudicialCardScreen;
