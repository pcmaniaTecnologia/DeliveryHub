import type { CSSProperties } from 'react';

export type LogoAdjustments = { scale: number; x: number; y: number };

export const defaultLogoAdjustments: LogoAdjustments = { scale: 100, x: 0, y: 0 };

export function normalizeLogoAdjustments(value?: Partial<LogoAdjustments>): LogoAdjustments {
  const clamp = (number: unknown, fallback: number, min: number, max: number) =>
    typeof number === 'number' && Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  return {
    scale: clamp(value?.scale, 100, 50, 300),
    x: clamp(value?.x, 0, -50, 50),
    y: clamp(value?.y, 0, -50, 50),
  };
}

export function logoAdjustmentStyle(value?: Partial<LogoAdjustments>): CSSProperties {
  const { scale, x, y } = normalizeLogoAdjustments(value);
  return { transform: `translate(${x}%, ${y}%) scale(${scale / 100})`, transformOrigin: 'center' };
}
