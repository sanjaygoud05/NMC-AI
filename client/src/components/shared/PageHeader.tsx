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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            {backButton}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              {description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-1.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && (
            <Button 
              onClick={action.onClick}
              className="gap-2 shrink-0 self-start sm:self-auto h-9 text-xs sm:text-sm"
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
