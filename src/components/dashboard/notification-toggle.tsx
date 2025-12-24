
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '@/context/notification-context';
import { cn } from '@/lib/utils';

export default function NotificationToggle() {
  const { isEnabled, isActivating, activateSystem } = useNotifications();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={activateSystem}
        disabled={isEnabled || isActivating}
      >
        {isActivating ? (
          'Ativando...'
        ) : isEnabled ? (
          <>
            <Bell className="mr-2 h-4 w-4" />
            Notificações Ativas
          </>
        ) : (
          <>
            <BellOff className="mr-2 h-4 w-4" />
            Ativar Notificações
          </>
        )}
      </Button>
      <div
        className={cn(
          'h-2.5 w-2.5 rounded-full transition-colors',
          isEnabled ? 'bg-green-500' : 'bg-destructive animate-pulse'
        )}
        title={isEnabled ? 'Sistema de notificações ativo' : 'Sistema de notificações inativo'}
      />
    </div>
  );
}
