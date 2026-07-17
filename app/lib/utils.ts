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
export function isStoreOpen(businessHoursStr?: string): { isOpen: boolean; message?: string } {
  if (!businessHoursStr) return { isOpen: true };
  
  try {
    const hours = JSON.parse(businessHoursStr);
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[now.getDay()];
    const config = hours[dayName];

    if (!config || !config.isOpen) {
      return { isOpen: false };
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();

    const checkSlot = (open?: string, close?: string) => {
        if (!open || !close) return false;
        
        const openParts = open.split(':');
        const closeParts = close.split(':');
        if (openParts.length !== 2 || closeParts.length !== 2) return false;

        const openH = parseInt(openParts[0], 10);
        const openM = parseInt(openParts[1], 10);
        const closeH = parseInt(closeParts[0], 10);
        const closeM = parseInt(closeParts[1], 10);

        if (isNaN(openH) || isNaN(openM) || isNaN(closeH) || isNaN(closeM)) return false;

        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        if (closeMinutes < openMinutes) {
            // Horário passa da meia-noite
            return currentTime >= openMinutes || currentTime < closeMinutes;
        } else {
            return currentTime >= openMinutes && currentTime < closeMinutes;
        }
    };

    if (config.slots && config.slots.length > 0) {
        // Nova estrutura com múltiplos horários
        for (const slot of config.slots) {
            if (checkSlot(slot.openTime, slot.closeTime)) {
                return { isOpen: true };
            }
        }
        return { isOpen: false };
    } else if (config.openTime && config.closeTime) {
        // Estrutura legada de horário único
        if (checkSlot(config.openTime, config.closeTime)) {
            return { isOpen: true };
        }
        return { isOpen: false };
    }

    return { isOpen: false };
  } catch (e) {
    console.error("Erro ao validar horário:", e);
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