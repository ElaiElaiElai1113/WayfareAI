import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-white/70 bg-white/65 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };

