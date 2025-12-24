
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useFirestore, useUser, updateDocument } from '@/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import type { Order } from '@/app/dashboard/orders/page';
import { generateOrderPrintHtml } from '@/lib/print-utils';
import { useToast } from '@/hooks/use-toast';

const notificationSoundUrl = "https://actions.google.com/sounds/v1/alarms/doorbell_ring.ogg";

interface NotificationContextType {
    isEnabled: boolean;
    isActivating: boolean;
    activateSystem: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children, companyData }: { children: ReactNode, companyData?: { soundNotificationEnabled?: boolean; autoPrintEnabled?: boolean; name?: string }}) => {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const [isEnabled, setIsEnabled] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const processedOrderIds = useRef(new Set<string>());
    const listenerUnsubscribe = useRef<() => void | null>(null);

     useEffect(() => {
        // This effect runs once to create the audio element.
        const audio = document.createElement('audio');
        const source = document.createElement('source');
        source.src = notificationSoundUrl;
        source.type = 'audio/ogg';
        audio.appendChild(source);
        audio.preload = 'auto';
        document.body.appendChild(audio);
        audioRef.current = audio;

        return () => {
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
            }
            if (audioRef.current) {
                document.body.removeChild(audioRef.current);
                audioRef.current = null;
            }
        };
    }, []);

    const playSound = useCallback(() => {
        if (audioRef.current && companyData?.soundNotificationEnabled) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => {
                console.error("Audio playback failed.", err);
            });
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
        if (!firestore || !user?.uid || listenerUnsubscribe.current) return;

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
                        
                        // 1. Play sound
                        playSound();
                        
                        // 2. Print order
                        printOrder(order);

                        // 3. Update status to "Em preparo"
                        const orderDocRef = doc(firestore, `companies/${user.uid}/orders`, order.id);
                        updateDocument(orderDocRef, { status: 'Em preparo' });
                    }
                }
            });
        });
        
    }, [firestore, user?.uid, playSound, printOrder]);

    const activateSystem = useCallback(() => {
        if (isEnabled || isActivating || !audioRef.current) return;
        
        setIsActivating(true);

        const promise = audioRef.current.play();

        promise.then(() => {
            if(audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            
            setIsEnabled(true);
            listenToNewOrders();
            toast({
                title: 'Sistema Ativado',
                description: 'As notificações sonoras para novos pedidos estão ativas.',
            });
        }).catch((err) => {
            console.error("Could not activate audio:", err);
            toast({
                variant: 'destructive',
                title: 'Não foi possível ativar o som',
                description: 'Seu navegador pode estar bloqueando a reprodução automática. Interaja com a página e tente novamente.',
            });
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
