// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

interface DateRangePickerProps {
  label?: string;
  fromDate?: string;
  toDate?: string;
  onChange: (fromDate?: string, toDate?: string) => void;
  placeholder?: string;
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
];

export function DateRangePicker({
  label,
  fromDate,
  toDate,
  onChange,
  placeholder = 'Select date range'
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(fromDate || '');
  const [localTo, setLocalTo] = useState(toDate || '');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openUpward } = useDropdownPosition(isOpen, dropdownRef, 380);

  useEffect(() => {
    setLocalFrom(fromDate || '');
    setLocalTo(toDate || '');
  }, [fromDate, toDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    setLocalFrom(fromStr);
    setLocalTo(toStr);
    onChange(fromStr, toStr);
    setIsOpen(false);
  };

  const applyCustomRange = () => {
    onChange(localFrom || undefined, localTo || undefined);
    setIsOpen(false);
  };

  const clearRange = () => {
    setLocalFrom('');
    setLocalTo('');
    onChange(undefined, undefined);
    setIsOpen(false);
  };

  const formatDisplayDate = () => {
    if (!fromDate && !toDate) return null;
    if (fromDate && toDate) {
      return `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`;
    }
    if (fromDate) return `From ${new Date(fromDate).toLocaleDateString()}`;
    if (toDate) return `To ${new Date(toDate).toLocaleDateString()}`;
    return null;
  };

  const displayText = formatDisplayDate();

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
          <Calendar className="w-4 h-4 text-slate-400" />
          {displayText ? (
            <span className="text-sm text-slate-700">{displayText}</span>
          ) : (
            <span className="text-sm text-slate-400">{placeholder}</span>
          )}
        </div>
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
      </div>

      {isOpen && (
        <div className={`absolute z-[60] w-full bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden min-w-[320px] ${
          openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          <div className="p-3 border-b border-slate-200">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Quick Select</h4>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset.days)}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 rounded-lg font-medium transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Custom Range</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">From</label>
                <input
                  type="date"
                  value={localFrom}
                  onChange={(e) => setLocalFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">To</label>
                <input
                  type="date"
                  value={localTo}
                  onChange={(e) => setLocalTo(e.target.value)}
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
              onClick={applyCustomRange}
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
