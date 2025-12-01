import Image from 'next/image';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const products = [
  { id: 'PROD001', name: 'Cheeseburger Clássico', status: 'Ativo', price: 'R$25,50', stock: 50, category: 'Hambúrgueres' },
  { id: 'PROD002', name: 'Pizza Margherita', status: 'Ativo', price: 'R$45,00', stock: 30, category: 'Pizzas' },
  { id: 'PROD003', name: 'Salada Caesar', status: 'Inativo', price: 'R$35,75', stock: 0, category: 'Saladas' },
  { id: 'PROD004', name: 'Sushi de Salmão (8pçs)', status: 'Ativo', price: 'R$28,00', stock: 100, category: 'Japonês' },
  { id: 'PROD005', name: 'Spaghetti Carbonara', status: 'Ativo', price: 'R$55,90', stock: 45, category: 'Massas' },
];

export default function ProductsPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Gerencie seus produtos, variantes e categorias.</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Adicionar Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Produto</DialogTitle>
                <DialogDescription>Preencha os detalhes do seu novo produto.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nome</Label>
                  <Input id="name" placeholder="Ex: Cheeseburger Duplo" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">Descrição</Label>
                  <Textarea id="description" placeholder="Pão, duas carnes, queijo, salada..." className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="price" className="text-right">Preço</Label>
                  <Input id="price" type="number" placeholder="29.90" className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">Categoria</Label>
                  <Input id="category" placeholder="Ex: Hambúrgueres" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="picture" className="text-right">Imagens</Label>
                  <Input id="picture" type="file" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="active" className="text-right">Produto Ativo</Label>
                  <Switch id="active" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar Produto</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-[100px] sm:table-cell">
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
            {products.map((product, index) => {
              const imagePlaceholder = PlaceHolderImages.find(p => p.id === `product-${index + 1}`);
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
                    />}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'Inativo' ? 'outline' : 'default'}>{product.status}</Badge>
                  </TableCell>
                  <TableCell>{product.price}</TableCell>
                  <TableCell className="hidden md:table-cell">{product.stock}</TableCell>
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
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>1-5</strong> de <strong>{products.length}</strong> produtos
        </div>
      </CardFooter>
    </Card>
  );
}
