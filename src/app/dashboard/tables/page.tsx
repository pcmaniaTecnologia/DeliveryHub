'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function TablesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comandas de Mesa</CardTitle>
        <CardDescription>
          Gerencie os pedidos feitos diretamente nas mesas do seu estabelecimento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Em breve: gerenciamento de comandas de mesa.</p>
        </div>
      </CardContent>
    </Card>
  );
}
