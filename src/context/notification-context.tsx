
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useFirestore, useUser, updateDocument } from '@/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import type { Order } from '@/app/dashboard/orders/page';
import { generateOrderPrintHtml } from '@/lib/print-utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface NotificationContextType {
    playTrigger: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children, companyData }: { children: ReactNode, companyData?: { name?: string, soundNotificationEnabled?: boolean; autoPrintEnabled?: boolean; }}) => {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [playTrigger, setPlayTrigger] = useState(0);

    const processedOrderIds = useRef(new Set<string>());
    const listenerUnsubscribe = useRef<(() => void) | null>(null);

    useEffect(() => {
        const printOrder = (order: Order) => {
            if (companyData?.autoPrintEnabled) {
                const printHtml = generateOrderPrintHtml(order, companyData);
                const printWindow = window.open('', '_blank', 'width=300,height=500');
                if (printWindow) {
                    printWindow.document.write(printHtml);
                    printWindow.document.close();
                } else {
                     toast({
                        variant: 'destructive',
                        title: 'Impressão Bloqueada',
                        description: 'Por favor, habilite pop-ups para impressão automática.',
                    });
                }
            }
        };

        if (!firestore || !user?.uid) {
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
                listenerUnsubscribe.current = null;
            }
            return;
        }

        if (listenerUnsubscribe.current) {
            return; // Listener already active
        }
        
        const q = query(
            collection(firestore, `companies/${user.uid}/orders`),
            where('status', 'in', ['Novo', 'Aguardando pagamento'])
        );

        listenerUnsubscribe.current = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const order = { id: change.doc.id, ...change.doc.data() } as Order;
                    if (!processedOrderIds.current.has(order.id)) {
                        processedOrderIds.current.add(order.id);
                        
                        if (companyData?.soundNotificationEnabled) {
                           setPlayTrigger(prev => prev + 1); // Trigger sound playback
                        }

                        toast({
                            title: "Novo Pedido Recebido!",
                            description: `Pedido de ${order.customerName || 'um cliente'}.`,
                            duration: 20000 // Keep toast longer
                        });
                        
                        printOrder(order);

                        const orderDocRef = doc(firestore, `companies/${user.uid}/orders`, order.id);
                        updateDocument(orderDocRef, { status: 'Em preparo' }).catch(err => {
                            console.error("Failed to update order status automatically:", err);
                        });
                    }
                }
            });
        }, (error) => {
            console.error("Error listening to orders:", error);
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
                listenerUnsubscribe.current = null;
            }
        });
        
        return () => {
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
                listenerUnsubscribe.current = null;
            }
        };

    }, [firestore, user?.uid, companyData, toast]);

    const value = { playTrigger };

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
