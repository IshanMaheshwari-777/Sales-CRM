// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface Option {
  value: string;
  label: string;
  color?: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  loading?: boolean;
}

export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  label,
  loading = false
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openUpward, maxHeight } = useDropdownPosition(isOpen, dropdownRef, 320);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    onChange(filteredOptions.map(opt => opt.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const removeItem = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== value));
  };

  const getSelectedLabels = () => {
    return options.filter(opt => selected.includes(opt.value));
  };

  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
        </label>
      )}

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer hover:border-orange-400 transition flex items-center justify-between gap-2"
      >
        <div className="flex-1 flex flex-wrap gap-1.5">
          {selected.length === 0 ? (
            <span className="text-slate-400 text-sm">{placeholder}</span>
          ) : (
            getSelectedLabels().map(item => (
              <span
                key={item.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-sm font-medium"
                style={item.color ? { backgroundColor: `${item.color}20`, color: item.color } : {}}
              >
                {item.label}
                <button
                  onClick={(e) => removeItem(item.value, e)}
                  className="hover:bg-orange-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div
          className={`absolute z-[60] w-full bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="p-2 border-b border-slate-200 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectAll();
              }}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="text-xs text-slate-600 hover:text-slate-700 font-medium"
            >
              Clear All
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: `${maxHeight - 120}px` }}>
            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent mx-auto"></div>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No options found
              </div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(option.value);
                  }}
                  className="px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    {option.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <span className="text-sm text-slate-700">{option.label}</span>
                  </div>
                  {selected.includes(option.value) && (
                    <Check className="w-4 h-4 text-orange-600" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
