import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  /** Desktop sheet max-width class, e.g., "sm:max-w-[480px]" */
  className?: string;
  /** Header content to render instead of title/description */
  header?: React.ReactNode;
}

export function ResponsiveSheet({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
  header,
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[96vh] overflow-y-auto bg-background border-border">
          {header ? (
            header
          ) : (title || description) ? (
            <DrawerHeader className="text-left px-4 pt-4 pb-2">
              {title && <DrawerTitle className="text-lg">{title}</DrawerTitle>}
              {description && (
                <DrawerDescription>{description}</DrawerDescription>
              )}
            </DrawerHeader>
          ) : null}
          <div className="px-4 pb-8 overflow-y-auto">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('overflow-y-auto bg-background border-border', className)}>
        {header ? (
          header
        ) : (title || description) ? (
          <SheetHeader className="space-y-1 pb-4">
            {title && <SheetTitle className="text-lg">{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        ) : null}
        {children}
      </SheetContent>
    </Sheet>
  );
}

// Re-export header components for custom headers
export { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
export { DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
