import { useEffect, useState } from 'react';

interface UseNafathCountdownResult {
  secondsLeft: number;
  isExpired: boolean;
}

export const useNafathCountdown = (initialSeconds = 58): UseNafathCountdownResult => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  return {
    secondsLeft: Math.max(secondsLeft, 0),
    isExpired: secondsLeft <= 0,
  };
};
