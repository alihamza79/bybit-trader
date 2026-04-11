import { type ReactNode } from 'react';

type BadgeVariant = 'success' | 'danger' | 'muted' | 'primary';

type BadgeProps = {
  variant?: BadgeVariant;
  children: ReactNode;
};

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success border-success/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  muted: 'bg-muted/10 text-muted border-muted/20',
  primary: 'bg-primary/10 text-primary border-primary/20',
};

export function Badge({ variant = 'muted', children }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
