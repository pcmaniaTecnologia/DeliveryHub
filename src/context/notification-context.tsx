
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useFirestore, useUser, updateDocument } from '@/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import type { Order } from '@/app/dashboard/orders/page';
import { generateOrderPrintHtml } from '@/lib/print-utils';
import { useToast } from '@/hooks/use-toast';

const notificationSoundUrl = "https://storage.googleapis.com/starlit-id-prod.appspot.com/public-assets/notification.mp3";

interface NotificationContextType {
    isEnabled: boolean;
    isActivating: boolean;
    activateSystem: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children, companyData }: { children: ReactNode, companyData?: { name?: string, soundNotificationEnabled?: boolean; autoPrintEnabled?: boolean; }}) => {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const [isEnabled, setIsEnabled] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const processedOrderIds = useRef(new Set<string>());
    const listenerUnsubscribe = useRef<(() => void) | null>(null);

    useEffect(() => {
        // Cleanup listener on unmount
        return () => {
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
            }
        };
    }, []);

    const playSound = useCallback(() => {
        if (companyData?.soundNotificationEnabled) {
            // Create a new Audio object each time to ensure it's fresh and ready.
            const audio = new Audio(notificationSoundUrl);
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.error("Audio playback failed. User interaction might be needed.", err);
                    // Avoid toasting every time, as it can be annoying. The user will know from the activate button.
                });
            }
        }
    }, [companyData?.soundNotificationEnabled]);

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
            console.error("Firestore or user not available for listening to orders.");
            return;
        }

        if (listenerUnsubscribe.current) {
            console.log("Listener already active.");
            return; // Listener already active
        }
        
        console.log("Starting to listen for new orders...");
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
                        playSound();
                        printOrder(order);

                        const orderDocRef = doc(firestore, `companies/${user.uid}/orders`, order.id);
                        updateDocument(orderDocRef, { status: 'Em preparo' }).catch(err => {
                            console.error("Failed to update order status:", err);
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
            setIsEnabled(false);
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
                listenerUnsubscribe.current = null;
            }
        });

    }, [firestore, user?.uid, playSound, printOrder, toast]);

    const activateSystem = useCallback(() => {
        if (isEnabled || isActivating) return;
        
        setIsActivating(true);
        
        // Attempt to play a sound to get user gesture permission from the browser.
        const audio = new Audio(notificationSoundUrl);
        // We don't need to actually hear this test sound
        audio.volume = 0; 
        const playPromise = audio.play();

        playPromise.then(() => {
            // Success! The browser allowed audio playback.
            audio.pause();
            audio.currentTime = 0;
            
            listenToNewOrders(); // Now we can start listening for real orders
            setIsEnabled(true);
            toast({ title: "Sistema de notificação ativado!" });

        }).catch(error => {
            console.error("Failed to activate audio:", error);
            toast({
                variant: 'destructive',
                title: 'Não foi possível ativar o som',
                description: 'Seu navegador pode estar bloqueando a reprodução automática. Clique novamente para permitir.',
            });
            setIsEnabled(false);
        }).finally(() => {
            setIsActivating(false);
        });

    }, [isEnabled, isActivating, listenToNewOrders, toast]);

    const value = {
        isEnabled,
        isActivating,
        activateSystem,
    };

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
