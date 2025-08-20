"use client";
import { ModelField } from '@/lib/falModels';

export function DynamicModelForm({
  fields,
  values,
  onChange,
}: {
  fields: ModelField[];
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.map((f) => {
        const val = values[f.key] ?? f.default ?? (f.type === 'number' ? 0 : f.type === 'boolean' ? false : '');
        if (f.type === 'text' || f.type === 'number') {
          return (
            <div key={f.key} className="space-y-1">
              <label className="text-sm font-medium">{f.label}</label>
              <input
                className="w-full border rounded px-3 py-2"
                type={f.type === 'number' ? 'number' : 'text'}
                min={f.min}
                max={f.max}
                step={f.step}
                value={val}
                onChange={(e) => onChange({ ...values, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
              />
            </div>
          );
        }
        if (f.type === 'boolean') {
          return (
            <div key={f.key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={!!val}
                onChange={(e) => onChange({ ...values, [f.key]: e.target.checked })}
              />
              <label className="text-sm">{f.label}</label>
            </div>
          );
        }
        // select
        return (
          <div key={f.key} className="space-y-1">
            <label className="text-sm font-medium">{f.label}</label>
            <select className="w-full border rounded px-3 py-2" value={val} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}


