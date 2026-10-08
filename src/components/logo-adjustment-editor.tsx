'use client';

import { useState } from 'react';
import { resolveLogoUrl } from '@/lib/logo-url';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { defaultLogoAdjustments, logoAdjustmentStyle, type LogoAdjustments } from '@/lib/logo-adjustments';

export function LogoAdjustmentEditor({ url, value, onChange, disabled }: {
  url: string;
  value: LogoAdjustments;
  onChange: (value: LogoAdjustments) => void;
  disabled?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === url;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Ajustar logo</Label>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ ...defaultLogoAdjustments })}>Restaurar padrão</Button>
      </div>
      <div className="relative mx-auto h-44 w-44 overflow-hidden rounded-[2rem] border bg-white" aria-label="Prévia da logo no cardápio">
        {failed ? (
          <p role="status" className="flex h-full items-center p-4 text-center text-xs text-gray-600">Não foi possível carregar a logo. No Google Fotos, compartilhe somente a foto e confira se o link abre sem login. No Drive, permita acesso a qualquer pessoa com o link.</p>
        ) : (
          <img key={url} src={resolveLogoUrl(url)} alt="Prévia da logo" className="absolute inset-0 h-full w-full object-contain p-3" style={logoAdjustmentStyle(value)} onError={() => setFailedUrl(url)} onLoad={() => setFailedUrl(null)} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">Ajuste o tamanho e a posição na prévia. As partes fora da moldura serão cortadas. Clique em salvar para aplicar ao cardápio.</p>
      {([
        { key: 'scale', label: 'Tamanho', min: 50, max: 300 },
        { key: 'x', label: 'Posição horizontal', min: -50, max: 50 },
        { key: 'y', label: 'Posição vertical', min: -50, max: 50 },
      ] as const).map(({ key, label, min, max }) => (
        <div key={key} className="space-y-2">
          <div className="flex justify-between text-sm"><Label htmlFor={`logo-${key}`}>{label}</Label><span>{value[key]}%</span></div>
          <input id={`logo-${key}`} type="range" className="w-full accent-primary" min={min} max={max} step={1} value={value[key]} disabled={disabled} onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })} />
        </div>
      ))}
    </div>
  );
}
