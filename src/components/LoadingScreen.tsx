'use client';

import React from 'react';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="relative flex flex-col items-center">
        {/* Logo Container with Pulse and Glow */}
        <div className="relative mb-8 h-32 w-32 animate-pulse sm:h-40 sm:w-40">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl" />
          <img 
            src="/logo.png" 
            alt="Loading..." 
            className="relative h-full w-full object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-110"
          />
        </div>
        
        {/* Loading Bar */}
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted shadow-inner sm:w-64">
          <div className="h-full w-1/3 animate-[loading_1.5s_infinite_ease-in-out] rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
        </div>
        
        <p className="mt-4 animate-pulse text-sm font-medium tracking-widest text-muted-foreground uppercase">
          Carregando sistema...
        </p>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
