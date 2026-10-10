import type { FormEvent, KeyboardEvent } from 'react';
import { useState } from 'react';

import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';

import styles from './ChatComposer.module.css';

interface ChatComposerProps {
  placeholder: string;
  sendAriaLabel: string;
  micAriaLabel: string;
  disabled?: boolean;
  onSend: (text: string) => void;
}

const ChatComposer = ({
  placeholder,
  sendAriaLabel,
  micAriaLabel,
  disabled = false,
  onSend,
}: ChatComposerProps): JSX.Element => {
  const [value, setValue] = useState('');

  const canSend = value.trim().length > 0 && !disabled;

  const handleSubmit = (event?: FormEvent): void => {
    event?.preventDefault();
    if (!canSend) {
      return;
    }
    onSend(value);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <input
        className={styles.field}
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={placeholder}
      />

      <button
        type="button"
        className={styles.iconButton}
        aria-label={`${micAriaLabel}. ${ar.guide.micComingSoon}`}
        title={ar.guide.micComingSoon}
        disabled
      >
        <Icon name="mic" size={20} />
      </button>

      <button
        type="submit"
        className={styles.send}
        aria-label={sendAriaLabel}
        disabled={!canSend}
      >
        <Icon name="send" size={20} className={styles.sendIcon} />
      </button>
    </form>
  );
};

export default ChatComposer;
