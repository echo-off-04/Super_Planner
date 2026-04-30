import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export interface ChoiceAction {
  key: string;
  label: string;
  description?: string;
  variant?: ButtonVariant;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions: ChoiceAction[];
  orientation?: "horizontal" | "vertical";
}

export function ChoiceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  orientation = "vertical",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="space-y-3">{children}</div>}
        <DialogFooter
          className={
            orientation === "vertical"
              ? "flex-col gap-2 sm:flex-col sm:space-x-0"
              : "flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          }
        >
          {actions.map((action) => (
            <div key={action.key} className="flex flex-col gap-1">
              <Button
                variant={action.variant ?? "default"}
                onClick={() => action.onSelect()}
                disabled={action.disabled}
                className={orientation === "vertical" ? "w-full" : undefined}
              >
                {action.label}
              </Button>
              {action.description && (
                <p className="text-xs text-muted-foreground px-1">
                  {action.description}
                </p>
              )}
            </div>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
