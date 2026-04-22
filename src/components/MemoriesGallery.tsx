import React from 'react';
import { motion } from 'motion/react';
import { Image as ImageIcon, ExternalLink, Camera, Sparkles } from 'lucide-react';
import { TEXTS } from '../data';

const MEMORIES = [
  { id: 1, url: 'https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?auto=format&fit=crop&w=400', title: 'Arrival in PDL', author: 'Karel' },
  { id: 2, url: 'https://images.unsplash.com/photo-1527437276441-7a940429bf7d?auto=format&fit=crop&w=400', title: 'Sete Cidades Rim', author: 'Pedro' },
  { id: 3, url: 'https://images.unsplash.com/photo-1589136142558-9469d44336aa?auto=format&fit=crop&w=400', title: 'Furnas Thermal Baths', author: 'Monika' },
  { id: 4, url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400', title: 'Lagoa do Fogo View', author: 'Karel' },
  { id: 5, url: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=400', title: 'Pineapple Plantations', author: 'Pedro' },
  { id: 6, url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=400', title: 'Terra Nostra Garden', author: 'Monika' },
];

interface MemoriesGalleryProps {
  lang: string;
}

export function MemoriesGallery({ lang }: MemoriesGalleryProps) {
  const t = (key: string) => TEXTS[key]?.[lang] || key;
  
  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 text-left">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Camera className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500/60">{t('memories_badge')}</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-slate-950 dark:text-white tracking-tighter uppercase leading-none">
              {t('memories_title_1')} <br /> <span className="text-emerald-500">{t('memories_title_2')}</span>
            </h2>
          </div>
          
          <motion.a
            href="https:photos.google.com" // Placeholder for user's album
            target="_blank"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group flex items-center gap-3 px-8 py-5 bg-zinc-950 dark:bg-white text-white dark:text-slate-950 font-black rounded-[2rem] text-xs uppercase tracking-widest transition-all shadow-xl hover:bg-emerald-500 dark:hover:bg-emerald-400 shadow-slate-200/50 dark:shadow-none"
          >
            <Sparkles className="w-4 h-4" />
            {t('memories_google_photos')}
            <ExternalLink className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
          </motion.a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {MEMORIES.map((photo, i) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="aspect-square rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/10 relative group cursor-pointer shadow-lg"
            >
              <img 
                src={photo.url} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                alt={photo.title} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end text-left">
                <p className="text-white font-black text-[10px] uppercase tracking-widest">{photo.title}</p>
                <p className="text-emerald-400 font-bold text-[8px] uppercase">{t('memories_by')} {photo.author}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* AI Memories Placeholder Notification */}
        <div className="mt-12 p-8 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-[3rem] flex flex-col md:flex-row items-center gap-6 shadow-sm shadow-emerald-500/5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
            <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-left">
            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-sm mb-1">{t('memories_ai_enabled')}</h4>
            <p className="text-xs text-slate-500 dark:text-white/50 leading-relaxed max-w-2xl">
              {t('memories_ai_desc')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
