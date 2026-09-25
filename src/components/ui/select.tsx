import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  return <select className={cn("field-select", className)} ref={ref} {...props} />;
});
