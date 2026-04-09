

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, Minus, Pizza, Ham, GlassWater, Cake, Sandwich, LeafyGreen, IceCream, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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


type Company = {
    name: string;
    logoUrl?: string;
    address?: string;
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

    const finalPrice = unitPrice * quantity;

    const handleConfirm = () => {
        for (const group of product.variants || []) {
            const selectedCount = selectedVariants.filter(v => v.groupName === group.name).length;
            if (selectedCount < group.min) {
                toast({ variant: 'destructive', title: 'Seleção Incompleta', description: `Selecione pelo menos ${group.min} opção(ões) para "${group.name}".` });
                return;
            }
        }
        onAddToCart(product, quantity, notes, selectedVariants);
        onOpenChange(false);
    };

    useEffect(() => {
        if (open) {
            setSelectedVariants([]);
            setNotes('');
            setQuantity(1);
        }
    }, [open, product]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
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
                    {/* Quantity selector */}
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
                    {/* Add to cart button */}
                    <Button className="flex-1 h-11 text-base font-semibold" onClick={handleConfirm}>
                        Adicionar · R$ {finalPrice.toFixed(2)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};


const ProductCard = ({ product }: { product: Product }) => {
    const { addToCart } = useCart();
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const imageUrl = useMemo(() =>
        product.imageUrl || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : null)
    , [product]);

    return (
        <>
            <div
                className="group relative flex cursor-pointer overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md"
                onClick={() => setIsDetailOpen(true)}
            >
                <div className="flex flex-1 flex-col justify-between pr-4">
                    <div>
                        <h3 className="text-base font-bold leading-tight text-foreground">{product.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                    </div>
                    <div className="mt-4 font-semibold text-primary">R$ {product.price.toFixed(2)}</div>
                </div>

                {imageUrl ? (
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted/20">
                        <Image
                            src={imageUrl}
                            alt={product.name}
                            fill
                            style={{ objectFit: 'cover' }}
                            className="transition-transform duration-500 group-hover:scale-110"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="absolute bottom-1 right-1 flex h-8 w-8 translate-x-4 translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-300 group-hover:translate-x-0 group-hover:translate-y-0">
                            <Plus className="h-5 w-5" />
                        </div>
                    </div>
                ) : (
                    <div className="flex shrink-0 flex-col justify-end">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <Plus className="h-5 w-5" />
                        </div>
                    </div>
                )}
            </div>

            <ProductDetailDialog
                product={product}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                onAddToCart={addToCart}
            />
        </>
    );
};

export default function MenuPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const firestore = useFirestore();

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

  const productsByCategory = useMemo(() => {
    if (!products || !categories) return {};

    const activeProducts = products.filter(p => p.isActive);

    const categoriesById = new Map(categories.map(c => [c.id, c.name]));

    const grouped = activeProducts.reduce((acc, product) => {
        const categoryName = categoriesById.get(product.categoryId) || 'Outros';
        if (!acc[categoryName]) {
            acc[categoryName] = [];
        }
        acc[categoryName].push(product);
        return acc;
    }, {} as { [key: string]: Product[] });
    const sortedCategoriesList = [...categories].sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        return a.name.localeCompare(b.name);
    });

    const categoryOrder = sortedCategoriesList.map(c => c.name);

    const sortedCategoryNames = Object.keys(grouped).sort((a, b) => {
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
        finalGrouped[name] = grouped[name].sort((a, b) => {
            if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
            if (a.sortOrder !== undefined) return -1;
            if (b.sortOrder !== undefined) return 1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return finalGrouped;

  }, [products, categories]);

  const isLoading = isLoadingCompany || isLoadingProducts || isLoadingCategories;

  return (
    <div className="container mx-auto px-4 py-8">
      {isLoading ? (
        <header className="mb-10 text-center space-y-4 pt-4">
             <Skeleton className="h-24 w-24 rounded-full mx-auto" />
             <Skeleton className="h-10 w-1/2 mx-auto" />
             <Skeleton className="h-5 w-1/3 mx-auto" />
        </header>
      ) : company ? (
        <header className="mb-8 pt-6 text-center relative">
            <div className="absolute inset-0 -top-8 -z-10 h-64 w-full bg-gradient-to-b from-primary/10 to-background opacity-60 pointer-events-none" />
            
            {company.logoUrl && (
                <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border-4 border-background shadow-lg">
                    <Image src={company.logoUrl} alt={`${company.name} logo`} width={96} height={96} className="h-full w-full object-cover" />
                </div>
            )}
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 pb-1">{company.name}</h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">{company.address}</p>
          
          {company.averagePrepTime && (
            <div className="mt-5 inline-flex flex-col items-center gap-1 rounded-2xl bg-card px-5 py-2.5 shadow-sm border">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Clock className="h-4 w-4"/>
                    <span>Tempo de Preparo</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">~{company.averagePrepTime} minutos</span>
            </div>
          )}
        </header>
      ) : (
         <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-destructive">Loja não encontrada.</h1>
            <p className="mt-3 text-lg text-muted-foreground">O link do cardápio pode estar incorreto.</p>
        </header>
      )}

      <div className="space-y-12 pb-24">
        {/* Sticky Category Navbar */}
        {!isLoading && Object.keys(productsByCategory).length > 0 && (
            <div className="sticky top-0 z-20 -mx-4 mb-8 overflow-x-auto bg-background/80 px-4 py-3 backdrop-blur-xl border-b shadow-sm sm:mx-0 sm:rounded-b-2xl sm:px-6">
                <div className="flex gap-2 pb-1">
                    {Object.keys(productsByCategory).map(cat => (
                        <a 
                            key={cat} 
                            href={`#cat-${cat.replace(/\s+/g, '-')}`} 
                            className="whitespace-nowrap rounded-full bg-muted/60 px-5 py-2 text-sm font-semibold text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md active:scale-95"
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
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
                <section key={category} id={`cat-${category.replace(/\s+/g, '-')}`} className="scroll-mt-24">
                    <div className="flex items-center gap-3 mb-6 px-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-6 w-6" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{category}</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {productList.map((product, pIdx) => (
                        <ProductCard key={product.id} product={product} />
                        ))}
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
