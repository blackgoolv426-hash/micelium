import React, { useState } from 'react';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (value: number) => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  decimals = 2,
  onChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const formatted =
    decimals === 0
      ? Math.round(value).toLocaleString('pt-BR')
      : value.toFixed(decimals);

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const parsed = parseFloat(draft.replace(',', '.'));
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="text-slate-300 font-medium truncate">{label}</label>
        {editing ? (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-20 px-1.5 py-0.5 text-right font-mono tabular-nums text-xs bg-slate-900 border border-cyan-500 rounded text-slate-100 outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={startEdit}
            onClick={startEdit}
            title="Clique para editar valor exato"
            className="font-mono tabular-nums text-slate-200 hover:text-cyan-400 transition-colors cursor-text shrink-0"
          >
            {formatted}
            {unit ? <span className="text-slate-500 ml-0.5">{unit}</span> : null}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full studio-slider"
      />
    </div>
  );
};
