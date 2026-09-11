import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AttentionItem {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
}

interface AttentionPanelProps {
  items: AttentionItem[];
  className?: string;
}

export function AttentionPanel({ items, className }: AttentionPanelProps) {
  const getIcon = (type: AttentionItem['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <Clock className="h-4 w-4" />;
      case 'info':
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getVariant = (type: AttentionItem['type']) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'info':
        return 'outline';
    }
  };

  return (
    <Card className={cn('border-border bg-card', className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Attention Required
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className={cn(
                'mt-0.5',
                item.type === 'critical' && 'text-destructive',
                item.type === 'warning' && 'text-amber-500',
                item.type === 'info' && 'text-blue-500'
              )}>
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.title}
                  </p>
                  <Badge variant={getVariant(item.type)} className="text-xs">
                    {item.count}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}