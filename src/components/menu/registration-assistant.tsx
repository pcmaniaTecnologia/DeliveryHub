'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, MessageCircle } from 'lucide-react';

type Props = {
  name: string; phone: string; email: string; password: string;
  setName: (value: string) => void; setEmail: (value: string) => void; setPassword: (value: string) => void;
  onPhoneChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent) => void;
  loading: boolean; accountCreated: boolean;
};

export function RegistrationAssistant(props: Props) {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const titles = ['Como você se chama?', 'Qual é seu WhatsApp?', 'Qual é seu e-mail?', 'Escolha uma senha', 'Vamos conferir?'];
  const explanations = [
    'Vou ajudar você a criar sua conta, uma pergunta por vez. Escreva o nome que a loja deve usar no pedido.',
    'Digite o DDD e o número. A loja usará esse contato para falar sobre seu pedido.',
    'Você usará esse e-mail para entrar e recuperar a senha. Se já tem conta, escolha “Entrar” acima.',
    'Crie uma senha com pelo menos 6 caracteres. Você pode tocar no olho para conferir o que digitou.',
    'Confira os dados abaixo. Ao tocar em “Confirmar e criar minha conta”, o sistema fará seu cadastro. O endereço será informado ao pedir a entrega.',
  ];
  const validate = () => {
    let message = '';
    if (step === 0 && !props.name.trim()) message = 'Digite seu nome para continuar.';
    if (step === 1 && !/^\d{10,11}$/.test(props.phone.replace(/\D/g, ''))) message = 'Digite o DDD e o telefone completo, com 10 ou 11 números.';
    if (step === 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email.trim())) message = 'Confira seu e-mail. Exemplo: nome@gmail.com.';
    if (step === 3 && props.password.length < 6) message = 'Sua senha precisa ter pelo menos 6 caracteres.';
    setError(message);
    return !message;
  };
  return <form className="space-y-4 py-4" noValidate onSubmit={event => {
    event.preventDefault();
    if (props.loading) return;
    if (step < 4) { if (validate()) setStep(step + 1); }
    else props.onSubmit(event);
  }}>
    <div className="flex items-center gap-2 text-base font-semibold text-primary"><MessageCircle size={20} />Cadastro assistido</div>
    <p className="text-sm text-muted-foreground">Etapa {step + 1} de 5</p>
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full bg-primary transition-all" style={{ width: `${(step + 1) * 20}%` }} /></div>
    <div className="rounded-xl bg-muted p-4"><h3 className="text-xl font-semibold">{titles[step]}</h3><p className="mt-2 text-base leading-relaxed">{explanations[step]}</p></div>
    {props.accountCreated && <p role="status" className="text-base">Sua conta já foi criada. Falta salvar os dados. Toque em confirmar novamente para concluir.</p>}
    {step === 0 && <div className="space-y-2"><Label htmlFor="guided-name">Seu nome</Label><Input autoFocus id="guided-name" autoComplete="name" className="h-12 text-lg" value={props.name} onChange={e => props.setName(e.target.value)} disabled={props.loading} /></div>}
    {step === 1 && <div className="space-y-2"><Label htmlFor="guided-phone">WhatsApp com DDD</Label><Input autoFocus id="guided-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 99999-9999" className="h-12 text-lg" maxLength={15} value={props.phone} onChange={props.onPhoneChange} disabled={props.loading} /></div>}
    {step === 2 && <div className="space-y-2"><Label htmlFor="guided-email">Seu e-mail</Label><Input autoFocus id="guided-email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" className="h-12 text-lg" value={props.email} onChange={e => props.setEmail(e.target.value)} disabled={props.loading || props.accountCreated} /></div>}
    {step === 3 && <div className="space-y-2"><Label htmlFor="guided-password">Sua senha</Label><div className="flex gap-2"><Input autoFocus id="guided-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="h-12 text-lg" value={props.password} onChange={e => props.setPassword(e.target.value)} disabled={props.loading || props.accountCreated} /><Button type="button" variant="outline" className="h-12 shrink-0" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</Button></div></div>}
    {step === 4 && <dl className="space-y-3 rounded-xl border p-4 text-lg"><div><dt className="text-sm text-muted-foreground">Nome</dt><dd className="break-words">{props.name}</dd></div><div><dt className="text-sm text-muted-foreground">WhatsApp</dt><dd>{props.phone}</dd></div><div><dt className="text-sm text-muted-foreground">E-mail</dt><dd className="break-all">{props.email}</dd></div><div><dt className="text-sm text-muted-foreground">Senha</dt><dd>Senha definida</dd></div></dl>}
    {error && <p role="alert" className="text-base text-destructive">{error}</p>}
    <div className="flex gap-2">{step > 0 && <Button type="button" variant="outline" className="h-12 text-base" disabled={props.loading} onClick={() => { setError(''); setStep(step - 1); }}>Voltar</Button>}<Button type="submit" className="h-auto min-h-12 flex-1 whitespace-normal text-lg" disabled={props.loading}>{props.loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Criando cadastro...</> : step < 4 ? 'Continuar' : 'Confirmar e criar minha conta'}</Button></div>
  </form>;
}
