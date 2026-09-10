import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
    href?: string;
  };
  backButton?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ 
  title, 
  description, 
  action,
  backButton,
  children 
}: PageHeaderProps) {
  return (
    <div className="animate-fade-up opacity-0 [animation-fill-mode:forwards]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {backButton}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {description && (
                <p className="text-muted-foreground mt-2">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && (
            <Button 
              onClick={action.onClick}
              className="gap-2"
            >
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
