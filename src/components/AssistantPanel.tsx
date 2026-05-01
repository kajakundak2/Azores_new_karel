import React from 'react';
import { Phone, PhoneOff, Mic, MicOff, Paperclip, Send, Loader2, Plus } from 'lucide-react';
import { CharacterAvatar } from './characters/CharacterAvatar';
import { ChatMessage, POI } from '../utils/types';
import { translate } from '../utils/bilingualUtils';
import { TEXTS } from '../data';

interface AssistantPanelProps {
  theme: 'dark' | 'light';
  lang: string;
  messages: ChatMessage[];
  saraState: any;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  chatEndRef: React.RefObject<HTMLDivElement>;
  isChatLoading: boolean;
  isVoiceActive: boolean;
  callStatus: string;
  chatInput: string;
  setChatInput: (val: string) => void;
  handleChatKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  stopCall: () => void;
  startCall: () => void;
  setIsListening: (val: boolean) => void;
  isListening: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (file: File) => void;
  handleSendMessage: () => void;
  addPoi: (dayIso: string, poi: POI) => void;
  currentIso: string;
  safeActiveDayIdx: number;
  t: (key: string) => string;
  setNotification: (msg: string) => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  theme,
  lang,
  messages,
  saraState,
  chatContainerRef,
  chatEndRef,
  isChatLoading,
  isVoiceActive,
  callStatus,
  chatInput,
  setChatInput,
  handleChatKeyDown,
  stopCall,
  startCall,
  setIsListening,
  isListening,
  fileInputRef,
  handleFileUpload,
  handleSendMessage,
  addPoi,
  currentIso,
  safeActiveDayIdx,
  t,
  setNotification,
}) => {
  return (
    <div className={`p-4 border-b flex-shrink-0 transition-colors duration-500 ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3 mb-4 px-2">
        <div className="relative group cursor-pointer">
          <CharacterAvatar 
            src={saraState.imageSrc} 
            alt="Sara" 
            size="sm" 
            animation={saraState.animation} 
            speechBubble={saraState.speechBubble}
            interactive
          />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
        </div>
        <div>
          <h4 className={`font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{TEXTS['sara_voice']?.[lang] || 'Sara Voice Assistant'}</h4>
          <p className={`text-[9px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{callStatus === 'connected' ? (TEXTS['live_on_call']?.[lang] || 'Live on Call') : (TEXTS['online_ready']?.[lang] || 'Online & Ready')}</p>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div 
        ref={chatContainerRef}
        className={`space-y-3 mb-4 max-h-[300px] overflow-y-auto p-2 rounded-2xl border transition-all duration-500 ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}
      >
        {messages.length === 0 && (
          <p className={`text-xs p-4 text-center ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{TEXTS['ask_destination']?.[lang] || 'Ask me anything about the destination — weather, tips, route suggestions, restaurants.'}</p>
        )}
        {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-emerald-500 text-slate-950 font-black rounded-br-sm shadow-emerald-500/20' : (theme === 'dark' ? 'bg-white/10 text-white rounded-bl-sm border border-white/10' : 'bg-white text-slate-900 rounded-bl-sm border border-slate-200 shadow-sm')}`}>
                {translate(msg.text, lang)}
              </div>
              {msg.uiCards?.map(card => (
                <div key={card.id} className={`w-[90%] border border-emerald-500/30 p-2 rounded-xl flex items-center gap-3 shadow-xl relative overflow-hidden group ml-2 mb-2 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
                   <img src={card.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                   <div className="flex-1 min-w-0">
                      <h4 className={`font-black text-xs truncate ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{translate(card.title, lang)}</h4>
                      <p className={`text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/50' : 'text-slate-400'}`}>{card.category}</p>
                   </div>
                   <button 
                     onClick={() => {
                       addPoi(currentIso, card);
                       setNotification(t('notification_added'));
                     }}
                     className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 rounded-lg transition-all"
                     title="Add to Itinerary"
                   ><Plus className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className={`rounded-xl rounded-bl-sm px-3 py-2 flex items-center gap-2 border ${theme === 'dark' ? 'bg-white/10 border-white/10' : 'bg-slate-200 border-slate-300'}`}>
              <Loader2 className={`w-3 h-3 animate-spin ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`} />
              <span className={`text-[10px] ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>{t('chat_thinking')}</span>
            </div>
          </div>
        )}
        {isVoiceActive && (
          <div className={`p-3 rounded-xl flex flex-col justify-center items-center gap-2 border ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-500/5 border-blue-200'}`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className={`text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`}>{callStatus}</span>
            </div>
            <p className={`text-[9px] italic ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Sára is listening...</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Inputs */}
      <div className="flex gap-2 isolate">
        <button onClick={() => isVoiceActive ? stopCall() : startCall()} className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isVoiceActive ? 'bg-blue-600 border-blue-500 text-white' : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-emerald-600')}`}>
            {isVoiceActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
        </button>
        <button onClick={() => setIsListening(!isListening)} className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isListening ? 'bg-red-500 border-red-500 text-white animate-pulse' : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-emerald-600')}`}>
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <div className="w-px h-10 bg-white/10 mx-1" />
        <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-emerald-600'}`}
            title="Upload Reference Document"
        >
            <Paperclip className="w-4 h-4" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          accept=".txt,.md,.pdf,.doc,.docx"
        />
        <input 
          value={chatInput} 
          onChange={e => setChatInput(e.target.value)} 
          onKeyDown={handleChatKeyDown} 
          placeholder={t('chat_placeholder')} 
          className={`flex-1 border rounded-xl px-3 py-2 text-xs outline-none transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50' : 'bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500/50'}`}
        />
        <button 
          onClick={handleSendMessage} 
          disabled={!chatInput.trim() || isChatLoading} 
          className={`w-10 h-10 flex-shrink-0 bg-emerald-500 text-slate-950 font-black rounded-xl flex items-center justify-center disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 hover:shadow-emerald-400/40`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
