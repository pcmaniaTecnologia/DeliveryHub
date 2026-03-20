

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, Pizza, Ham, GlassWater, Cake, Sandwich, LeafyGreen, IceCream, UtensilsCrossed, type LucideIcon } from 'lucide-react';
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
    category?: string; // This might be present from older logic
    isActive: boolean;
    imageUrl?: string;
    imageUrls?: string[];
    variants?: VariantGroup[];
};

type Category = {
    id: string;
    name: string;
    companyId: string;
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


const OptionsDialog = ({ product, open, onOpenChange, onAddToCart }: { product: Product, open: boolean, onOpenChange: (open: boolean) => void, onAddToCart: (product: Product, quantity: number, notes?: string, variants?: SelectedVariant[]) => void }) => {
    const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
    const [notes, setNotes] = useState('');
    const { toast } = useToast();

    const handleSelection = (groupName: string, itemName: string, price: number, isSingleChoice: boolean) => {
        const group = product.variants?.find(v => v.name === groupName);
        if (!group) return;

        const isCurrentlySelected = selectedVariants.some(v => v.groupName === groupName && v.itemName === itemName);
        const groupItemsSelectedCount = selectedVariants.filter(v => v.groupName === groupName).length;

        if (isSingleChoice) {
             setSelectedVariants(prev => {
                const otherGroups = prev.filter(v => v.groupName !== groupName);
                return [...otherGroups, { groupName, itemName, price }];
             });
        } else {
             if (isCurrentlySelected) {
                // Uncheck: remove the item
                setSelectedVariants(prev => prev.filter(v => !(v.groupName === groupName && v.itemName === itemName)));
            } else {
                // Check: add the item if not exceeding max
                if (groupItemsSelectedCount >= group.max) {
                    toast({
                        variant: "destructive",
                        title: "Limite atingido",
                        description: `Você só pode selecionar até ${group.max} ${group.max > 1 ? 'opções' : 'opção'} para "${groupName}".`,
                    });
                } else {
                    setSelectedVariants(prev => [...prev, { groupName, itemName, price }]);
                }
            }
        }
    };

    const isSelected = (groupName: string, itemName: string) => {
        return selectedVariants.some(v => v.groupName === groupName && v.itemName === itemName);
    };

    const finalPrice = useMemo(() => {
        const optionsPrice = selectedVariants.reduce((total, variant) => total + variant.price, 0);
        return product.price + optionsPrice;
    }, [product.price, selectedVariants]);

    const handleConfirm = () => {
        // Validate minimum requirements
        for (const group of product.variants || []) {
            const selectedCount = selectedVariants.filter(v => v.groupName === group.name).length;
            if (selectedCount < group.min) {
                toast({
                    variant: "destructive",
                    title: "Seleção Incompleta",
                    description: `Por favor, selecione pelo menos ${group.min} ${group.min > 1 ? 'opções' : 'opção'} para "${group.name}".`,
                });
                return;
            }
        }
        onAddToCart(product, 1, notes, selectedVariants);
        onOpenChange(false);
    };
    
    // Reset state when dialog opens or product changes
    useEffect(() => {
        if (open) {
            setSelectedVariants([]);
            setNotes('');
        }
    }, [open, product]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{product.name}</DialogTitle>
                    <DialogDescription>{product.description}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-4">
                        {product.variants?.map((group) => {
                            const isSingleChoice = group.max === 1 && group.min === 1;
                            return (
                                <div key={group.name} className="space-y-2">
                                    <Separator />
                                    <h4 className="font-semibold">{group.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                       {group.min > 0 && group.max > group.min ? `Selecione de ${group.min} a ${group.max} opções.` :
                                        group.min > 0 && group.max === group.min ? `Selecione ${group.min} ${group.min > 1 ? 'opções' : 'opção'}.` :
                                        `Selecione até ${group.max} ${group.max > 1 ? 'opções' : 'opção'}.`
                                       }
                                    </p>
                                    
                                    {isSingleChoice ? (
                                        <RadioGroup onValueChange={(value) => handleSelection(group.name, value.split(';')[0], parseFloat(value.split(';')[1]), true)}>
                                            {group.items.map(item => (
                                                <div key={item.name} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={`${item.name};${item.price}`} id={`${group.name}-${item.name}`} />
                                                    <Label htmlFor={`${group.name}-${item.name}`} className="flex-grow">{item.name}</Label>
                                                    {item.price > 0 && <span className="text-sm text-muted-foreground">+ R$ {item.price.toFixed(2)}</span>}
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    ) : (
                                        group.items.map(item => (
                                            <div key={item.name} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`${group.name}-${item.name}`}
                                                    checked={isSelected(group.name, item.name)}
                                                    onCheckedChange={() => handleSelection(group.name, item.name, item.price, false)}
                                                />
                                                <Label htmlFor={`${group.name}-${item.name}`} className="flex-grow">{item.name}</Label>
                                                {item.price > 0 && <span className="text-sm text-muted-foreground">+ R$ {item.price.toFixed(2)}</span>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            );
                        })}
                         <Separator />
                         <div className="space-y-2">
                            <Label htmlFor="notes">Observações</Label>
                            <Textarea id="notes" placeholder="Ex: tirar a cebola, ponto da carne, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
                         </div>
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <div className="flex w-full justify-between items-center">
                        <span className="text-lg font-bold">Total: R$ {finalPrice.toFixed(2)}</span>
                        <Button onClick={handleConfirm}>Adicionar ao Carrinho</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// Modern Horizontal Product Card Premium Layout
const ProductCard = ({ product, index }: { product: Product, index: number }) => {
    const { addToCart } = useCart();
    const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
    
   const imageUrl = useMemo(() => {
    return product.imageUrl || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : null);
  }, [product]);

    const handleAddToCart = () => {
        if (product.variants && product.variants.length > 0) {
            setIsOptionsDialogOpen(true);
        } else {
            addToCart(product);
        }
    };

    return (
        <>
             <div
                className="group relative flex cursor-pointer overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md"
                onClick={handleAddToCart}
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
                            style={{ objectFit: "cover" }}
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
            {product.variants && product.variants.length > 0 && (
                <OptionsDialog 
                    product={product} 
                    open={isOptionsDialogOpen} 
                    onOpenChange={setIsOptionsDialogOpen}
                    onAddToCart={addToCart}
                />
            )}
        </>
    )
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
    
    const categoryOrder = categories.map(c => c.name);

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
        finalGrouped[name] = grouped[name];
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
                        <ProductCard key={product.id} product={product} index={idx * 10 + pIdx} />
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
