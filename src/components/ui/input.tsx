import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/class-names";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rendered before the input, e.g. `<Mail size={18} />` or `"$"`. Decorative only. */
  startIcon?: ReactNode;
  /** Rendered after the input. Decorative only; pass interactive elements with their own labels. */
  endIcon?: ReactNode;
  /** Extra classes for the wrapper rendered when an icon is present. */
  shellClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, endIcon, shellClassName, startIcon, ...props },
  ref,
) {
  const input = <input className={cn("field-input", className)} ref={ref} {...props} />;

  if (startIcon == null && endIcon == null) return input;

  return (
    <div className={cn("input-shell", shellClassName)}>
      {startIcon != null ? <span aria-hidden="true" className="input-icon">{startIcon}</span> : null}
      {input}
      {endIcon != null ? <span aria-hidden="true" className="input-icon">{endIcon}</span> : null}
    </div>
  );
});
