


'use client';

import { logoAdjustmentStyle, type LogoAdjustments } from '@/lib/logo-adjustments';
import { resolveLogoUrl } from '@/lib/logo-url';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, writeBatch, increment, deleteField } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Pizza, Ham, GlassWater, Cake, Sandwich, LeafyGreen, IceCream, UtensilsCrossed, type LucideIcon, Search, X, Clock, ThumbsUp, ThumbsDown, ArrowUpRight, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useCart, type SelectedVariant } from '@/context/cart-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';


type Company = {
    name: string;
    logoUrl?: string;
    logoAdjustments?: LogoAdjustments;
    address?: string;
    seoDescription?: string;
    averagePrepTime?: number;
};

type VariantItem = {
  name: string;
  price: number;
};

type VariantGroup = {
  name: string;
  min: number;
  max: number;
  items: VariantItem[];
};

export type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    categoryId: string;
    category?: string;
    isActive: boolean;
    imageUrl?: string;
    imageUrls?: string[];
    variants?: VariantGroup[];
    ingredients?: string;
    sortOrder?: number;
    stockControlEnabled?: boolean;
    blockIfOutOfStock?: boolean;
    stock?: number;
    isSoldByWeight?: boolean;
    upvotes?: number;
    downvotes?: number;
};

type Category = {
    id: string;
    name: string;
    companyId: string;
    sortOrder?: number;
};

// Function to get an icon for a category
const getCategoryIcon = (categoryName: string): LucideIcon => {
    const normalizedName = categoryName.toLowerCase();
    
    const iconMap: { [key: string]: LucideIcon } = {
        'pizzas': Pizza,
        'hambúrgueres': Ham,
        'burgers': Ham,
        'bebidas': GlassWater,
        'refrigerantes': GlassWater,
        'sucos': GlassWater,
        'sobremesas': Cake,
        'doces': Cake,
        'lanches': Sandwich,
        'sanduíches': Sandwich,
        'saladas': LeafyGreen,
        'açaí': IceCream,
        'porções': UtensilsCrossed,
        'entradas': UtensilsCrossed,
    };

    const foundKey = Object.keys(iconMap).find(key => normalizedName.includes(key));
    
    return foundKey ? iconMap[foundKey] : UtensilsCrossed;
};


const ProductDetailDialog = ({
    product,
    open,
    onOpenChange,
    onAddToCart,
}: {
    product: Product;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAddToCart: (product: Product, quantity: number, notes?: string, variants?: SelectedVariant[]) => void;
}) => {
    const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
    const [notes, setNotes] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [weight, setWeight] = useState('1.000');
    const { toast } = useToast();

    const imageUrl = product.imageUrl || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : null);

    const handleSelection = (groupName: string, itemName: string, price: number, isSingleChoice: boolean) => {
        const group = product.variants?.find(v => v.name === groupName);
        if (!group) return;
        const isCurrentlySelected = selectedVariants.some(v => v.groupName === groupName && v.itemName === itemName);
        const groupItemsSelectedCount = selectedVariants.filter(v => v.groupName === groupName).length;
        if (isSingleChoice) {
            setSelectedVariants(prev => [...prev.filter(v => v.groupName !== groupName), { groupName, itemName, price }]);
        } else {
            if (isCurrentlySelected) {
                setSelectedVariants(prev => prev.filter(v => !(v.groupName === groupName && v.itemName === itemName)));
            } else {
                if (groupItemsSelectedCount >= group.max) {
                    toast({ variant: 'destructive', title: 'Limite atingido', description: `Máximo de ${group.max} opção(ões) para "${groupName}".` });
                } else {
                    setSelectedVariants(prev => [...prev, { groupName, itemName, price }]);
                }
            }
        }
    };

    const isSelected = (groupName: string, itemName: string) =>
        selectedVariants.some(v => v.groupName === groupName && v.itemName === itemName);

    const unitPrice = useMemo(() => {
        const optionsPrice = selectedVariants.reduce((total, v) => total + v.price, 0);
        return product.price + optionsPrice;
    }, [product.price, selectedVariants]);

    const finalPrice = product.isSoldByWeight 
        ? unitPrice * (parseFloat(weight.replace(',', '.')) || 0)
        : unitPrice * quantity;

    const handleConfirm = () => {
        for (const group of product.variants || []) {
            const selectedCount = selectedVariants.filter(v => v.groupName === group.name).length;
            if (selectedCount < group.min) {
                toast({ variant: 'destructive', title: 'Seleção Incompleta', description: `Selecione pelo menos ${group.min} opção(ões) para "${group.name}".` });
                return;
            }
        }
        if (product.isSoldByWeight) {
            const w = parseFloat(weight.replace(',', '.'));
            if (isNaN(w) || w <= 0) {
                toast({ variant: 'destructive', title: 'Peso Inválido', description: 'Por favor, insira um peso válido.' });
                return;
            }
            onAddToCart(product, w, notes, selectedVariants);
        } else {
            onAddToCart(product, quantity, notes, selectedVariants);
        }
        onOpenChange(false);
    };

    useEffect(() => {
        if (open) {
            setSelectedVariants([]);
            setNotes('');
            setQuantity(1);
            setWeight('1.000');
        }
    }, [open, product]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="menu-product-dialog sm:max-w-lg p-0 overflow-hidden rounded-3xl">
                {/* Always include DialogTitle for accessibility */}
                <DialogHeader className="sr-only">
                    <DialogTitle>{product.name}</DialogTitle>
                </DialogHeader>

                {/* Product Image Banner */}
                {imageUrl ? (
                    <div className="relative h-52 w-full bg-muted">
                        <Image src={imageUrl} alt={product.name} fill style={{ objectFit: 'cover' }} unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4">
                            <h2 className="text-xl font-bold text-white drop-shadow">{product.name}</h2>
                            <p className="text-sm text-white/80 mt-0.5">R$ {product.price.toFixed(2)}</p>
                        </div>
                    </div>
                ) : (
                    <div className="px-5 pt-2">
                        <p className="text-xl font-bold">{product.name}</p>
                    </div>
                )}

                <ScrollArea className="max-h-[55vh]">
                    <div className="space-y-4 px-5 py-4">
                        {/* Description */}
                        {product.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
                        )}

                        {/* Ingredients */}
                        {product.ingredients && (
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Ingredientes</p>
                                <p className="text-sm text-foreground">{product.ingredients}</p>
                            </div>
                        )}

                        {/* Variants/Add-ons */}
                        {product.variants?.map((group) => {
                            const isSingleChoice = group.max === 1 && group.min === 1;
                            return (
                                <div key={group.name} className="space-y-2">
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold">{group.name}</h4>
                                        {group.min > 0 && <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">Obrigatório</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {group.min > 0 && group.max > group.min
                                            ? `Selecione de ${group.min} a ${group.max} opções`
                                            : group.min > 0 && group.max === group.min
                                            ? `Selecione ${group.min} ${group.min > 1 ? 'opções' : 'opção'}`
                                            : `Selecione até ${group.max} ${group.max > 1 ? 'opções' : 'opção'}`}
                                    </p>
                                    {isSingleChoice ? (
                                        <RadioGroup onValueChange={(value) => handleSelection(group.name, value.split(';')[0], parseFloat(value.split(';')[1]), true)}>
                                            {group.items.map(item => (
                                                <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <RadioGroupItem value={`${item.name};${item.price}`} id={`${group.name}-${item.name}`} />
                                                        <Label htmlFor={`${group.name}-${item.name}`} className="cursor-pointer font-normal">{item.name}</Label>
                                                    </div>
                                                    {item.price > 0 && <span className="text-sm font-medium text-primary">+ R$ {item.price.toFixed(2)}</span>}
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    ) : (
                                        <div className="space-y-2">
                                            {group.items.map(item => (
                                                <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id={`${group.name}-${item.name}`}
                                                            checked={isSelected(group.name, item.name)}
                                                            onCheckedChange={() => handleSelection(group.name, item.name, item.price, false)}
                                                        />
                                                        <Label htmlFor={`${group.name}-${item.name}`} className="cursor-pointer font-normal">{item.name}</Label>
                                                    </div>
                                                    {item.price > 0 && <span className="text-sm font-medium text-primary">+ R$ {item.price.toFixed(2)}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Notes */}
                        <Separator />
                        
                        {product.isSoldByWeight && (
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-3">
                                <Label className="text-primary font-bold">Informar Peso (Kg)</Label>
                                <div className="relative">
                                    <Input 
                                        type="text" 
                                        className="h-14 text-2xl font-black text-center pr-12" 
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        placeholder="1.000"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Kg</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground text-center">Ex: 0.500 para 500 gramas</p>
                            </div>
                        )}

                        <div className="space-y-2 pb-2">
                            <Label htmlFor="notes" className="font-semibold">Alguma observação?</Label>
                            <Textarea
                                id="notes"
                                placeholder="Ex: sem cebola, ponto da carne bem passado…"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="resize-none"
                                rows={2}
                            />
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer: Quantity + Add to Cart */}
                <div className="flex items-center gap-3 border-t px-5 py-4 bg-background">
                    {/* Quantity selector or Weight text */}
                    {!product.isSoldByWeight ? (
                        <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
                            <button
                                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                disabled={quantity <= 1}
                            >
                                <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-5 text-center font-bold text-base">{quantity}</span>
                            <button
                                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setQuantity(q => q + 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center px-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Peso</span>
                            <span className="text-sm font-black">{(parseFloat(weight.replace(',', '.')) || 0).toFixed(3)}kg</span>
                        </div>
                    )}
                    {/* Add to cart button */}
                    {product.stockControlEnabled && product.blockIfOutOfStock !== false && (Number(product.stock) || 0) <= 0 ? (
                        <Button className="flex-1 h-11 text-base font-semibold" disabled variant="destructive">
                            Esgotado
                        </Button>
                    ) : (
                        <Button className="flex-1 h-11 text-base font-semibold" onClick={handleConfirm}>
                            Adicionar · R$ {finalPrice.toFixed(2)}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};


const ProductVotingBar = ({ 
    upvotes = 0, 
    downvotes = 0, 
    userVote, 
    onVote 
}: { 
    upvotes?: number;
    downvotes?: number;
    userVote?: 'up' | 'down' | null;
    onVote: (type: 'up' | 'down') => void;
}) => {
    const total = upvotes + downvotes;
    const upPercentage = total === 0 ? 50 : (upvotes / total) * 100;
    
    return (
        <div className="flex items-center gap-2 mt-3 w-full max-w-[200px]" onClick={(e) => e.stopPropagation()}>
            <button 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold transition-colors ${userVote === 'up' ? 'bg-green-500/10 text-green-600' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={(e) => { e.stopPropagation(); onVote('up'); }}
            >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{upvotes}</span>
            </button>
            
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                <div className="bg-green-500 h-full transition-all" style={{ width: `${upPercentage}%` }} />
                <div className="bg-red-500 h-full transition-all" style={{ width: `${100 - upPercentage}%` }} />
            </div>

            <button 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold transition-colors ${userVote === 'down' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={(e) => { e.stopPropagation(); onVote('down'); }}
            >
                <span>{downvotes}</span>
                <ThumbsDown className="h-3.5 w-3.5" />
            </button>
        </div>
    );
};

const ProductCard = ({ product, userVote, onVote }: { product: Product, userVote?: 'up' | 'down' | null, onVote?: (type: 'up' | 'down') => void }) => {
    const { addToCart } = useCart();
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const imageUrl = useMemo(() =>
        product.imageUrl || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : null)
    , [product]);

    const isSoldOut = product.stockControlEnabled && product.blockIfOutOfStock !== false && (Number(product.stock) || 0) <= 0;
    return (
        <>
            <Card className="menu-product-card group flex h-full flex-col overflow-hidden border shadow-sm">
                <button type="button" className="relative block aspect-[16/10] w-full overflow-hidden bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => setIsDetailOpen(true)} aria-label={'Ver detalhes de ' + product.name}>
                    {imageUrl ? <Image src={imageUrl} alt={product.name} fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" className={'object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 ' + (isSoldOut ? 'grayscale opacity-60' : '')} unoptimized /> : <div className="menu-product-placeholder flex h-full items-center justify-center"><UtensilsCrossed className="h-14 w-14 text-primary/40" strokeWidth={1} /></div>}
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">{isSoldOut ? 'Esgotado' : product.isSoldByWeight ? 'Vendido por kg' : 'Confira os detalhes'}</span>
                    <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-800"><ArrowUpRight className="h-4 w-4" /></span>
                </button>
                <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-bold leading-snug tracking-tight">{product.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                    {onVote && <ProductVotingBar upvotes={product.upvotes} downvotes={product.downvotes} userVote={userVote} onVote={onVote} />}
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{product.variants?.length ? 'A partir de' : 'Preço'}{product.isSoldByWeight ? ' / kg' : ''}</p>
                            <p className="mt-0.5 text-xl font-bold tracking-tight text-foreground">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <Button size="sm" className="h-10 rounded-full px-4 font-semibold" onClick={() => setIsDetailOpen(true)} disabled={isSoldOut} aria-label={'Escolher ' + product.name}><Plus className="h-4 w-4" />{isSoldOut ? 'Esgotado' : 'Escolher'}</Button>
                    </div>
                </div>
            </Card>
            <ProductDetailDialog product={product} open={isDetailOpen} onOpenChange={setIsDetailOpen} onAddToCart={addToCart} />
        </>
    );
};


export default function MenuPage() {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const params = useParams();
  const companyId = params?.companyId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch company data
  const companyRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return doc(firestore, 'companies', companyId);
  }, [firestore, companyId]);
  const { data: company, isLoading: isLoadingCompany } = useDoc<Company>(companyRef);

  // Fetch products
  const productsRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, 'companies', companyId, 'products');
  }, [firestore, companyId]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  // Fetch categories
  const categoriesRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, 'companies', companyId, 'categories');
  }, [firestore, companyId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesRef);

  // Fetch user votes
  const userVotesRef = useMemoFirebase(() => {
    if (!firestore || !companyId || !user) return null;
    return doc(firestore, 'companies', companyId, 'userVotes', user.uid);
  }, [firestore, companyId, user]);
  const { data: userVotesDoc } = useDoc<{ votes: Record<string, 'up' | 'down'> }>(userVotesRef);
  const userVotes = userVotesDoc?.votes || {};

  const handleVote = async (productId: string, currentVote: 'up' | 'down' | null, newVote: 'up' | 'down') => {
    if (!firestore) return;

    if (!user || user.isAnonymous) {
        toast({
            title: 'Acesso Restrito',
            description: 'Por favor, faça login ou cadastre-se para avaliar este lanche.',
            variant: 'destructive',
        });
        alert('Acesso Restrito: Por favor, faça login na sua conta para avaliar os lanches.');
        return;
    }
    
    const batch = writeBatch(firestore);
    const productRef = doc(firestore, 'companies', companyId, 'products', productId);
    const userVotesDocRef = doc(firestore, 'companies', companyId, 'userVotes', user.uid);
    
    const productUpdates: any = {};
    const userVotesUpdates: any = {};

    if (currentVote === newVote) {
        // Remove vote
        if (newVote === 'up') productUpdates.upvotes = increment(-1);
        if (newVote === 'down') productUpdates.downvotes = increment(-1);
        userVotesUpdates[`votes.${productId}`] = deleteField();
    } else {
        // Change or add vote
        if (newVote === 'up') {
            productUpdates.upvotes = increment(1);
            if (currentVote === 'down') productUpdates.downvotes = increment(-1);
        } else {
            productUpdates.downvotes = increment(1);
            if (currentVote === 'up') productUpdates.upvotes = increment(-1);
        }
        userVotesUpdates[`votes.${productId}`] = newVote;
    }
    
    batch.update(productRef, productUpdates);
    batch.set(userVotesDocRef, userVotesUpdates, { merge: true });
    
    try {
        await batch.commit();
    } catch (error) {
        console.error("Error committing vote:", error);
    }
  };

  const productsByCategory = useMemo(() => {
    if (!products || !categories) return {};

    const activeProducts = products.filter(p => {
        const matchesActive = p.isActive;
        if (!matchesActive) return false;
        
        if (!searchQuery.trim()) return true;
        
        const queryNorm = searchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const nameNorm = p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const descNorm = (p.description || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        
        return nameNorm.includes(queryNorm) || descNorm.includes(queryNorm);
    });

    const categoriesById = new Map(categories.map(c => [c.id, c.name]));

    const grouped = activeProducts.reduce((acc, product) => {
        const categoryName = categoriesById.get(product.categoryId) || 'Outros';
        if (!acc[categoryName]) {
            acc[categoryName] = [];
        }
        acc[categoryName].push(product);
        return acc;
    }, {} as { [key: string]: Product[] });
    
    // Filtramos para manter apenas categorias que possuem produtos após a busca
    const filteredGrouped = Object.fromEntries(
        Object.entries(grouped).filter(([_, items]) => items.length > 0)
    );

    const sortedCategoriesList = [...categories].sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        return a.name.localeCompare(b.name);
    });

    const categoryOrder = sortedCategoriesList.map(c => c.name);

    const sortedCategoryNames = Object.keys(filteredGrouped).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (a === 'Outros') return 1;
        if (b === 'Outros') return -1;
        if (indexA > -1 && indexB > -1) return indexA - indexB;
        if (indexA > -1) return -1;
        if (indexB > -1) return 1;
        return a.localeCompare(b);
    });

    const finalGrouped: { [key: string]: Product[] } = {};
    for (const name of sortedCategoryNames) {
        finalGrouped[name] = filteredGrouped[name].sort((a, b) => {
            if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
            if (a.sortOrder !== undefined) return -1;
            if (b.sortOrder !== undefined) return 1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return finalGrouped;

  }, [products, categories, searchQuery]);

  const isLoading = isLoadingCompany || isLoadingProducts || isLoadingCategories;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-5 sm:py-8">
      {isLoading ? (
        <header className="mb-10 text-center space-y-4 pt-4">
             <Skeleton className="h-24 w-24 rounded-full mx-auto" />
             <Skeleton className="h-10 w-1/2 mx-auto" />
             <Skeleton className="h-5 w-1/3 mx-auto" />
        </header>
      ) : company ? (
        <header className="menu-brand-hero relative mb-7 overflow-hidden rounded-[1.75rem] border px-5 py-8 text-center sm:rounded-[2rem] sm:py-10">
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            {company.logoUrl && company.logoUrl !== failedLogoUrl ? (
              <div className="menu-logo-frame relative mb-5 h-36 w-36 overflow-hidden rounded-[2rem] bg-white p-3 sm:h-44 sm:w-44">
                <Image src={resolveLogoUrl(company.logoUrl)} alt={'Logo de ' + (company.name || 'empresa')} fill priority sizes="(max-width: 639px) 144px, 176px" className="object-contain p-3" style={logoAdjustmentStyle(company.logoAdjustments)} onError={() => setFailedLogoUrl(company.logoUrl || null)} unoptimized />
              </div>
            ) : (
              <div className="menu-logo-frame mb-5 grid h-28 w-28 place-items-center rounded-[2rem] bg-white text-primary">
                <UtensilsCrossed className="h-12 w-12" strokeWidth={1.5} />
              </div>
            )}
            <span className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cardápio online</span>
            <h1 className="w-full break-words text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">{company.name || 'Bem-vindo ao nosso cardápio'}</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{company.seoDescription || 'Escolha seus favoritos e faça seu pedido do seu jeito.'}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              {company.averagePrepTime ? <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-2"><Clock className="h-4 w-4 text-primary" />Preparo: ~{company.averagePrepTime} min</span> : null}
              {company.address && <span className="flex max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-2"><MapPin className="h-4 w-4 shrink-0 text-primary" />{company.address}</span>}
            </div>
          </div>
        </header>
      ) : (
         <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-destructive">Loja não encontrada.</h1>
            <p className="mt-3 text-lg text-muted-foreground">O link do cardápio pode estar incorreto.</p>
        </header>
      )}

      <div id="menu-products" className="space-y-8 pb-28 scroll-mt-24">
        {/* Search Bar */}
        {!isLoading && (
            <div className="max-w-2xl mx-auto">
                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        aria-label="Buscar pratos ou bebidas" placeholder="O que você está com vontade de pedir?"
                        className="pl-14 pr-12 h-14 text-base rounded-2xl border bg-card shadow-sm focus-visible:ring-primary"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            aria-label="Limpar busca"
                            className="absolute right-5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
                        >
                            <X className="h-5 w-5 text-foreground" />
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Sticky Category Navbar */}
        {!isLoading && Object.keys(productsByCategory).length > 0 && (
            <div className="sticky top-16 z-20 -mx-4 overflow-x-auto border-b bg-background/95 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
                <div className="flex gap-3 pb-1">
                    {Object.keys(productsByCategory).map(cat => (
                        <a 
                            key={cat} 
                            href={`#cat-${cat.replace(/\s+/g, '-')}`} 
                            className="whitespace-nowrap rounded-full bg-card border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary"
                        >
                           {cat}
                        </a>
                    ))}
                </div>
            </div>
        )}

        {isLoading ? (
            Object.keys(Array.from({length: 3})).map((key) => (
                <div key={key} className="space-y-6">
                    <Skeleton className="h-8 w-1/4" />
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                       {Array.from({length: 4}).map((_, i) => (
                           <Card key={i} className="flex p-4 gap-4 h-36">
                               <div className="flex-1 space-y-3">
                                   <Skeleton className="h-5 w-3/4" />
                                   <Skeleton className="h-4 w-full" />
                                   <Skeleton className="h-4 w-1/4 mt-4" />
                               </div>
                               <Skeleton className="h-28 w-28 rounded-xl shrink-0" />
                           </Card>
                       ))}
                    </div>
                </div>
            ))
        ) : Object.keys(productsByCategory).length > 0 ? (
          Object.entries(productsByCategory).map(([category, productList], idx) => {
            const Icon = getCategoryIcon(category);
            return (
                <section key={category} id={`cat-${category.replace(/\s+/g, '-')}`} className="scroll-mt-40">
                    <div className="flex items-center gap-3 mb-6 px-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-6 w-6" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">{category}</h2>
                        <span className="ml-auto rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">{productList.length} opções</span>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {productList.map((product, pIdx) => {
                            const currentVote = userVotes[product.id] || null;
                            return (
                                <ProductCard 
                                    key={product.id} 
                                    product={product} 
                                    userVote={currentVote}
                                    onVote={(type) => handleVote(product.id, currentVote, type)}
                                />
                            );
                        })}
                    </div>
                </section>
            )
          })
        ) : (
            <div className="text-center py-16">
                <p className="text-xl text-muted-foreground">Nenhum produto encontrado.</p>
                <p className="mt-2 text-sm">Parece que ainda não há produtos ativos neste cardápio.</p>
            </div>
        )}
      </div>
    </div>
  );
}
