export const keyframes = `
  @keyframes aiGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(47, 111, 176, 0); }
    50%       { box-shadow: 0 0 22px 1px rgba(47, 111, 176, .28); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes ringPulse {
    0%   { transform: scale(.85); opacity: .55; }
    100% { transform: scale(1.25); opacity: 0; }
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(.96); }
    to   { opacity: 1; transform: scale(1); }
  }

  @keyframes splashProgressFill {
    from { width: 0%; }
    to   { width: 100%; }
  }
` as const;

export const animationClass = {
  fadeInUp: 'fade-in-up',
  ringPulse: 'ring-pulse',
  splashProgressFill: 'splash-progress-fill',
  scaleIn: 'scale-in',
  screenEnter: 'screen-enter',
} as const;
