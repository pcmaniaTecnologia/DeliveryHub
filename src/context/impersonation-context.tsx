'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type ImpersonationContextType = {
  impersonatedCompanyId: string | null;
  impersonatedCompanyName: string | null;
  startImpersonation: (companyId: string, companyName: string) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
};

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedCompanyId: null,
  impersonatedCompanyName: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
  isImpersonating: false,
});

export const ImpersonationProvider = ({ children }: { children: React.ReactNode }) => {
  const [impersonatedCompanyId, setImpersonatedCompanyId] = useState<string | null>(null);
  const [impersonatedCompanyName, setImpersonatedCompanyName] = useState<string | null>(null);
  const router = useRouter();

  const startImpersonation = useCallback((companyId: string, companyName: string) => {
    setImpersonatedCompanyId(companyId);
    setImpersonatedCompanyName(companyName);
    router.push('/dashboard');
  }, [router]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedCompanyId(null);
    setImpersonatedCompanyName(null);
    router.push('/admin/companies');
  }, [router]);

  return (
    <ImpersonationContext.Provider value={{
      impersonatedCompanyId,
      impersonatedCompanyName,
      startImpersonation,
      stopImpersonation,
      isImpersonating: !!impersonatedCompanyId,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => useContext(ImpersonationContext);
