import React from 'react';
import { Film } from 'lucide-react';

interface TopBarProps {
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenExport }) => {
  return (
    <header className="h-14 shrink-0 border-b border-slate-800/90 bg-[#0A0D14] px-6 flex items-center justify-between gap-4">
      <a
        href="#top"
        onClick={(e) => e.preventDefault()}
        className="text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
      >
        Micélio Studio
      </a>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Film className="w-3.5 h-3.5" />
          <span>Renderizar Vídeo</span>
        </button>
      </div>
    </header>
  );
};
