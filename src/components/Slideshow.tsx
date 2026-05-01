import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SLIDES } from '../data';

interface SlideshowProps {
  isBlurred?: boolean;
  theme: 'dark' | 'light';
}

export const Slideshow: React.FC<SlideshowProps> = ({ isBlurred = false, theme }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    // Start with a random slide
    setCurrent(Math.floor(Math.random() * SLIDES.length));
    const timer = setInterval(() => setCurrent(p => (p + 1) % SLIDES.length), 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`fixed inset-0 w-full h-full -z-20 overflow-hidden transition-colors duration-1000 ${theme === 'dark' ? 'bg-zinc-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${isBlurred ? 'blur-2xl scale-110 opacity-70' : 'opacity-90'}`}
          style={{ backgroundImage: `url('${SLIDES[current]}')` }}
        />
      </AnimatePresence>
      <div className={`absolute inset-0 transition-all duration-1000 ${isBlurred ? 'backdrop-blur-3xl ' + (theme === 'dark' ? 'bg-zinc-950/40' : 'bg-white/40') : 'backdrop-blur-[2px] ' + (theme === 'dark' ? 'bg-zinc-950/20' : 'bg-zinc-50/40')}`} />
      <div className={`absolute inset-0 bg-gradient-to-b ${theme === 'dark' ? 'from-zinc-950/40 via-transparent to-zinc-950/60' : 'from-white/40 via-transparent to-slate-200/60'}`} />
    </div>
  );
};
