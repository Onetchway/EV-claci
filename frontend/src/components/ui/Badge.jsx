import { STATUS_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function Badge({ label, status, className }) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colorClass, className)}>
      {label || status}
    </span>
  );
}
