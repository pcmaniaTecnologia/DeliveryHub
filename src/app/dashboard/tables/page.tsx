'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function TablesPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Comandas de Mesa</CardTitle>
            <CardDescription>
              Gerencie os pedidos feitos diretamente nas mesas do seu estabelecimento.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              Adicionar Mesa
           </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Em breve: gerenciamento de comandas de mesa.</p>
        </div>
      </CardContent>
    </Card>
  );
}
