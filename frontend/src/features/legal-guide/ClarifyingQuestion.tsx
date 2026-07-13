import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import AlertBanner from '../../shared/components/AlertBanner';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import Icon from '../../shared/components/Icon';
import ScreenShell from '../../shared/components/ScreenShell';

import GuideProgress from './GuideProgress';
import { sendGuideAnswer } from './guideApi';
import styles from './ClarifyingQuestion.module.css';

interface QuestionOption {
  id: string;
  label: string;
  variant?: 'default' | 'help';
}

const ClarifyingQuestion = (): JSX.Element => {
  const navigate = useNavigate();
  const currentStep = 2;
  const totalSteps = 4;

  const options = useMemo<QuestionOption[]>(
    () => [
      { id: 'documented', label: ar.guide.question.options.documented },
      { id: 'not-documented', label: ar.guide.question.options.notDocumented },
      { id: 'no-contract', label: ar.guide.question.options.noContract },
      {
        id: 'unsure',
        label: ar.guide.question.options.unsure,
        variant: 'help',
      },
    ],
    [],
  );

  const [selectedId, setSelectedId] = useState<string>('documented');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    if (!selectedId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await sendGuideAnswer(`guide-question-${Date.now()}`, selectedId);
      navigate('/guide');
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.guide.question.title}
          onBack={() => navigate(-1)}
          trailing={
            <p className={styles.stepLabel}>
              {ar.guide.question.stepLabel
                .replace('{current}', String(currentStep))
                .replace('{total}', String(totalSteps))}
            </p>
          }
        />

        <GuideProgress currentStep={currentStep} totalSteps={totalSteps} />

        <div className={styles.content}>
          <div className={styles.hint}>
            <Icon
              name="auto_awesome"
              size={20}
              filled
              className={styles.hintIcon}
            />
            <p className={styles.hintText}>{ar.guide.question.hint}</p>
          </div>

          <h2 className={styles.question}>{ar.guide.question.prompt}</h2>

          <div
            className={styles.options}
            role="radiogroup"
            aria-label={ar.guide.question.prompt}
          >
            {options.map((option) => {
              const isSelected = option.id === selectedId;
              const showHelpIcon = option.variant === 'help' && !isSelected;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                  onClick={() => setSelectedId(option.id)}
                >
                  <span
                    className={`${styles.check} ${
                      isSelected
                        ? styles.checkSelected
                        : showHelpIcon
                          ? styles.checkHelp
                          : ''
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? (
                      <Icon name="check" size={16} />
                    ) : showHelpIcon ? (
                      <Icon name="help" size={16} />
                    ) : null}
                  </span>
                  <span className={styles.optionLabel}>{option.label}</span>
                </button>
              );
            })}
          </div>

          <AlertBanner
            className={styles.tip}
            variant="info"
            message={ar.guide.question.tip}
          />
        </div>

        <div className={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon="arrow_back"
            iconPosition="end"
            disabled={!selectedId || isSubmitting}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {ar.guide.question.next}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
};

export default ClarifyingQuestion;
