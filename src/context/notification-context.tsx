
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
    isActivating: boolean; // Manter para feedback de UI, mas a lógica será mais rápida
    activateSystem: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children, companyData }: { children: ReactNode, companyData?: { name?: string, soundNotificationEnabled?: boolean; autoPrintEnabled?: boolean; }}) => {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const [isEnabled, setIsEnabled] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const processedOrderIds = useRef(new Set<string>());
    const listenerUnsubscribe = useRef<(() => void) | null>(null);

    // Efeito para criar o elemento de áudio
    useEffect(() => {
        const audio = new Audio(notificationSoundUrl);
        audio.preload = 'auto';
        audioRef.current = audio;

        return () => {
            if (listenerUnsubscribe.current) {
                listenerUnsubscribe.current();
            }
        };
    }, []);

    const playSound = useCallback(() => {
        if (audioRef.current && companyData?.soundNotificationEnabled) {
            audioRef.current.play().catch(err => {
                console.error("Audio playback failed. User interaction might be needed.", err);
                toast({
                    variant: 'destructive',
                    title: 'Aviso sonoro bloqueado',
                    description: 'Interaja com a página para ativar o som.',
                });
            });
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
            console.error("Firestore or user not available for listening to orders.");
            return;
        }

        // Se já houver um listener, não crie outro.
        if (listenerUnsubscribe.current) {
            return;
        }
        
        const q = query(
            collection(firestore, `companies/${user.uid}/orders`),
            where('status', 'in', ['Novo', 'Aguardando pagamento'])
        );

        listenerUnsubscribe.current = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const order = { id: change.doc.id, ...change.doc.data() } as Order;
                    // Evita processar o mesmo pedido múltiplas vezes
                    if (!processedOrderIds.current.has(order.id)) {
                        processedOrderIds.current.add(order.id);
                        
                        console.log("New order detected:", order.id);
                        playSound();
                        printOrder(order);

                        // Atualiza o status do pedido
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
        });

    }, [firestore, user?.uid, playSound, printOrder, toast]);

    const activateSystem = useCallback(() => {
        if (isEnabled) return;
        
        setIsActivating(true);

        // A tentativa de tocar o som aqui serve como um "teste" para obter a permissão do navegador
        const audio = audioRef.current;
        if (!audio) {
            toast({ variant: 'destructive', title: 'Erro de áudio', description: 'Componente de áudio não inicializado.'});
            setIsActivating(false);
            return;
        }

        const playPromise = audio.play();

        playPromise.then(() => {
            audio.pause(); // Pausa imediatamente, só queríamos a permissão
            audio.currentTime = 0;
            
            listenToNewOrders();
            setIsEnabled(true);
            toast({ title: "Sistema de notificação ativado!" });
        }).catch(error => {
            console.error("Falha ao ativar o áudio:", error);
            toast({
                variant: 'destructive',
                title: 'Não foi possível ativar o som',
                description: 'Seu navegador pode estar bloqueando a reprodução automática. Interaja com a página e tente novamente.',
            });
            setIsEnabled(false);
        }).finally(() => {
            setIsActivating(false);
        });
    }, [isEnabled, listenToNewOrders, toast]);

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
