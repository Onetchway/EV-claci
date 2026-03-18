'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
        <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </p>
      <div className="flex items-center gap-1">
        <button disabled={page === 1} onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p = i + 1;
          if (totalPages > 5) {
            if (page <= 3) p = i + 1;
            else if (page >= totalPages - 2) p = totalPages - 4 + i;
            else p = page - 2 + i;
          }
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded text-sm font-medium ${p === page ? 'bg-brand-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
              {p}
            </button>
          );
        })}
        <button disabled={page === totalPages} onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
