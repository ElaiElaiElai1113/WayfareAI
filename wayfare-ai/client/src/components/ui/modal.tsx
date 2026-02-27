import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onOpenChange,
  title,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/35" />
        <Dialog.Content className={cn("fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-glass focus:outline-none") }>
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-xl font-semibold text-slate-800">{title}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-slate-600 hover:bg-slate-100"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

