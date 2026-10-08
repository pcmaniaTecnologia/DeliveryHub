import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Verifica se a loja está aberta com base no JSON de horários.
 */
export function isStoreOpen(businessHoursStr?: string, now: Date = new Date()): { isOpen: boolean; message?: string } {
  if (!businessHoursStr) return { isOpen: true };
  try {
    const hours = JSON.parse(businessHoursStr);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', weekday: 'long',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const dayName = parts.find(part => part.type === 'weekday')!.value.toLowerCase();
    const currentTime = Number(parts.find(part => part.type === 'hour')!.value) * 60
      + Number(parts.find(part => part.type === 'minute')!.value);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const previousDay = days[(days.indexOf(dayName) + 6) % 7];
    const minutes = (value: unknown): number | null => {
      if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
      const [hour, minute] = value.split(':').map(Number);
      return hour * 60 + minute;
    };
    const matches = (config: any, previous: boolean) => {
      if (!config?.isOpen) return false;
      const slots = Array.isArray(config.slots) && config.slots.length
        ? config.slots : [{ openTime: config.openTime, closeTime: config.closeTime }];
      return slots.some((slot: any) => {
        const opening = minutes(slot?.openTime), closing = minutes(slot?.closeTime);
        if (opening === null || closing === null) return false;
        // An overnight shift starts on its configured day and ends the next day.
        if (previous) return closing < opening && currentTime < closing;
        if (closing < opening) return currentTime >= opening;
        return currentTime >= opening && currentTime < closing;
      });
    };
    return { isOpen: matches(hours?.[dayName], false) || matches(hours?.[previousDay], true) };
  } catch (e) {
    console.error('Erro ao validar horário:', e);
    return { isOpen: true };
  }
}

export function formatQuantity(quantity: number, isSoldByWeight?: boolean): string {
    if (isSoldByWeight) {
        return `${quantity.toFixed(3).replace('.', ',')} kg`;
    }
    // Fallback for legacy data or edge cases
    if (quantity % 1 !== 0) {
        return `${quantity.toFixed(3).replace('.', ',')} kg`;
    }
    return `${quantity}x`;
}
