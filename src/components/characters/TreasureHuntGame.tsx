import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Trophy, Loader2, Check, Clock, ChevronRight } from 'lucide-react';
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { GoogleGenAI } from '@google/genai';
import confetti from 'canvas-confetti';
import { TEXTS } from '../../data';

interface TreasureHuntGameProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  destination: string;
  theme?: 'light' | 'dark';
  lang: string;
  apiKey: string;
}

interface Question {
  question: string;
  options: string[];
  correctOptionIndex: number;
  clue: string;
}

interface TreasureScore {
  id?: string;
  playerName: string;
  destination: string;
  timeSec: number;
  correctAnswers: number;
  createdAt?: any;
}

export function TreasureHuntGame({ isOpen, onClose, onComplete, destination, theme = 'dark', lang, apiKey }: TreasureHuntGameProps) {
  const [phase, setPhase] = useState<'lost' | 'clues' | 'found'>('lost');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeSec, setTimeSec] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<TreasureScore[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const t = (key: string) => TEXTS[key]?.[lang] || key;

  // Cleanup timer
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('lost');
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setTimeSec(0);
      setCorrectAnswersCount(0);
      setHasSaved(false);
      setPlayerName('');
    }
  }, [isOpen]);

  const startGame = async () => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = lang === 'cs' 
        ? `Vytvoř 3 zajímavé trivia otázky o destinaci: ${destination}. Formát odpovědi MUSÍ být přesný JSON bez formátování markdown. JSON struktura pole objektů: [{ "question": "Text otázky", "options": ["Možnost A", "B", "C", "D"], "correctOptionIndex": 0, "clue": "Krátké rozuzlení nebo zajímavost k odpovědi" }]`
        : `Generate 3 interesting trivia questions about the destination: ${destination}. The response MUST be exactly JSON without markdown formatting. Array of objects: [{ "question": "Question text", "options": ["Option A", "B", "C", "D"], "correctOptionIndex": 0, "clue": "Short explanation or interesting fact for the answer" }]`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      let parsed: Question[] = [];
      try {
        const text = response.text || "[]";
        parsed = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse AI questions", e);
        // Fallback questions if AI fails formatting
        parsed = [
          { question: "What is a famous landmark here?", options: ["Mountain", "River", "Castle", "Valey"], correctOptionIndex: 0, clue: "They are usually high!" },
          { question: "What is the typical food?", options: ["Pasta", "Sushi", "Stew", "Burger"], correctOptionIndex: 2, clue: "It takes hours to cook." },
          { question: "Best way to travel around?", options: ["Car", "Walk", "Train", "Swim"], correctOptionIndex: 0, clue: "Wheels keep on turning." },
        ];
      }
      
      setQuestions(parsed.slice(0, 3));
      setPhase('clues');
      setCurrentQuestionIndex(0);
      setTimeSec(0);
      setCorrectAnswersCount(0);
      
      timerRef.current = setInterval(() => {
        setTimeSec(t => t + 1);
      }, 1000);
      
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedOption !== null) return; // Prevent double clicking
    setSelectedOption(index);
    setShowExplanation(true);
    
    if (index === questions[currentQuestionIndex].correctOptionIndex) {
      setCorrectAnswersCount(c => c + 1);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setShowExplanation(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
    } else {
      // Game finished
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('found');
      triggerConfetti();
      fetchLeaderboard();
      if (onComplete) onComplete();
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#F59E0B', '#3B82F6']
    });
  };

  const saveScore = async () => {
    if (!playerName.trim() || hasSaved) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'treasure_scores'), {
        playerName: playerName.trim(),
        destination,
        timeSec,
        correctAnswers: correctAnswersCount,
        createdAt: serverTimestamp(),
      });
      setHasSaved(true);
      await fetchLeaderboard();
    } catch (err) {
      console.error("Failed to save score:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const q = query(
        collection(db, 'treasure_scores'),
        where('destination', '==', destination),
        orderBy('timeSec', 'asc'),
        limit(10)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as TreasureScore));
      // Since order matters, let's also sort locally just in case 
      results.sort((a, b) => {
        if (b.correctAnswers !== a.correctAnswers) {
           return b.correctAnswers - a.correctAnswers; // Highest correct first
        }
        return a.timeSec - b.timeSec; // Then lowest time
      });
      setLeaderboard(results);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6 md:p-8 ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}
      >
        <button 
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
        >
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          {phase === 'lost' && (
            <motion.div 
              key="lost"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center space-y-6 pt-4"
            >
              <div className="w-48 h-48 rounded-2xl overflow-hidden bg-slate-200 shadow-inner">
                {/* Fallback image if kaja_pedro_lost.png is missing */}
                <img src="/pictures/kaja_pedro_lost.png" alt="Lost explorers" className="w-full h-full object-cover" 
                     onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1518398046578-8cca57782e17?auto=format&fit=crop&w=400&q=80' }}/>
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight mb-2">
                  {t('treasure_help_find')}
                </h2>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>
                  {t('treasure_lost')}
                </p>
              </div>
              
              <button 
                onClick={startGame}
                disabled={isGenerating}
                className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-2xl font-black uppercase tracking-widest transition-all"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                {isGenerating ? t('treasure_preparing') : t('treasure_start')}
              </button>
            </motion.div>
          )}

          {phase === 'clues' && questions.length > 0 && (
            <motion.div 
              key="clues"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black uppercase">
                  <span className={`px-3 py-1 rounded-full text-xs ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                    Q {currentQuestionIndex + 1} / {questions.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono font-bold text-lg text-emerald-500">
                  <Clock className="w-5 h-5" />
                  {formatTime(timeSec)}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl md:text-2xl font-bold leading-tight">
                  {questions[currentQuestionIndex].question}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                  {questions[currentQuestionIndex].options.map((opt, idx) => {
                    let btnClass = theme === 'dark' 
                      ? 'bg-white/5 hover:bg-white/10 border-white/10' 
                      : 'bg-white hover:bg-slate-50 border-slate-200';
                      
                    if (showExplanation) {
                      if (idx === questions[currentQuestionIndex].correctOptionIndex) {
                        btnClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400';
                      } else if (idx === selectedOption) {
                        btnClass = 'bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-400';
                      } else {
                        btnClass = theme === 'dark' ? 'bg-white/5 opacity-50 border-white/5' : 'bg-slate-50 opacity-50 border-slate-100';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(idx)}
                        disabled={showExplanation}
                        className={`p-4 rounded-2xl border text-left transition-all font-medium ${btnClass}`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {showExplanation && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl mt-4 ${theme === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'}`}
                >
                  <p className="font-medium text-sm md:text-base leading-relaxed">
                    {questions[currentQuestionIndex].clue}
                  </p>
                  
                  <div className="flex justify-end mt-4">
                    <button 
                      onClick={handleNext}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl font-bold uppercase tracking-wider text-sm"
                    >
                      {t('treasure_next')} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {phase === 'found' && (
            <motion.div 
              key="found"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center space-y-6 pt-4"
            >
              <div className="w-32 h-32 rounded-full overflow-hidden bg-emerald-100 shadow-xl border-4 border-emerald-500">
                 <img src="/pictures/kaja_pedro_found.png" alt="Found" className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?auto=format&fit=crop&w=400&q=80' }} />
              </div>
              
              <div className="text-center">
                <h2 className="text-3xl font-black uppercase tracking-tight text-emerald-500 mb-1">
                  {t('treasure_found')}
                </h2>
                <div className="flex items-center justify-center gap-4 text-lg font-bold mt-2">
                  <div className="flex items-center gap-1"><Clock className="w-5 h-5" /> {formatTime(timeSec)}</div>
                  <div className="flex items-center gap-1"><Check className="w-5 h-5 text-emerald-500" /> {correctAnswersCount}/{questions.length}</div>
                </div>
              </div>

              {!hasSaved ? (
                <div className="w-full max-w-sm flex gap-2">
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    placeholder={t('treasure_enter_name')}
                    className={`flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${theme === 'dark' ? 'bg-white/5 border-white/10 placeholder-white/30' : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`}
                  />
                  <button 
                    onClick={saveScore}
                    disabled={isSaving || !playerName.trim()}
                    className="px-6 py-3 bg-emerald-500 text-slate-950 rounded-xl font-bold uppercase disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : t('treasure_save_score')}
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-md pt-6">
                  <div className="flex items-center gap-2 mb-4 font-black uppercase tracking-widest text-emerald-500">
                    <Trophy className="w-5 h-5" />
                    <h3>{t('treasure_leaderboard')}</h3>
                  </div>
                  
                  <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                    {leaderboard.map((score, idx) => (
                      <div key={score.id} className={`flex items-center justify-between p-3 text-sm font-medium ${idx !== leaderboard.length - 1 ? (theme === 'dark' ? 'border-b border-white/5' : 'border-b border-slate-200') : ''} ${score.playerName === playerName && score.timeSec === timeSec ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-900') : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-black ${idx < 3 ? 'text-amber-500' : 'opacity-50'}`}>{idx + 1}</span>
                          <span className="font-bold truncate max-w-[120px]">{score.playerName}</span>
                        </div>
                        <div className="flex items-center gap-4 opacity-80 font-mono text-xs">
                          <span>{score.correctAnswers}/{questions.length}</span>
                          <span>{formatTime(score.timeSec)}</span>
                        </div>
                      </div>
                    ))}
                    {leaderboard.length === 0 && (
                      <div className="p-4 text-center text-sm opacity-50">
                        {t('loading')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
