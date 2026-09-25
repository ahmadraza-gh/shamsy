import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input className={cn("field-input", className)} ref={ref} {...props} />;
});
