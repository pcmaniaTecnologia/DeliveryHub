
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { MoreHorizontal, PlusCircle, Trash2, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useForm, useFieldArray, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, deleteDocument, updateDocument } from '@/firebase';
import { useImpersonation } from '@/context/impersonation-context';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const variantItemSchema = z.object({
  name: z.string().min(1, "O nome do item é obrigatório."),
  price: z.coerce.number().min(0, "O preço não pode ser negativo.").default(0),
});

const variantGroupSchema = z.object({
  name: z.string().min(1, "O nome do grupo é obrigatório."),
  min: z.coerce.number().int().min(0).default(0),
  max: z.coerce.number().int().min(1).default(1),
  items: z.array(variantItemSchema).min(1, "Adicione pelo menos um item ao grupo."),
});

const productFormSchema = z.object({
  name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  description: z.string().optional(),
  price: z.coerce.number().positive({ message: 'O preço deve ser um número positivo.' }),
  categoryId: z.string().min(1, { message: 'A categoria é obrigatória.' }),
  imageUrl: z.string().url({ message: 'Por favor, insira uma URL válida.' }).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  stockControlEnabled: z.boolean().default(false),
  stock: z.coerce.number().int().default(0),
  variants: z.array(variantGroupSchema).optional(),
  isSoldByWeight: z.boolean().default(false),
  replicateToCategory: z.boolean().default(false),
});


type VariantItem = z.infer<typeof variantItemSchema>;
type VariantGroup = z.infer<typeof variantGroupSchema>;

type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    categoryId: string;
    isActive: boolean;
    stockControlEnabled?: boolean;
    stock: number;
    imageUrls: string[];
    companyId: string;
    variants?: VariantGroup[];
    isSoldByWeight?: boolean;
    sortOrder?: number;
}

type Category = {
    id: string;
    name: string;
    companyId: string;
    sortOrder?: number;
}

export default function ProductsPage() {
  const { user, isUserLoading } = useUser();
  const { isImpersonating, impersonatedCompanyId } = useImpersonation();
  const firestore = useFirestore();
  const { toast } = useToast();
  const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema) as Resolver<z.infer<typeof productFormSchema>, any>,
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      categoryId: '',
      imageUrl: '',
      isActive: true,
      stockControlEnabled: false,
      stock: 0,
      variants: [],
      isSoldByWeight: false,
      replicateToCategory: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  useEffect(() => {
    if (editingProduct) {
      form.reset({
        name: editingProduct.name,
        description: editingProduct.description || '',
        price: editingProduct.price,
        categoryId: editingProduct.categoryId,
        isActive: editingProduct.isActive,
        stockControlEnabled: editingProduct.stockControlEnabled ?? false,
        stock: editingProduct.stock ?? 0,
        imageUrl: editingProduct.imageUrls?.[0] || '',
        variants: editingProduct.variants || [],
        isSoldByWeight: editingProduct.isSoldByWeight ?? false,
        replicateToCategory: false,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        price: 0,
        categoryId: '',
        imageUrl: '',
        isActive: true,
        stockControlEnabled: false,
        stock: 0,
        variants: [],
        isSoldByWeight: false,
        replicateToCategory: false,
      });
    }
  }, [editingProduct, form]);
  
  const productsRef = useMemoFirebase(() => {
    if (!firestore || !effectiveCompanyId) return null;
    return collection(firestore, `companies/${effectiveCompanyId}/products`);
  }, [firestore, effectiveCompanyId]);

  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  const categoriesRef = useMemoFirebase(() => {
      if (!firestore || !effectiveCompanyId) return null;
      return collection(firestore, `companies/${effectiveCompanyId}/categories`);
  }, [firestore, effectiveCompanyId]);

  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesRef);

  const onSubmit = async (values: z.infer<typeof productFormSchema>) => {
    if (!firestore || !effectiveCompanyId) return;
    setIsSaving(true);

    let finalImageUrl = values.imageUrl;

    if (finalImageUrl && (finalImageUrl.includes('photos.app.goo.gl') || finalImageUrl.includes('photos.google.com') || finalImageUrl.includes('drive.google.com'))) {
        try {
            const res = await fetch(`/api/extract-og-image?url=${encodeURIComponent(finalImageUrl)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.imageUrl) {
                    finalImageUrl = data.imageUrl;
                }
            } else {
                toast({ variant: 'destructive', title: 'Aviso sobre a Imagem', description: 'Não conseguimos ler a imagem deste link. Talvez o álbum seja privado.' });
            }
        } catch(e) {
            console.error('Error extracting image:', e);
        }
    }

    const productData = {
      ...values,
      imageUrl: finalImageUrl,
      companyId: effectiveCompanyId,
      imageUrls: finalImageUrl ? [finalImageUrl] : [],
    };
    
    let promise;
    if (editingProduct) {
      const productDocRef = doc(firestore, `companies/${effectiveCompanyId}/products/${editingProduct.id}`);
      promise = updateDocument(productDocRef, productData);
    } else {
        if (!productsRef) {
            setIsSaving(false);
            return;
        }
        promise = addDocument(productsRef, { 
            ...productData, 
            stock: 0, // Default stock
            sortOrder: Date.now(),
        });
    }

    promise.then(async () => {
        // Lógica de Replicação para Categoria (após criação ou edição)
        if (values.replicateToCategory && values.variants && values.variants.length > 0) {
            try {
                const q = query(
                    collection(firestore, `companies/${effectiveCompanyId}/products`),
                    where('categoryId', '==', values.categoryId)
                );
                const snapshot = await getDocs(q);
                const batch = writeBatch(firestore);
                
                snapshot.docs.forEach((productDoc) => {
                    // Na edição, não replicar para o próprio produto
                    if (!editingProduct || productDoc.id !== editingProduct.id) {
                        batch.update(productDoc.ref, { 
                            variants: values.variants 
                        });
                    }
                });
                
                await batch.commit();
                const replicatedCount = editingProduct ? snapshot.size - 1 : snapshot.size;
                
                if (replicatedCount > 0) {
                    toast({
                        title: 'Replicação Concluída!',
                        description: `Os grupos de opções foram replicados para ${replicatedCount} produto(s) desta categoria.`,
                    });
                }
            } catch (error) {
                console.error('Erro na replicação:', error);
                toast({
                    variant: 'destructive',
                    title: 'Erro na Replicação',
                    description: 'O produto foi salvo, mas houve erro ao replicar para outros produtos.',
                });
            }
        }

        toast({
            title: editingProduct ? 'Produto Atualizado!' : 'Produto Adicionado!',
            description: `${values.name} foi salvo com sucesso.`,
        });
        form.reset();
        setIsDialogOpen(false);
        setEditingProduct(null);
    }).catch(() => {
        toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar o produto.' });
    }).finally(() => {
        setIsSaving(false);
    });
  };

  const handleOpenDialog = (product: Product | null = null) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };
  
  const handleDeleteProduct = (productId: string) => {
    if (!firestore || !effectiveCompanyId) return;
    const productDocRef = doc(firestore, `companies/${effectiveCompanyId}/products/${productId}`);
    deleteDocument(productDocRef).then(() => {
        toast({
            title: 'Produto Excluído',
            description: 'O produto foi removido do seu catálogo.',
            variant: 'destructive'
        });
    });
  }

    const handleDuplicateProduct = (product: Product) => {
    if (!productsRef) return;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...productDataToCopy } = product;
    const duplicatedData = {
        ...productDataToCopy,
        name: `${product.name} (Cópia)`,
        sortOrder: Date.now(),
    };

    addDocument(productsRef, duplicatedData).then(() => {
        toast({
            title: 'Produto Duplicado!',
            description: `Uma cópia de "${product.name}" foi criada.`,
        });
    });
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
        toast({ variant: "destructive", title: "Nome da categoria é obrigatório." });
        return;
    }
    if (!effectiveCompanyId) {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível determinar a empresa." });
        return;
    }
    if (!categoriesRef) {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível acessar as categorias." });
        return;
    }
    addDocument(categoriesRef, { name: newCategoryName, companyId: effectiveCompanyId, sortOrder: Date.now() }).then(() => {
        toast({ title: "Categoria adicionada!" });
        setNewCategoryName('');
        setIsCategoryDialogOpen(false);
    }).catch((error) => {
        toast({ variant: "destructive", title: "Erro ao adicionar categoria", description: error.message });
    });
  };

  const isLoading = isUserLoading || isLoadingProducts || isLoadingCategories;

  const getProductImage = (product: Product): string | null => {
    return product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : null;
  };  
  const sortedCategoriesList = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        return a.name.localeCompare(b.name);
    });
  }, [categories]);

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map(cat => [cat.id, cat.name]));
  }, [categories]);

  const sortedAndFilteredProducts = useMemo(() => {
    if (!products) return [];
    
    const sortFn = (a: Product, b: Product) => {
        const catAIndex = sortedCategoriesList.findIndex(c => c.id === a.categoryId);
        const catBIndex = sortedCategoriesList.findIndex(c => c.id === b.categoryId);
        if (catAIndex !== catBIndex) return catAIndex - catBIndex;
        
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        return a.name.localeCompare(b.name);
    }
    
    let result = [...products].sort(sortFn);
    if (searchQuery.trim()) {
        result = result.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result;
  }, [products, searchQuery, sortedCategoriesList]);

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
      if (!firestore || !effectiveCompanyId || !sortedCategoriesList) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sortedCategoriesList.length) return;

      const currentCat = sortedCategoriesList[index];
      const targetCat = sortedCategoriesList[targetIndex];

      let currentOrder = currentCat.sortOrder !== undefined ? currentCat.sortOrder : index * 10;
      let targetOrder = targetCat.sortOrder !== undefined ? targetCat.sortOrder : targetIndex * 10;
      if (currentOrder === targetOrder) {
          targetOrder += (direction === 'up' ? -1 : 1);
      }

      const docRef1 = doc(firestore, `companies/${effectiveCompanyId}/categories/${currentCat.id}`);
      const docRef2 = doc(firestore, `companies/${effectiveCompanyId}/categories/${targetCat.id}`);

      Promise.all([
          updateDocument(docRef1, { sortOrder: targetOrder }),
          updateDocument(docRef2, { sortOrder: currentOrder })
      ]);
  };

  const handleMoveProduct = (product: Product, direction: 'up' | 'down') => {
      if (!firestore || !effectiveCompanyId || !products) return;
      const categoryProducts = products
        .filter(p => p.categoryId === product.categoryId)
        .sort((a, b) => {
            if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
            if (a.sortOrder !== undefined) return -1;
            if (b.sortOrder !== undefined) return 1;
            return a.name.localeCompare(b.name);
        });

      const index = categoryProducts.findIndex(p => p.id === product.id);
      if (index === -1) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= categoryProducts.length) return;

      const targetProduct = categoryProducts[targetIndex];
      let currentOrder = product.sortOrder !== undefined ? product.sortOrder : index * 10;
      let targetOrder = targetProduct.sortOrder !== undefined ? targetProduct.sortOrder : targetIndex * 10;
      if (currentOrder === targetOrder) {
          targetOrder += (direction === 'up' ? -1 : 1);
      }

      const docRef1 = doc(firestore, `companies/${effectiveCompanyId}/products/${product.id}`);
      const docRef2 = doc(firestore, `companies/${effectiveCompanyId}/products/${targetProduct.id}`);

      Promise.all([
          updateDocument(docRef1, { sortOrder: targetOrder }),
          updateDocument(docRef2, { sortOrder: currentOrder })
      ]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Gerencie seus produtos, variantes e categorias.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" variant="outline">Gerenciar Categorias</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gerenciar Categorias</DialogTitle>
                        <DialogDescription>Adicione ou remova categorias de produtos.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nome da nova categoria" />
                            <Button onClick={handleAddCategory}>Adicionar</Button>
                        </div>
                        <Separator />
                        <h4 className="font-medium">Categorias existentes</h4>
                        <div className="space-y-2">
                             {sortedCategoriesList?.map((cat, index) => (
                                <div key={cat.id} className="flex items-center justify-between p-2 border rounded-md">
                                    <span>{cat.name}</span>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleMoveCategory(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleMoveCategory(index, 'down')} disabled={index === sortedCategoriesList.length - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" disabled>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
           <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
              <PlusCircle className="h-4 w-4" />
              Adicionar Produto
           </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) setEditingProduct(null);
        }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Atualize os detalhes do produto.' : 'Preencha os detalhes do seu novo produto.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-grow overflow-y-auto pr-6 pl-1 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Cheeseburger Duplo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Pão, duas carnes, queijo, salada..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{form.watch('isSoldByWeight') ? 'Preço por Kg (R$)' : 'Preço Base (R$)'}</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" placeholder="29.90" {...field} />
                        </FormControl>
                          <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                      control={form.control}
                      name="isSoldByWeight"
                      render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
                              <div className="space-y-0.5">
                                  <FormLabel>Vendido por Peso</FormLabel>
                                  <FormDescription className="text-[10px]">
                                      O preço será calculado com base no peso (Kg).
                                  </FormDescription>
                              </div>
                              <FormControl>
                                  <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                  />
                              </FormControl>
                          </FormItem>
                      )}
                  />
                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma categoria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {categories?.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL ou Endereço da Imagem</FormLabel>
                      <FormControl>
                        <Input placeholder="https://exemplo.com/imagem.png" {...field} />
                      </FormControl>
                      <FormDescription>
                        Para usar imagem do <strong>Google Fotos</strong> ou da internet, clique na foto com o botão direito e escolha <strong>"Copiar endereço da imagem"</strong> e cole aqui.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Produto Ativo</FormLabel>
                        <DialogDescription>
                           Desmarque para esconder o produto do cardápio.
                        </DialogDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="stockControlEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-primary/5 border-primary/20">
                      <div className="space-y-0.5">
                        <FormLabel>Controle de Estoque</FormLabel>
                        <DialogDescription>
                           Ative para gerenciar a quantidade disponível deste produto.
                        </DialogDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('stockControlEnabled') && (
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade em Estoque</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} placeholder="Ex: 50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Grupos de Opções (Variantes)</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ name: '', min: 0, max: 1, items: [{ name: '', price: 0 }] })}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Adicionar Grupo
                    </Button>
                  </div>

                  {fields.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-4">
                              <FormField
                                  control={form.control}
                                  name="replicateToCategory"
                                  render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg p-0 space-x-3">
                                          <FormControl>
                                              <Switch
                                                  checked={field.value}
                                                  onCheckedChange={field.onChange}
                                              />
                                          </FormControl>
                                          <div className="space-y-0.5">
                                              <FormLabel className="text-orange-900 font-bold">Replicar para categoria</FormLabel>
                                              <FormDescription className="text-orange-700 text-xs">
                                                  {editingProduct 
                                                    ? "Ao salvar, estes grupos de opções serão copiados para TODOS os produtos da categoria selecionada."
                                                    : "Ao criar o produto, estes grupos de opções serão aplicados a TODOS os produtos existentes da categoria selecionada."
                                                  }
                                              </FormDescription>
                                          </div>
                                      </FormItem>
                                  )}
                              />
                          </div>
                      </div>
                  )}

                  {fields.map((field, groupIndex) => (
                    <Card key={field.id} className="p-4 bg-muted/50">
                      <div className="flex justify-between items-start mb-2">
                         <h4 className="font-semibold">Grupo de Opções</h4>
                         <Button type="button" variant="ghost" size="icon" onClick={() => remove(groupIndex)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <FormField
                          control={form.control}
                          name={`variants.${groupIndex}.name`}
                          render={({ field }) => (
                            <FormItem className="col-span-3">
                              <FormLabel>Nome do Grupo</FormLabel>
                              <FormControl><Input {...field} placeholder="Ex: Escolha sua bebida" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`variants.${groupIndex}.min`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mínimo</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`variants.${groupIndex}.max`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Máximo</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <VariantItemsArray groupIndex={groupIndex} control={form.control} />
                    </Card>
                  ))}
                </div>

                <DialogFooter className="sticky bottom-0 bg-background pt-4 z-10">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSaving}>Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Salvando...' : 'Salvar Produto'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar produto por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-[64px] sm:table-cell">
                <span className="sr-only">Image</span>
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead className="hidden md:table-cell">Estoque</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center">Carregando produtos...</TableCell>
              </TableRow>
            )}
            {!isLoading && sortedAndFilteredProducts.map((product) => {
              const imageUrl = getProductImage(product);
              return (
                <TableRow key={product.id}>
                  <TableCell className="hidden sm:table-cell">
                    {imageUrl ? (
                        <Image
                            alt={product.name}
                            className="aspect-square rounded-md object-cover"
                            height="64"
                            src={imageUrl}
                            width="64"
                            unoptimized
                        />
                    ) : (
                        <div className="h-16 w-16 bg-muted/50 rounded-md flex items-center justify-center text-[10px] text-muted-foreground border">
                            Sem Foto
                        </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant={!product.isActive ? 'outline' : 'default'}>
                      {product.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>R${product.price.toFixed(2)}</TableCell>
                  <TableCell className="hidden md:table-cell">{product.stock ?? 0}</TableCell>
                  <TableCell className="hidden md:table-cell">{categoryMap.get(product.categoryId) || 'Sem categoria'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button variant="ghost" size="icon" onClick={() => handleMoveProduct(product, 'up')} title="Mover para cima">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleMoveProduct(product, 'down')} title="Mover para baixo">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleOpenDialog(product)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>Duplicar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-destructive hover:bg-destructive/10 w-full">
                                Excluir
                            </div>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente o produto
                                do seu catálogo.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteProduct(product.id)} className="bg-destructive hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
             {!isLoading && sortedAndFilteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    {searchQuery ? `Nenhum produto encontrado para "${searchQuery}".` : 'Nenhum produto encontrado.'}
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>{sortedAndFilteredProducts.length}</strong> de <strong>{products?.length ?? 0}</strong> produtos
        </div>
      </CardFooter>
    </Card>
  );
}

function VariantItemsArray({ groupIndex, control }: { groupIndex: number; control: any }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `variants.${groupIndex}.items`,
  });

  return (
    <div className="pl-4 mt-3 space-y-2">
       <h5 className="text-sm font-medium">Itens da Opção</h5>
        {fields.map((item, itemIndex) => (
            <div key={item.id} className="flex items-end gap-2">
                <FormField
                    control={control}
                    name={`variants.${groupIndex}.items.${itemIndex}.name`}
                    render={({ field }) => (
                        <FormItem className="flex-grow">
                            <FormLabel className="sr-only">Nome do Item</FormLabel>
                            <FormControl><Input {...field} placeholder="Ex: Coca-Cola" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={`variants.${groupIndex}.items.${itemIndex}.price`}
                    render={({ field }) => (
                        <FormItem>
                             <FormLabel className="sr-only">Preço Adicional</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} placeholder="Preço Adicional" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <Button type="button" variant="ghost" size="icon" onClick={() => remove(itemIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>
        ))}
         <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => append({ name: '', price: 0 })}
        >
            Adicionar Item
        </Button>
    </div>
  )
}
