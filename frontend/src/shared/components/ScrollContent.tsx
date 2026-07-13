import type { ReactNode } from 'react';

import styles from './ScrollContent.module.css';

interface ScrollContentProps {
  children: ReactNode;
  className?: string;
}

const ScrollContent = ({ children, className = '' }: ScrollContentProps): JSX.Element => {
  return <div className={`${styles.content} ${className}`}>{children}</div>;
};

export default ScrollContent;
