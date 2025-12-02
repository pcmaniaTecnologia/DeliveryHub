
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, deleteDocument, setDocument, updateDocument } from '@/firebase';
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
} from "@/components/ui/alert-dialog"

type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    isActive: boolean;
    stock: number;
    imageUrls: string[];
    companyId: string;
    imageUrl?: string;
}

const productFormSchema = z.object({
  name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  description: z.string().optional(),
  price: z.coerce.number().positive({ message: 'O preço deve ser um número positivo.' }),
  category: z.string().min(2, { message: 'A categoria é obrigatória.' }),
  imageUrl: z.string().url({ message: 'Por favor, insira uma URL válida.' }).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

export default function ProductsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      category: '',
      imageUrl: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (editingProduct) {
      form.reset({
        name: editingProduct.name,
        description: editingProduct.description || '',
        price: editingProduct.price,
        category: editingProduct.category,
        isActive: editingProduct.isActive,
        imageUrl: editingProduct.imageUrl || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        price: 0,
        category: '',
        imageUrl: '',
        isActive: true,
      });
    }
  }, [editingProduct, form]);
  
  const productsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `companies/${user.uid}/products`);
  }, [firestore, user]);

  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  const onSubmit = async (values: z.infer<typeof productFormSchema>) => {
    if (!user || !firestore) return;

    const productData = {
      name: values.name,
      description: values.description || '',
      price: values.price,
      category: values.category,
      isActive: values.isActive,
      imageUrl: values.imageUrl || '',
      companyId: user.uid,
    };
    
    try {
      if (editingProduct) {
        const productDocRef = doc(firestore, `companies/${user.uid}/products/${editingProduct.id}`);
        await updateDocument(productDocRef, {
            ...productData,
            imageUrls: values.imageUrl ? [values.imageUrl] : [],
        });
        toast({
          title: 'Produto Atualizado!',
          description: `${values.name} foi atualizado com sucesso.`,
        });
      } else {
         if (!productsRef) return;
        await addDocument(productsRef, { 
            ...productData, 
            stock: 0,
            imageUrls: values.imageUrl ? [values.imageUrl] : [],
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

  const isLoading = isUserLoading || isLoadingProducts;

  const getProductImage = (product: Product, index: number): ImagePlaceholder => {
    const imageUrl = product.imageUrl || (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : '');
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Gerencie seus produtos, variantes e categorias.</CardDescription>
          </div>
           <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
              <PlusCircle className="h-4 w-4" />
              Adicionar Produto
           </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) setEditingProduct(null);
        }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Atualize os detalhes do produto.' : 'Preencha os detalhes do seu novo produto.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Cheeseburger Duplo" className="col-span-3" {...field} />
                      </FormControl>
                      <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Pão, duas carnes, queijo, salada..." className="col-span-3" {...field} />
                      </FormControl>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Preço (R$)</FormLabel>
                      <FormControl>
                          <Input type="number" step="0.01" placeholder="29.90" className="col-span-3" {...field} />
                      </FormControl>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                    </FormItem>
                  )}
                />
                  <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Categoria</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Hambúrgueres" className="col-span-3" {...field} />
                      </FormControl>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">URL da Imagem</FormLabel>
                      <FormControl>
                        <Input placeholder="https://exemplo.com/imagem.png" className="col-span-3" {...field} />
                      </FormControl>
                      <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Produto Ativo</FormLabel>
                        <FormControl>
                          <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="col-span-3"
                          />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
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
                  <TableCell className="hidden md:table-cell">{product.category}</TableCell>
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
