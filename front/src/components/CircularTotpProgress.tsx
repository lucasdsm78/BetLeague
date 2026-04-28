import React, { memo } from 'react';

interface CircularTotpProgressProps {
  secondsRemaining: number;
  step?: number; // durée totale (par défaut 30s)
  isExpiring?: boolean;
  size?: number;
  stroke?: number;
}

const CircularTotpProgress = memo<CircularTotpProgressProps>(({
  secondsRemaining,
  step = 30,
  isExpiring = false,
  size = 64,
  stroke = 6,
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsRemaining / step; // 0..1
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="circular-totp" aria-label={`Code TOTP: ${secondsRemaining} secondes restantes`}>
      <svg width={size} height={size} className="circular-totp-svg" role="img">
        <circle
          className="circular-totp-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className={`circular-totp-progress ${isExpiring ? 'expiring' : ''}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <text
          className="circular-totp-text"
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
        >
          {secondsRemaining}s
        </text>
      </svg>
    </div>
  );
});

CircularTotpProgress.displayName = 'CircularTotpProgress';
export default CircularTotpProgress;

