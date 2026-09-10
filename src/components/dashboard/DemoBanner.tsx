import { useEffect } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const DEMO_TOAST_ID = 'demo-mode-banner';

export function useDemoBanner() {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Use a fixed ID to prevent duplicate toasts
      toast('Demo Mode', {
        id: DEMO_TOAST_ID,
        description: 'Viewing sample data. Remix this template to connect real data.',
        duration: Infinity,
        dismissible: true,
        closeButton: true,
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      // Dismiss the demo toast when leaving the Dashboard
      toast.dismiss(DEMO_TOAST_ID);
    };
  }, []);
}
