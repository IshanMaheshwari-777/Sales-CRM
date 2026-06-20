// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

interface NumericRangeDropdownProps {
  label?: string;
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
  placeholder?: string;
  unit?: string;
}

export function NumericRangeDropdown({
  label,
  min,
  max,
  onChange,
  placeholder = 'Select range',
  unit = ''
}: NumericRangeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localMin, setLocalMin] = useState(min?.toString() || '');
  const [localMax, setLocalMax] = useState(max?.toString() || '');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openUpward } = useDropdownPosition(isOpen, dropdownRef, 200);

  useEffect(() => {
    setLocalMin(min?.toString() || '');
    setLocalMax(max?.toString() || '');
  }, [min, max]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyRange = () => {
    const minVal = localMin ? parseInt(localMin) : undefined;
    const maxVal = localMax ? parseInt(localMax) : undefined;
    onChange(minVal, maxVal);
    setIsOpen(false);
  };

  const clearRange = () => {
    setLocalMin('');
    setLocalMax('');
    onChange(undefined, undefined);
    setIsOpen(false);
  };

  const formatDisplayRange = () => {
    if (min === undefined && max === undefined) return null;
    if (min !== undefined && max !== undefined) {
      return `${min} - ${max}${unit}`;
    }
    if (min !== undefined) return `≥ ${min}${unit}`;
    if (max !== undefined) return `≤ ${max}${unit}`;
    return null;
  };

  const displayText = formatDisplayRange();

  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
        </label>
      )}

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer hover:border-orange-400 transition flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 flex-1">
          {displayText ? (
            <span className="text-sm text-slate-700">{displayText}</span>
          ) : (
            <span className="text-sm text-slate-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {displayText && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearRange();
              }}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className={`absolute z-[60] w-full bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden ${
          openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          <div className="p-4">
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">Min{unit && ` (${unit})`}</label>
                <input
                  type="number"
                  value={localMin}
                  onChange={(e) => setLocalMin(e.target.value)}
                  placeholder="Min"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <span className="text-slate-400 mt-5">-</span>
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">Max{unit && ` (${unit})`}</label>
                <input
                  type="number"
                  value={localMax}
                  onChange={(e) => setLocalMax(e.target.value)}
                  placeholder="Max"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-slate-200 flex gap-2">
            <button
              onClick={clearRange}
              className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
            >
              Clear
            </button>
            <button
              onClick={applyRange}
              className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
