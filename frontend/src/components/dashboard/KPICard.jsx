import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

export default function KPICard({ title, value, sub, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    border: 'border-red-100' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={cn('card p-5 border', c.border)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          {trend !== undefined && (
            <p className={cn('text-xs mt-1 flex items-center gap-1', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
              <TrendingUp className="w-3 h-3" />
              {trend >= 0 ? '+' : ''}{trend}% vs last period
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('p-2.5 rounded-xl', c.bg)}>
            <Icon className={cn('w-5 h-5', c.icon)} />
          </div>
        )}
      </div>
    </div>
  );
}
