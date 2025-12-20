
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, deleteDocument, updateDocument } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
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
  variants: z.array(variantGroupSchema).optional(),
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
    stock: number;
    imageUrls: string[];
    companyId: string;
    variants?: VariantGroup[];
}

type Category = {
    id: string;
    name: string;
    companyId: string;
}

export default function ProductsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      categoryId: '',
      imageUrl: '',
      isActive: true,
      variants: [],
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
        imageUrl: editingProduct.imageUrls?.[0] || '',
        variants: editingProduct.variants || [],
      });
    } else {
      form.reset({
        name: '',
        description: '',
        price: 0,
        categoryId: '',
        imageUrl: '',
        isActive: true,
        variants: [],
      });
    }
  }, [editingProduct, form]);
  
  const productsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `companies/${user.uid}/products`);
  }, [firestore, user]);

  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  const categoriesRef = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return collection(firestore, `companies/${user.uid}/categories`);
  }, [firestore, user]);

  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesRef);

  const onSubmit = async (values: z.infer<typeof productFormSchema>) => {
    if (!user || !firestore) return;

    const productData = {
      ...values,
      companyId: user.uid,
      imageUrls: values.imageUrl ? [values.imageUrl] : [],
    };
    
    try {
      if (editingProduct) {
        const productDocRef = doc(firestore, `companies/${user.uid}/products/${editingProduct.id}`);
        await updateDocument(productDocRef, productData);
        toast({
          title: 'Produto Atualizado!',
          description: `${values.name} foi atualizado com sucesso.`,
        });
      } else {
         if (!productsRef) return;
        await addDocument(productsRef, { 
            ...productData, 
            stock: 0, // Default stock
        });
        toast({
          title: 'Produto Adicionado!',
          description: `${values.name} foi adicionado ao seu catálogo.`,
        });
      }
      
      form.reset();
      setIsDialogOpen(false);
      setEditingProduct(null);
    } catch (error) {
       console.error("Failed to save product:", error);
       toast({
          variant: 'destructive',
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar o produto. Verifique suas permissões.',
       });
    }
  };

  const handleOpenDialog = (product: Product | null = null) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };
  
  const handleDeleteProduct = async (productId: string) => {
    if (!firestore || !user) return;
    const productDocRef = doc(firestore, `companies/${user.uid}/products/${productId}`);
    try {
      await deleteDocument(productDocRef);
      toast({
        title: 'Produto Excluído',
        description: 'O produto foi removido do seu catálogo.',
        variant: 'destructive'
      });
    } catch (error) {
       console.error("Failed to delete product:", error);
       toast({
          variant: 'destructive',
          title: 'Erro ao excluir',
          description: 'Não foi possível remover o produto.',
       });
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
        toast({ variant: "destructive", title: "Nome da categoria é obrigatório." });
        return;
    }
    if (!categoriesRef) return;
    try {
        await addDocument(categoriesRef, { name: newCategoryName, companyId: user?.uid });
        toast({ title: "Categoria adicionada!" });
        setNewCategoryName('');
        setIsCategoryDialogOpen(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Erro ao adicionar categoria." });
    }
  };

  const isLoading = isUserLoading || isLoadingProducts || isLoadingCategories;

  const getProductImage = (product: Product, index: number): ImagePlaceholder => {
    const imageUrl = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : '';
    if (imageUrl) {
      return {
        id: product.id,
        imageUrl: imageUrl,
        imageHint: 'product image',
        description: product.name,
      };
    }
    const defaultPlaceholder = {
      id: 'default',
      imageUrl: `https://picsum.photos/seed/${product.id}/64/64`,
      imageHint: 'food placeholder',
      description: 'Default product image',
    };
    const placeholders = PlaceHolderImages.filter(p => p.id.startsWith('product-'));
    if (placeholders.length === 0) return defaultPlaceholder;
    return placeholders[index % placeholders.length] ?? defaultPlaceholder;
  };
  
  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map(cat => [cat.id, cat.name]));
  }, [categories]);

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
                            {categories?.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-2 border rounded-md">
                                    <span>{cat.name}</span>
                                    <Button variant="ghost" size="icon" disabled>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
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
                        <FormLabel>Preço Base (R$)</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" placeholder="29.90" {...field} />
                        </FormControl>
                          <FormMessage />
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
                      <FormLabel>URL da Imagem</FormLabel>
                      <FormControl>
                        <Input placeholder="https://exemplo.com/imagem.png" {...field} />
                      </FormControl>
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
                <Separator />
                <div>
                  <h3 className="text-lg font-medium mb-2">Variantes (Opcionais)</h3>
                  <div className="space-y-4">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ name: '', min: 1, max: 1, items: [{ name: '', price: 0 }] })}
                    >
                      Adicionar Grupo de Opções
                    </Button>
                  </div>
                </div>

                <DialogFooter className="sticky bottom-0 bg-background pt-4 z-10">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button type="submit">Salvar Produto</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
            {!isLoading && products?.map((product, index) => {
              const imagePlaceholder = getProductImage(product, index);
              return (
                <TableRow key={product.id}>
                  <TableCell className="hidden sm:table-cell">
                    {imagePlaceholder && <Image
                      alt={product.name}
                      className="aspect-square rounded-md object-cover"
                      height="64"
                      src={imagePlaceholder.imageUrl}
                      width="64"
                      data-ai-hint={imagePlaceholder.imageHint}
                      unoptimized // Use unoptimized for external URLs
                    />}
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
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
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
                  </TableCell>
                </TableRow>
              )
            })}
             {!isLoading && products?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Nenhum produto encontrado.</TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>{products?.length ?? 0}</strong> de <strong>{products?.length ?? 0}</strong> produtos
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
