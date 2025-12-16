
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
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
    category: string;
    isActive: boolean;
    imageUrl?: string;
    variants?: VariantGroup[];
};

type Category = {
    id: string;
    name: string;
    companyId: string;
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


const ProductCard = ({ product, index }: { product: Product, index: number }) => {
    const { addToCart } = useCart();
    const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
    
   const imagePlaceholder: ImagePlaceholder = useMemo(() => {
    if (product.imageUrl) {
      return {
        id: product.id,
        imageUrl: product.imageUrl,
        imageHint: 'product image',
        description: product.name,
      };
    }
    const defaultPlaceholder: ImagePlaceholder = {
      id: 'default',
      imageUrl: `https://picsum.photos/seed/${product.id}/400/300`,
      imageHint: 'food placeholder',
      description: 'Default product image',
    };
    const placeholders = PlaceHolderImages.filter(p => p.id.startsWith('product-'));
    if (placeholders.length === 0) return defaultPlaceholder;
    return placeholders[index % placeholders.length] ?? defaultPlaceholder;
  }, [product, index]);

    const handleAddToCart = () => {
        if (product.variants && product.variants.length > 0) {
            setIsOptionsDialogOpen(true);
        } else {
            addToCart(product);
        }
    };

    return (
        <>
            <Card className="flex flex-col overflow-hidden h-full">
                <div className="relative w-full h-48">
                    <Image
                        src={imagePlaceholder.imageUrl}
                        alt={product.name}
                        fill
                        style={{objectFit:"cover"}}
                        className="transition-transform duration-300 group-hover:scale-105"
                        data-ai-hint={imagePlaceholder.imageHint}
                        unoptimized
                    />
                </div>
                <CardHeader className="flex-grow">
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground pt-1">{product.description}</CardDescription>
                </CardHeader>
                <CardFooter className="flex items-center justify-between">
                    <p className="text-lg font-bold text-primary">A partir de R${product.price.toFixed(2)}</p>
                    <Button onClick={handleAddToCart}>Adicionar</Button>
                </CardFooter>
            </Card>
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

    // First, group by category ID from product
    const grouped = activeProducts.reduce((acc, product) => {
      const categoryName = product.category || 'Outros';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(product);
      return acc;
    }, {} as { [key: string]: Product[] });
    
    // Sort categories based on the categories collection if available, otherwise alphabetically
     const sortedCategoryNames = Object.keys(grouped).sort((a, b) => {
        const catA = categories.find(c => c.name === a);
        const catB = categories.find(c => c.name === b);
        // Simple sort for now, can be extended with an order field
        if (catA && catB) return a.localeCompare(b);
        if (catA) return -1;
        if (catB) return 1;
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
        <header className="mb-12 text-center space-y-4">
             <Skeleton className="h-12 w-1/2 mx-auto" />
             <Skeleton className="h-6 w-3/4 mx-auto" />
        </header>
      ) : company ? (
        <header className="mb-12 text-center">
            {company.logoUrl && (
                <Image src={company.logoUrl} alt={`${company.name} logo`} width={96} height={96} className="mx-auto mb-4 rounded-full border-2 border-primary p-1" />
            )}
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{company.name}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{company.address}</p>
          {company.averagePrepTime && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1 text-sm">
                <Clock className="h-4 w-4 text-primary"/>
                <span>Preparo: ~{company.averagePrepTime} min</span>
            </div>
          )}
        </header>
      ) : (
         <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-destructive">Loja não encontrada.</h1>
            <p className="mt-3 text-lg text-muted-foreground">O link do cardápio pode estar incorreto.</p>
        </header>
      )}

      <div className="space-y-12">
        {isLoading ? (
            Object.keys(Array.from({length: 3})).map((key) => (
                <div key={key} className="space-y-8">
                    <Skeleton className="h-8 w-1/4" />
                    <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                       {Array.from({length: 4}).map((_, i) => (
                           <Card key={i}>
                               <Skeleton className="h-48 w-full" />
                               <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                               <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
                           </Card>
                       ))}
                    </div>
                </div>
            ))
        ) : Object.keys(productsByCategory).length > 0 ? (
          Object.entries(productsByCategory).map(([category, productList], idx) => (
            <section key={category}>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-8">{category}</h2>
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {productList.map((product, pIdx) => (
                  <ProductCard key={product.id} product={product} index={idx * 10 + pIdx} />
                ))}
              </div>
            </section>
          ))
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
