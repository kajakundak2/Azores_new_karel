import React from 'react';
import { motion } from 'motion/react';

interface SectionHeaderProps {
  Icon?: any;
  title: string | React.ReactNode;
  subtitle?: string;
  theme: 'dark' | 'light';
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ Icon, title, subtitle, theme }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="flex flex-col items-center text-center mb-16 space-y-4"
  >
    {Icon && (
      <div className={`w-16 h-16 backdrop-blur-xl rounded-3xl flex items-center justify-center border mb-2 shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-white/80 border-slate-200'}`}>
        <Icon className={`w-8 h-8 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
      </div>
    )}
    <h2 className={`text-4xl sm:text-7xl font-black tracking-tighter uppercase drop-shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{title}</h2>
    {subtitle && <p className={`font-black tracking-[0.4em] text-xs uppercase transition-colors duration-500 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{subtitle}</p>}
    <div className="w-24 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
  </motion.div>
);
