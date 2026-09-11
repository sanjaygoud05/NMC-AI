import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand={true}
      visibleToasts={5}
      closeButton={true}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:shadow-lg !rounded-none !pr-10",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground !rounded-none",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground !rounded-none",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
