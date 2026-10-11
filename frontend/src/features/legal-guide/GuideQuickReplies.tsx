import styles from './GuideQuickReplies.module.css';

export interface GuideQuickReplyOption {
  id: string;
  label: string;
}

interface GuideQuickRepliesProps {
  options: GuideQuickReplyOption[];
  disabled?: boolean;
  onSelect: (option: GuideQuickReplyOption) => void;
}

const GuideQuickReplies = ({
  options,
  disabled = false,
  onSelect,
}: GuideQuickRepliesProps): JSX.Element => {
  return (
    <div className={styles.row} role="group" aria-label="ردود سريعة">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.chip}
          disabled={disabled}
          onClick={() => onSelect(option)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default GuideQuickReplies;
