import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * CustomSelect - Minimalist Modern Dropdown with Built-in Search
 * Follows @skill/design.md with smooth transitions, clean typography, and accessible keyboard navigation.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih...',
  icon: Icon,
  className = '',
  buttonClassName = '',
  disabled = false,
  label = null,
  searchable = true,
  searchPlaceholder = 'Cari opsi...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || null;

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(opt => 
      (opt.label && String(opt.label).toLowerCase().includes(q)) ||
      (opt.subtext && String(opt.subtext).toLowerCase().includes(q)) ||
      (opt.value && String(opt.value).toLowerCase().includes(q))
    );
  }, [options, searchTerm]);

  const shouldShowSearch = searchable && options.length > 5;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border transition-all duration-150 text-left ${
          disabled
            ? 'bg-[var(--muted)]/50 border-[var(--border)] text-[var(--muted-foreground)] cursor-not-allowed opacity-75'
            : isOpen
            ? 'bg-[var(--card)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30 text-[var(--foreground)] shadow-xs'
            : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]/50 text-[var(--foreground)] hover:bg-[var(--muted)]/30'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && <Icon className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--primary)]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl max-h-64 overflow-hidden flex flex-col backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100">
          
          {/* Search Header inside dropdown */}
          {shouldShowSearch && (
            <div className="p-2 border-b border-[var(--border)] bg-[var(--muted)]/30 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded-md text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchTerm('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto flex-1 py-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-[var(--muted-foreground)] text-center italic">
                {searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : 'Tidak ada opsi'}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onChange(opt.value, opt);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-semibold'
                        : 'text-[var(--foreground)] hover:bg-[var(--muted)]/60'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.subtext && (
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate mt-0.5">
                          {opt.subtext}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
