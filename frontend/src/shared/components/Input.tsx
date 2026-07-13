import type { ChangeEvent } from 'react';

import Icon from './Icon';
import styles from './Input.module.css';

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: string;
  error?: string;
  inputMode?: 'numeric' | 'text';
  id?: string;
  className?: string;
}

const Input = ({
  label,
  value,
  onChange,
  placeholder,
  icon,
  error,
  inputMode = 'text',
  id = 'input-field',
  className = '',
}: InputProps): JSX.Element => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value);
  };

  return (
    <div className={`${styles.field} ${className}`}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={`${styles.control} ${error ? styles.controlError : ''}`}>
        {icon ? (
          <Icon name={icon} size={20} className={styles.icon} ariaHidden />
        ) : null}
        <input
          id={id}
          className={styles.input}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          inputMode={inputMode}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default Input;
