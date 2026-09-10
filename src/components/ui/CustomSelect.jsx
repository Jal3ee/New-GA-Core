import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ 
  value, 
  onChange, 
  options = [], 
  className = '',
  placeholder = 'Pilih salah satu...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Find selected label
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all shadow-sm active:scale-[0.99]"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 ml-2 text-[var(--muted-foreground)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top">
          <ul className="max-h-60 overflow-y-auto custom-scrollbar py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                      isSelected 
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' 
                        : 'text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
