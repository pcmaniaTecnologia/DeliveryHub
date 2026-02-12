'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  // If initialization fails (e.g., missing config), show an error message.
  if (!firebaseServices.firebaseApp) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-lg rounded-lg border border-destructive bg-card p-6 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-destructive">Erro de Configuração do Firebase</h1>
          <p className="mt-2 text-card-foreground">A configuração do seu projeto Firebase está ausente ou incompleta.</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Para resolver isso, crie um arquivo <code className="bg-muted p-1 rounded-sm">.env.local</code> na raiz do seu projeto e adicione as credenciais do seu projeto Firebase.
          </p>
           <p className="mt-2 text-sm text-muted-foreground">
            Consulte o arquivo <code className="bg-muted p-1 rounded-sm">.env.example</code> para ver as variáveis necessárias.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Se você estiver publicando na Vercel, adicione estas variáveis de ambiente nas configurações do seu projeto.</p>
        </div>
      </div>
    );
  }


  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth!}
      firestore={firebaseServices.firestore!}
    >
      {children}
    </FirebaseProvider>
  );
}
