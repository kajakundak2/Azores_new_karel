import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, Loader2, Compass, ArrowRight, RefreshCw, User, Bot, Phone, PhoneOff, Mic, MicOff, Paperclip } from 'lucide-react';
import { TEXTS, POI } from '../data';
import { translate } from '../utils/bilingualUtils';

interface ChatMessage {
  role: 'user' | 'model';
  text: string | { en: string; cs: string };
  uiCards?: POI[];
}

interface PlannerChatProps {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (text: string) => void;
  onReset: () => void;
  isReady: boolean;
  onLaunch: () => void;
  lang: string;
  isVoiceActive?: boolean;
  onToggleVoice?: () => void;
  isListening?: boolean;
  onToggleListening?: () => void;
  input: string;
  setInput: (val: string) => void;
  onUploadDoc?: (file: File) => void;
  theme?: 'dark' | 'light';
}

export function PlannerChat({ 
  messages, loading, onSendMessage, onReset, isReady, onLaunch, lang,
  isVoiceActive, onToggleVoice, isListening, onToggleListening,
  input, setInput, onUploadDoc, theme = 'dark'
}: PlannerChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = (key: string) => TEXTS[key]?.[lang] || key;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSendMessage(input);
    setInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadDoc) {
      onUploadDoc(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`w-full flex flex-col h-[520px] backdrop-blur-3xl border rounded-[2.5rem] shadow-2xl overflow-hidden relative group transition-all duration-500 ${theme === 'dark' ? 'bg-zinc-950/40 border-white/10' : 'bg-white border-slate-200'}`}>
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <Sparkles size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {t('chat_header_title')}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400/70 uppercase">{t('chat_ready_status')}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onReset}
          className={`p-2 transition-colors rounded-xl ${theme === 'dark' ? 'text-white/30 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
          title={t('chat_reset')}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth scrollbar-hide"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-2 border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                <Compass size={32} className="text-emerald-500/50" />
            </div>
            <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                {t('chat_welcome_title')}
            </h4>
            <p className={`text-xs max-w-[200px] leading-relaxed ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                {t('chat_welcome_desc')}
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden border ${
                msg.role === 'model' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/10 border-white/10'
              }`}>
                <img 
                  src={msg.role === 'model' ? '/pictures/guides/sara_idle.png' : '/pictures/guides/Kaja.png'} 
                  className="w-full h-full object-cover" 
                  alt={msg.role} 
                />
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${
                msg.role === 'model' 
                  ? (theme === 'dark' ? 'bg-white/5 border border-white/5 text-slate-200' : 'bg-slate-100 border border-slate-200 text-slate-800')
                  : 'bg-emerald-500 text-slate-950 font-medium'
              }`}>
                {translate(msg.text, lang)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Loader2 size={16} className="text-emerald-400 animate-spin" />
            </div>
            <div className={`${theme === 'dark' ? 'bg-white/5 border border-white/5' : 'bg-slate-100 border border-slate-200'} rounded-2xl p-4`}>
                <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer / Input */}
      <div className={`border-t p-4 transition-colors ${theme === 'dark' ? 'bg-zinc-950/20 border-white/5' : 'bg-slate-50/80 border-slate-100'}`}>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative group/input flex flex-col gap-3">
            <div className="relative">
              <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  placeholder={t('chat_input_placeholder')}
                  className={`w-full border rounded-2xl py-4 pl-4 pr-14 text-sm outline-none transition-all font-medium ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-emerald-500/30 focus:bg-white/[0.07]' : 'bg-slate-50 border-slate-200 text-slate-950 placeholder-slate-400 focus:border-emerald-500/30 focus:bg-white'}`}
              />
              {/* Right Action */}
              <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all disabled:opacity-20 flex items-center justify-center shadow-xl active:scale-95"
              >
                  <Send size={18} />
              </button>
            </div>

            {/* Toolbar below input */}
            <div className="flex items-center gap-1">
                <button 
                    type="button" 
                    onClick={onToggleVoice} 
                    className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-all border text-[10px] font-black uppercase tracking-widest ${isVoiceActive ? 'bg-blue-600 border-blue-500 text-white animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.4)]' : (theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400 hover:text-blue-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-100')}`}
                    title={t('chat_voice_architect')}
                >
                    {isVoiceActive ? <PhoneOff size={14} /> : <Phone size={14} />}
                    {isVoiceActive ? t('chat_end_call') : t('chat_call_sara')}
                </button>
                
                <button 
                    type="button" 
                    onClick={onToggleListening} 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isListening ? 'bg-red-500 border-red-400 text-white animate-pulse' : (theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400 hover:text-emerald-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-100')}`}
                    title={t('chat_voice_to_text')}
                >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400 hover:text-emerald-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-100'}`}
                    title={t('chat_upload_doc')}
                >
                    <Paperclip size={16} />
                </button>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".txt,.md,.pdf,.doc,.docx"
                />
            </div>
          </div>
        </form>


        {/* Global Action Tip */}
        <AnimatePresence>
            {isReady && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-16 left-0 right-0 px-4"
                >
                    <button 
                        onClick={onLaunch}
                        className="w-full py-3 bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-[0_0_30px_rgba(52,211,153,0.3)] flex items-center justify-center gap-2 hover:bg-emerald-300 transition-colors animate-pulse"
                    >
                        {t('chat_launch_expedition')}
                        <ArrowRight size={14} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

    </div>
  );
}
