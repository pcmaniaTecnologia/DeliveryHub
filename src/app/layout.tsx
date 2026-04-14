import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ImpersonationProvider } from '@/context/impersonation-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'DeliveryHub',
  description: 'A solução SaaS completa para o seu negócio de delivery.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <ImpersonationProvider>
            {children}
          </ImpersonationProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
