import { useEffect, useState } from 'react';

/**
 * useTotpTimer - renvoie le temps restant (0-30s) avant expiration du code TOTP
 */
export default function useTotpTimer(step: number = 30) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const epoch = Math.floor(now / 1000);
  const secondsIntoWindow = epoch % step;
  const secondsRemaining = step - secondsIntoWindow;
  const percent = (secondsRemaining / step) * 100;
  const isExpiring = secondsRemaining <= 5;

  return { secondsRemaining, percent, isExpiring };
}

