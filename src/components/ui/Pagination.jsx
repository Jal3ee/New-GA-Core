import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable Minimalist Pagination Component
 * Follows @skill/design.md with clean typography, tabular numbers, and zero native browser selects.
 */
export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = ''
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endItem = Math.min(validPage * pageSize, totalItems);

  // Generate page numbers to display with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (validPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', validPage - 1, validPage, validPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  if (totalItems <= 0) return null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 text-xs ${className}`}>
      {/* Information & Page Size Quick Buttons (No native select!) */}
      <div className="flex flex-wrap items-center gap-2 text-[var(--muted-foreground)]">
        <span>
          Menampilkan <strong className="font-mono text-[var(--foreground)]">{startItem}–{endItem}</strong> dari <strong className="font-mono text-[var(--foreground)]">{totalItems}</strong> data
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-[var(--border)]">
            <span className="text-[11px] text-[var(--muted-foreground)]">Per hal:</span>
            <div className="flex items-center bg-[var(--muted)]/60 p-0.5 rounded-lg border border-[var(--border)]">
              {pageSizeOptions.map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onPageSizeChange(sz)}
                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-all ${
                    pageSize === sz
                      ? 'bg-[#0F5C56] text-white shadow-xs'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/50'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          type="button"
          disabled={validPage <= 1}
          onClick={() => onPageChange(validPage - 1)}
          className="p-1.5 rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-[var(--muted-foreground)] select-none">
                  ...
                </span>
              );
            }

            const isCurrent = p === validPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[30px] h-7 px-2 flex items-center justify-center rounded-xl text-xs font-mono font-medium transition-all active:scale-95 ${
                  isCurrent
                    ? 'bg-[#0F5C56] text-white font-bold shadow-xs'
                    : 'border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          disabled={validPage >= totalPages}
          onClick={() => onPageChange(validPage + 1)}
          className="p-1.5 rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          title="Halaman Berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
