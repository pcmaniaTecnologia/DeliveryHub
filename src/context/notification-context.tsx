'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError, updateDocument } from '@/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc } from 'firebase/firestore';
import type { Order } from '@/app/dashboard/orders/page';
import { generateOrderPrintHtml } from '@/lib/print-utils';
import { useToast } from '@/hooks/use-toast';

interface NotificationContextType {
    playTrigger: number;
}

interface NotificationProviderProps {
    children: ReactNode;
    companyData: any;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children, companyData }: NotificationProviderProps) => {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [playTrigger, setPlayTrigger] = useState(0);

    const processedOrderIds = useRef(new Set<string>());
    const sessionStartTime = useRef(Timestamp.now());
    
    const settingsRef = useRef(companyData);
    useEffect(() => {
        settingsRef.current = companyData;
    }, [companyData]);

    useEffect(() => {
        if (!firestore || !user?.uid) return;

        const q = query(
            collection(firestore, `companies/${user.uid}/orders`),
            where('status', 'in', ['Novo', 'Aguardando pagamento'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const orderData = change.doc.data();
                    const order = { id: change.doc.id, ...orderData } as Order;
                    
                    const orderTime = order.orderDate?.toMillis() || 0;
                    const startTime = sessionStartTime.current.toMillis();

                    if (orderTime > startTime && !processedOrderIds.current.has(order.id)) {
                        processedOrderIds.current.add(order.id);
                        
                        const currentSettings = settingsRef.current;

                        if (currentSettings?.soundNotificationEnabled !== false) {
                           setPlayTrigger(prev => prev + 1);
                        }

                        toast({
                            title: "🔔 Novo Pedido Recebido!",
                            description: `Pedido de ${order.customerName || 'um cliente'}.`,
                            duration: 15000
                        });
                        
                        if (currentSettings?.autoPrintEnabled) {
                            setTimeout(() => {
                                const printHtml = generateOrderPrintHtml(order, currentSettings);
                                const printWindow = window.open('', '_blank', 'width=300,height=500');
                                if (printWindow) {
                                    printWindow.document.write(printHtml);
                                    printWindow.document.close();
                                }
                                
                                const orderRef = doc(firestore, `companies/${user.uid}/orders`, order.id);
                                updateDocument(orderRef, { status: 'Em preparo' }).catch(() => {});
                            }, 1500);
                        }
                    } else if (orderTime <= startTime) {
                        processedOrderIds.current.add(order.id);
                    }
                }
            });
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `companies/${user.uid}/orders`,
                operation: 'list'
            }));
        });
        
        return () => unsubscribe();

    }, [firestore, user?.uid, toast]);

    const value = { playTrigger };

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications deve ser usado dentro de um NotificationProvider');
    }
    return context;
};
