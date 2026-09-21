'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Share, PlusSquare, MoreVertical, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function useWaiterPwaInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Register Service Worker if supported
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // Silently ignore if failed
            });
        }

        // Check if running in standalone mode (already installed)
        if (
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true
        ) {
            setIsStandalone(true);
        }

        const ua = window.navigator.userAgent.toLowerCase();
        const isApple = /iphone|ipad|ipod/.test(ua);
        setIsIOS(isApple);

        // Detect in-app browsers (WhatsApp, Instagram, Facebook, etc.)
        const inApp = /fban|fbav|instagram|whatsapp|micromessenger/.test(ua);
        setIsInAppBrowser(inApp);

        const handleBeforeInstall = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const triggerInstall = async () => {
        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    setDeferredPrompt(null);
                    toast({
                        title: 'Instalando aplicativo!',
                        description: 'O ícone do Garçom aparecerá na sua tela inicial em instantes.'
                    });
                    return;
                }
            } catch (err) {
                console.error('Error invoking prompt', err);
            }
        }

        // Open instruction modal for iOS, in-app browser or when automatic prompt is not ready
        setIsModalOpen(true);
    };

    return {
        isStandalone,
        isIOS,
        isInAppBrowser,
        isModalOpen,
        setIsModalOpen,
        triggerInstall
    };
}

export function WaiterInstallDialog({
    open,
    onOpenChange,
    isIOS,
    isInAppBrowser
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isIOS: boolean;
    isInAppBrowser: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    const handleCopyLink = () => {
        if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            toast({
                title: 'Link copiado!',
                description: 'Abra o Chrome ou Safari e cole o link para instalar.'
            });
            setTimeout(() => setCopied(false), 3000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader className="text-center sm:text-left">
                    <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center mb-2">
                        <Smartphone className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-xl">Instalar Aplicativo do Garçom</DialogTitle>
                    <DialogDescription>
                        Tenha acesso rápido direto da tela inicial do seu celular, sem precisar de link todos os dias.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm text-foreground">
                    {isInAppBrowser && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200 text-xs">
                            <p className="font-semibold mb-1">Você abriu este link pelo WhatsApp/Instagram</p>
                            <p>Para conseguir instalar como aplicativo, toque nos 3 pontinhos do topo e selecione <strong>&quot;Abrir no Chrome&quot;</strong> ou <strong>&quot;Abrir no Safari&quot;</strong>.</p>
                        </div>
                    )}

                    {isIOS ? (
                        <div className="space-y-3 bg-muted/40 p-4 rounded-xl border">
                            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Passo a passo no iPhone / iPad (Safari):</p>
                            
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                                <div className="text-sm">
                                    Toque no botão <span className="font-bold inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-xs border"><Share className="w-3.5 h-3.5 text-blue-600" /> Compartilhar</span> na barra inferior do Safari.
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                                <div className="text-sm">
                                    Role o menu para baixo e toque em <span className="font-bold inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-xs border"><PlusSquare className="w-3.5 h-3.5 text-blue-600" /> Adicionar à Tela de Início</span>.
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                                <div className="text-sm">
                                    No canto superior direito, toque em <strong>&quot;Adicionar&quot;</strong>. Pronto!
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 bg-muted/40 p-4 rounded-xl border">
                            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Passo a passo no Android (Chrome):</p>
                            
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                                <div className="text-sm">
                                    Toque nos <span className="font-bold inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-xs border"><MoreVertical className="w-3.5 h-3.5" /> 3 pontinhos</span> no canto superior direito do navegador.
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                                <div className="text-sm">
                                    Toque em <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                                <div className="text-sm">
                                    Confirme em <strong>&quot;Instalar&quot;</strong>. O ícone aparecerá junto aos seus outros aplicativos!
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-2 text-xs"
                            onClick={handleCopyLink}
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Link copiado com sucesso!' : 'Copiar link desta página'}
                        </Button>
                    </div>
                </div>

                <DialogFooter className="mt-2">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onOpenChange(false)}>
                        Entendi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
