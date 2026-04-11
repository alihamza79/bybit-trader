import { type ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps): React.JSX.Element {
  return (
    <div className={`rounded-xl border border-card-border bg-card p-6 ${className}`}>
      {children}
    </div>
  );
}
