
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useFirestore, useUser, updateDocument } from '@/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import type { Order } from '@/app/dashboard/orders/page';
import { generateOrderPrintHtml } from '@/lib/print-utils';
import { useToast } from '@/hooks/use-toast';

const notificationSoundUrl = "https://storage.googleapis.com/starlit-id-prod.appspot.com/public-assets/notification.mp3";

// Context type is simplified as the explicit activation state is removed.
interface NotificationContextType {}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children, companyData }: { children: ReactNode, companyData?: { name?: string, soundNotificationEnabled?: boolean; autoPrintEnabled?: boolean; }}) => {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const processedOrderIds = useRef(new Set<string>());
    const listenerUnsubscribe = useRef<(() => void) | null>(null);

    const playSound = useCallback(() => {
        if (companyData?.soundNotificationEnabled) {
            const audio = new Audio(notificationSoundUrl);
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.error("Audio playback failed. This is often due to browser autoplay policies. A user interaction is required to enable sound.", err);
                    // We don't toast here anymore to avoid annoying the user if they don't want to interact.
                });
            }
        }
    }, [companyData?.soundNotificationEnabled, toast]);

    const printOrder = useCallback((order: Order) => {
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
    }, [companyData, toast]);
    
    const listenToNewOrders = useCallback(() => {
        if (!firestore || !user?.uid) {
            return;
        }

        if (listenerUnsubscribe.current) {
            return; // Listener already active
        }
        
        console.log("Notification system: Starting to listen for new orders...");
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
                        
                        console.log("New order detected:", order.id);
                        toast({
                            title: "Novo Pedido Recebido!",
                            description: `Pedido de ${order.customerName || 'um cliente'}.`,
                        });
                        
                        playSound();
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
            toast({
                variant: 'destructive',
                title: 'Erro de conexão',
                description: 'Não foi possível monitorar novos pedidos. Verifique sua conexão e permissões.',
            });
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
                listenerUnsubscribe.current = null;
            }
        });

    }, [firestore, user?.uid, playSound, printOrder, toast]);

    // useEffect to automatically start listening when the provider mounts
    useEffect(() => {
        // Automatically start listening for orders.
        listenToNewOrders();

        // Cleanup listener on unmount
        return () => {
            if (listenerUnsubscribe.current) {
                console.log("Notification system: Stopping listener.");
                listenerUnsubscribe.current();
                listenerUnsubscribe.current = null;
            }
        };
    }, [listenToNewOrders]);


    // The context no longer needs to provide activation controls.
    const value = {};

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
