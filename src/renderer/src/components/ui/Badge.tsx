import React from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const variants: Record<Variant, string> = {
  default: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-primary/10 text-primary',
  muted: 'bg-gray-100 text-gray-500',
};

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export default function Badge({ children, variant = 'default', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, Variant> = {
    PENDING: 'warning',
    PAID: 'success',
    CONFIRMED: 'info',
    IN_PRODUCTION: 'info',
    READY: 'success',
    DELIVERED: 'success',
    CANCELLED: 'danger',
    SCHEDULED: 'warning',
    IN_TRANSIT: 'info',
    RETURNED: 'muted',
    PRESENT: 'success',
    ABSENT: 'danger',
    HALF_DAY: 'warning',
    LEAVE: 'muted',
    GRADE_A: 'success',
    GRADE_B: 'warning',
    REJECT: 'danger',
  };
  return map[status] || 'default';
}
