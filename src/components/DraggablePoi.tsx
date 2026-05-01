import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronRight } from 'lucide-react';
import { POI } from '../data';
import { formatDuration } from '../useItineraryState';
import { translate } from '../utils/bilingualUtils';

interface DraggablePoiProps {
  poi: POI;
  lang: string;
  onSelect: (p: POI) => void;
  onHover?: (id: string | null) => void;
  theme: 'dark' | 'light';
}

export const DraggablePoi: React.FC<DraggablePoiProps> = ({ poi, lang, onSelect, onHover, theme }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${poi.id}`,
    data: poi,
  });

  const catColors: Record<string, string> = {
    Sightseeing: 'text-sky-400',
    Activity: 'text-emerald-400',
    Food: 'text-amber-400',
    Transport: 'text-slate-400',
    Special: 'text-orange-400',
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => onHover?.(poi.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`p-4 rounded-[2rem] border-2 cursor-grab active:cursor-grabbing transition-all shadow-sm ${
        theme === 'dark' 
          ? 'bg-white/[0.03] border-white/5 text-white hover:bg-white/[0.08] hover:border-emerald-500/20' 
          : 'bg-white border-slate-100 text-slate-900 hover:bg-emerald-50 hover:border-emerald-200'
      } ${isDragging ? 'opacity-40 ring-2 ring-emerald-500' : ''}`}
    >
      <img src={poi.imageUrl} className="w-16 h-16 rounded-[1.25rem] object-cover shadow-2xl pointer-events-none flex-shrink-0" alt="" referrerPolicy="no-referrer" />
      <div className="flex-1 min-w-0 py-1 pointer-events-none text-left">
        <h4 className={`text-sm font-black leading-tight truncate uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{translate(poi.title, lang)}</h4>
        <div className="flex items-center gap-2 mt-1">
          <p className={`text-[10px] font-black uppercase tracking-tighter ${catColors[poi.category] ?? 'text-slate-400'}`}>{poi.category}</p>
          <span className={`w-1 h-1 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
          <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{formatDuration(poi.duration)}</p>
        </div>
      </div>
      <button
        onPointerDown={e => { e.stopPropagation(); onSelect(poi); }}
        className={`self-center p-2 rounded-xl transition-all pointer-events-auto text-[10px] ${theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/20 hover:text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-900'}`}
        title="View details"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
