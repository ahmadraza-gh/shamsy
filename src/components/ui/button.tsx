import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

export type ButtonVariant = "primary" | "secondary" | "danger-ghost" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: ButtonVariant;
}

export interface ButtonStyleOptions {
  className?: string;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "button button-primary",
  secondary: "button button-secondary",
  "danger-ghost": "button button-danger-ghost",
  icon: "icon-button",
};

export function buttonClassName({
  className,
  variant = "primary",
}: ButtonStyleOptions = {}): string {
  return cn(variantClasses[variant], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    "aria-busy": ariaBusy,
    className,
    disabled,
    loading = false,
    type = "button",
    variant = "primary",
    ...props
  },
  ref,
) {
  return (
    <button
      aria-busy={loading || ariaBusy || undefined}
      className={buttonClassName({ className, variant })}
      disabled={disabled || loading}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
