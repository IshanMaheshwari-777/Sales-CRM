// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface CascadingOption {
  value: string;
  label: string;
  color?: string;
  children?: CascadingOption[];
}

interface CascadingDropdownProps {
  options: CascadingOption[];
  selectedParents: string[];
  selectedChildren: string[];
  onChangeParents: (selected: string[]) => void;
  onChangeChildren: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  parentLabel?: string;
  childLabel?: string;
}

export function CascadingDropdown({
  options,
  selectedParents,
  selectedChildren,
  onChangeParents,
  onChangeChildren,
  placeholder = 'Select...',
  label,
  parentLabel = 'Parent',
  childLabel = 'Child'
}: CascadingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openUpward, maxHeight } = useDropdownPosition(isOpen, dropdownRef, 384);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleParent = (value: string) => {
    if (selectedParents.includes(value)) {
      onChangeParents(selectedParents.filter(v => v !== value));
      const option = options.find(opt => opt.value === value);
      if (option?.children) {
        const childValues = option.children.map(c => c.value);
        onChangeChildren(selectedChildren.filter(v => !childValues.includes(v)));
      }
    } else {
      onChangeParents([...selectedParents, value]);
    }
  };

  const toggleChild = (parentValue: string, childValue: string) => {
    if (selectedChildren.includes(childValue)) {
      onChangeChildren(selectedChildren.filter(v => v !== childValue));
    } else {
      if (!selectedParents.includes(parentValue)) {
        onChangeParents([...selectedParents, parentValue]);
      }
      onChangeChildren([...selectedChildren, childValue]);
    }
  };

  const clearAll = () => {
    onChangeParents([]);
    onChangeChildren([]);
  };

  const getSelectedLabels = () => {
    const labels: string[] = [];

    selectedParents.forEach(parentVal => {
      const parent = options.find(opt => opt.value === parentVal);
      if (parent) {
        const childrenForParent = selectedChildren.filter(childVal =>
          parent.children?.some(c => c.value === childVal)
        );

        if (childrenForParent.length > 0) {
          childrenForParent.forEach(childVal => {
            const child = parent.children?.find(c => c.value === childVal);
            if (child) {
              labels.push(`${parent.label} → ${child.label}`);
            }
          });
        } else {
          labels.push(parent.label);
        }
      }
    });

    return labels;
  };

  const removeItem = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const labels = getSelectedLabels();
    const removed = labels[index];

    if (removed.includes('→')) {
      const [parentLabel, childLabel] = removed.split('→').map(s => s.trim());
      const parent = options.find(opt => opt.label === parentLabel);
      const child = parent?.children?.find(c => c.label === childLabel);
      if (child) {
        onChangeChildren(selectedChildren.filter(v => v !== child.value));
      }
    } else {
      const parent = options.find(opt => opt.label === removed);
      if (parent) {
        onChangeParents(selectedParents.filter(v => v !== parent.value));
        if (parent.children) {
          const childValues = parent.children.map(c => c.value);
          onChangeChildren(selectedChildren.filter(v => !childValues.includes(v)));
        }
      }
    }
  };

  const selectedLabels = getSelectedLabels();

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
          {selectedLabels.length === 0 ? (
            <span className="text-slate-400 text-sm">{placeholder}</span>
          ) : (
            selectedLabels.map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-sm font-medium"
              >
                {label}
                <button
                  onClick={(e) => removeItem(index, e)}
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
          <div className="p-2 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-medium text-slate-600">{parentLabel} & {childLabel}</span>
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

          <div className="overflow-y-auto" style={{ maxHeight: `${maxHeight - 50}px` }}>
            {options.map(parent => (
              <div key={parent.value} className="border-b border-slate-100 last:border-0">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleParent(parent.value);
                  }}
                  className="px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    {parent.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: parent.color }}
                      />
                    )}
                    <span className="text-sm font-medium text-slate-700">{parent.label}</span>
                  </div>
                  {selectedParents.includes(parent.value) && !parent.children?.some(c => selectedChildren.includes(c.value)) && (
                    <Check className="w-4 h-4 text-orange-600" />
                  )}
                </div>

                {parent.children && parent.children.length > 0 && (
                  <div className="bg-white">
                    {parent.children.map(child => (
                      <div
                        key={child.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChild(parent.value, child.value);
                        }}
                        className="px-6 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-600">{child.label}</span>
                        {selectedChildren.includes(child.value) && (
                          <Check className="w-4 h-4 text-orange-600" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
