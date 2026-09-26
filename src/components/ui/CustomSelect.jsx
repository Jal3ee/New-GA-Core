import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * CustomSelect - Best-in-Class Searchable Dropdown with Keyboard Navigation & Micro-Interactions
 * Follows @skill/design.md tokens (Teal #0F5C56, Brass #C4841F, Ledger #101514/#F7F9F8)
 * Features:
 * - Instant live fuzzy search
 * - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Esc)
 * - Auto-scroll active item into view
 * - Item count indicator
 * - Micro-animation on click & transitions
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
  searchPlaceholder = 'Ketik untuk mencari...',
  menuClassName = '',
  maxHeight = 'max-h-72'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

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

  const selectedOption = useMemo(() => {
    return options.find(opt => String(opt.value) === String(value)) || null;
  }, [options, value]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(opt => 
      (opt.label && String(opt.label).toLowerCase().includes(q)) ||
      (opt.subtext && String(opt.subtext).toLowerCase().includes(q)) ||
      (opt.category && String(opt.category).toLowerCase().includes(q)) ||
      (opt.value && String(opt.value).toLowerCase().includes(q))
    );
  }, [options, searchTerm]);

  const shouldShowSearch = searchable && options.length > 4;

  // Reset active index when filtered options change
  useEffect(() => {
    setActiveIndex(0);
  }, [filteredOptions]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      if (selectedOption) {
        const idx = filteredOptions.findIndex(o => String(o.value) === String(selectedOption.value));
        if (idx >= 0) setActiveIndex(idx);
      }
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 40);
    }
  }, [isOpen]);

  // Keyboard navigation handler
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setActiveIndex(prev => {
          const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          scrollToIndex(next);
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setActiveIndex(prev => {
          const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          scrollToIndex(next);
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && activeIndex >= 0 && activeIndex < filteredOptions.length) {
        const chosen = filteredOptions[activeIndex];
        onChange(chosen.value, chosen);
        setIsOpen(false);
      }
    }
  };

  const scrollToIndex = (index) => {
    if (optionsListRef.current) {
      const items = optionsListRef.current.querySelectorAll('[data-select-option]');
      if (items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const handleSelect = (opt) => {
    onChange(opt.value, opt);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl border transition-all duration-150 text-left active:scale-[0.99] select-none ${
          disabled
            ? 'bg-[var(--muted)]/50 border-[var(--border)] text-[var(--muted-foreground)] cursor-not-allowed opacity-75'
            : isOpen
            ? 'bg-[var(--card)] border-[#0F5C56] ring-2 ring-[#0F5C56]/20 text-[var(--foreground)] shadow-sm'
            : 'bg-[var(--card)] border-[var(--border)] hover:border-[#0F5C56]/50 text-[var(--foreground)] hover:bg-[var(--muted)]/20 shadow-xs'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#0F5C56] shrink-0" />}
          <span className={`truncate font-medium ${selectedOption ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          <ChevronDown
            className={`w-3.5 h-3.5 text-[var(--muted-foreground)] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#0F5C56]' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div 
          className={`absolute z-50 left-0 right-0 mt-1.5 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl ${maxHeight} overflow-hidden flex flex-col backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100 ${menuClassName}`}
        >
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
                  className="w-full pl-8 pr-16 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm('');
                        searchInputRef.current?.focus();
                      }}
                      className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
                    {filteredOptions.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Options List */}
          <div 
            ref={optionsListRef} 
            className="overflow-y-auto flex-1 py-1 custom-scrollbar"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-xs text-[var(--muted-foreground)] text-center">
                <p className="font-medium text-[var(--foreground)]">Tidak ada hasil cocok</p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  Kata kunci "{searchTerm}" tidak ditemukan.
                </p>
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isActive = idx === activeIndex;

                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    data-select-option
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors relative ${
                      isSelected
                        ? 'bg-[#0F5C56]/10 text-[#0F5C56] font-semibold'
                        : isActive
                        ? 'bg-[var(--muted)]/70 text-[var(--foreground)]'
                        : 'text-[var(--foreground)] hover:bg-[var(--muted)]/50'
                    }`}
                  >
                    {/* Left Accent indicator when selected */}
                    {isSelected && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#0F5C56] rounded-r" />
                    )}

                    <div className="flex flex-col truncate pr-2 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtext && (
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate mt-0.5">
                          {opt.subtext}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.extra && (
                        <span className="text-[11px] font-mono font-medium text-[var(--muted-foreground)]">
                          {opt.extra}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#0F5C56] shrink-0" />
                      )}
                    </div>
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
