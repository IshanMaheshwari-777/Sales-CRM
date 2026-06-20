// @ts-nocheck
import { useState, useEffect } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { getFieldDescription } from '../../lib/csvUtils';

interface ColumnMapperProps {
  csvHeaders: string[];
  initialMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export default function ColumnMapper({
  csvHeaders,
  initialMapping,
  onMappingChange,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const systemFields = [
    { name: 'mobile_number', label: 'Mobile Number', required: true, category: 'Required' },
    { name: 'first_name', label: 'First Name', required: true, category: 'Personal' },
    { name: 'last_name', label: 'Last Name', required: false, category: 'Personal' },
    { name: 'email', label: 'Email', required: true, category: 'Personal' },
    { name: 'university', label: 'University', required: false, category: 'Academic' },
    { name: 'course', label: 'Course', required: false, category: 'Academic' },
    { name: 'specialization', label: 'Specialization', required: false, category: 'Academic' },
    { name: 'city', label: 'City', required: false, category: 'Address' },
    { name: 'country', label: 'Country', required: false, category: 'Address' },
    { name: 'channel', label: 'Channel', required: true, category: 'Source Tracking' },
    { name: 'source', label: 'Source', required: true, category: 'Source Tracking' },
    { name: 'campaign_name', label: 'Campaign Name', required: true, category: 'Source Tracking' },
  ];

  const categories = [
    'Required',
    'Personal',
    'Academic',
    'Address',
    'Source Tracking',
  ];

  const handleMappingChange = (systemField: string, csvHeader: string) => {
    const newMapping = { ...mapping };
    if (csvHeader === '') {
      delete newMapping[systemField];
    } else {
      newMapping[systemField] = csvHeader;
    }
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  const getUnmappedHeaders = () => {
    const mappedHeaders = new Set(Object.values(mapping));
    return csvHeaders.filter((header) => !mappedHeaders.has(header));
  };

  const getMappedCount = (category: string) => {
    const fieldsInCategory = systemFields.filter((f) => f.category === category);
    const mappedFields = fieldsInCategory.filter((f) => mapping[f.name]);
    return `${mappedFields.length}/${fieldsInCategory.length}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Map your CSV columns to system fields</p>
            <p className="text-blue-700">
              Match each CSV column header with the corresponding field in our system. Required
              fields must be mapped to continue.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((category) => {
          const fieldsInCategory = systemFields.filter((f) => f.category === category);

          return (
            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">{category}</h4>
                  <span className="text-sm text-gray-600">{getMappedCount(category)} mapped</span>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {fieldsInCategory.map((field) => (
                  <div key={field.name} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="font-medium text-gray-900">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedField(expandedField === field.name ? null : field.name)
                            }
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>

                        {expandedField === field.name && (
                          <div className="mb-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {getFieldDescription(field.name)}
                          </div>
                        )}

                        <div className="relative">
                          <select
                            value={mapping[field.name] || ''}
                            onChange={(e) => handleMappingChange(field.name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg appearance-none pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              field.required && !mapping[field.name]
                                ? 'border-red-300 bg-red-50'
                                : mapping[field.name]
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            <option value="">-- Not Mapped --</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>

                        {field.required && !mapping[field.name] && (
                          <p className="mt-1 text-sm text-red-600">This field is required</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {getUnmappedHeaders().length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-2">Unmapped Columns</h4>
          <p className="text-sm text-yellow-700 mb-2">
            The following columns from your CSV won't be imported:
          </p>
          <div className="flex flex-wrap gap-2">
            {getUnmappedHeaders().map((header) => (
              <span
                key={header}
                className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded"
              >
                {header}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
