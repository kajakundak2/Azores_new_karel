import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { TEXTS } from '../../data';
import { useGameEngine, type Tile, type Phase, type Difficulty, type CharacterChoice, type Biome } from '../../hooks/useGameEngine';
import confetti from 'canvas-confetti';
import './VacationDisasters.css';

interface Props { isOpen: boolean; onClose: () => void; language: 'en' | 'cs'; }

const IMG = '/pictures/guides/';

const CHAR_IMAGES: Record<string, Record<string, string>> = {
  kaja: { select: 'kaja_waiving.png', idle: 'Kaja.png', disaster: 'kaja_pedro_lost.png', flag: 'kaja_surfing.png', won: 'kaja_pedro_found.png', gameover: 'sara_bored.png', 'gear-beach': 'kaja_surfing.png', 'gear-ocean': 'pedro_diving.png', 'gear-snow': 'kaja_skiing.png', 'gear-jungle': 'Pedro_karel_jeep.png', high: 'sara_thinking.png', saving: 'pedro_suitcase_packed.png' },
  pedro: { select: 'pedro_waving.png', idle: 'Pedro.png', disaster: 'pedro_suitcase.png', flag: 'pedro_map.png', won: 'kaja_pedro_found.png', gameover: 'sara_bored.png', 'gear-beach': 'kaja_surfing.png', 'gear-ocean': 'pedro_diving.png', 'gear-snow': 'kaja_skiing.png', 'gear-jungle': 'Pedro_karel_jeep.png', high: 'sara_thinking.png', saving: 'pedro_suitcase_packed.png' },
  sara: { select: 'sara_waving.png', idle: 'sara_idle.png', disaster: 'kaja_pedro_lost.png', flag: 'pedro_map.png', won: 'sara_excited.png', gameover: 'sara_bored.png', 'gear-beach': 'kaja_surfing.png', 'gear-ocean': 'pedro_diving.png', 'gear-snow': 'kaja_skiing.png', 'gear-jungle': 'Pedro_karel_jeep.png', high: 'sara_thinking.png', saving: 'sara_typing.png' },
};

const BIOME_EMOJIS: Record<Biome, string> = { none: '', beach: '🏖️', ocean: '🌊', snow: '❄️', jungle: '🌴' };
const TILE_EMOJIS = { disaster: '💥', treasure: '💎', flag: '🚩' };
const GEAR_LABELS: Record<string, string> = { 'gear-beach': '🏄', 'gear-ocean': '🤿', 'gear-snow': '⛷️', 'gear-jungle': '🚙' };

function t(key: string, lang: 'en' | 'cs') { return (TEXTS as Record<string, Record<string, string>>)[key]?.[lang] || key; }

// AI logic disabled as requested to avoid rate limits/version issues
// Using local fallbacks for game flavor text

const DISASTER_PROMPTS = [
  'Lost luggage at the airport', 'Food poisoning from street food', 'Sunburn on day one',
  'Got scammed by a taxi driver', 'Hotel room has no AC', 'Missed the ferry',
  'Stepped on a sea urchin', 'Camera fell in the ocean', 'Allergic reaction to local cuisine',
  'Flight delayed 8 hours', 'Passport got soaked', 'Wrong bus to nowhere',
];

export function TreasureHuntGame({ isOpen, onClose, language }: Props) {
  const engine = useGameEngine();
  const { phase, grid, hearts, score, timeSec, flagsPlaced, unlockedBiomes, lastEvent, character, gridSize, totalDisasters, disastersHit } = engine;

  const [menuChar, setMenuChar] = useState<CharacterChoice>('kaja');
  const [menuDiff, setMenuDiff] = useState<Difficulty>('medium');
  const [speechText, setSpeechText] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [showLB, setShowLB] = useState(false);
  const [lbTab, setLbTab] = useState<'daily'|'alltime'>('daily');
  const [lbData, setLbData] = useState<{name:string;score:number;date:string}[]>([]);
  const [scoreSaved, setScoredSaved] = useState(false);

  const currentImage = useMemo(() => {
    const imgs = CHAR_IMAGES[character] || CHAR_IMAGES.kaja;
    if (phase === 'menu') return imgs.select;
    if (phase === 'won') return imgs.won;
    if (phase === 'gameover') return imgs.gameover;
    const ev = lastEvent;
    if (ev.type === 'disaster') return imgs.disaster;
    if (ev.type === 'flag') return imgs.flag;
    if (ev.type === 'number-high') return imgs.high;
    if (ev.type === 'gear' && ev.gearType) return imgs[ev.gearType] || imgs.idle;
    if (ev.type === 'saving') return imgs.saving;
    return imgs.idle;
  }, [character, phase, lastEvent]);

  // Local flavor text on events
  useEffect(() => {
    if (lastEvent.type === 'disaster') {
      const fallbacks = ['💥 Ouch! That was a disaster!', '💥 My luggage! My pride!', '💥 This is not the vacation I paid for!', '💥 Everything is fine... (it is not)', '💥 Lost my passport in the jungle!', '💥 Sunburned on day one. Classic.'];
      setSpeechText(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
    } else if (lastEvent.type === 'treasure' || lastEvent.type === 'won') {
      setSpeechText('🎉 WE FOUND IT!');
    } else if (lastEvent.type === 'gear') {
      const label = lastEvent.gearType ? GEAR_LABELS[lastEvent.gearType] || '🎒' : '🎒';
      setSpeechText(`${label} New gear unlocked! Let's explore!`);
    } else if (lastEvent.type === 'flag') {
      setSpeechText('🚩 Marked! Stay away from there!');
    } else if (lastEvent.type === 'number-high') {
      setSpeechText('😰 Something bad is very close...');
    } else if (lastEvent.type === 'gameover') {
      setSpeechText(t('game_over_subtitle', language));
    } else if (lastEvent.type === 'safe') {
      const quips = ['Looking good...', 'Safe so far!', 'Keep going!', 'Nothing here 🍃', 'All clear!'];
      setSpeechText(quips[Math.floor(Math.random() * quips.length)]);
    }
  }, [lastEvent, language]);

  // Confetti on win
  useEffect(() => {
    if (phase === 'won') {
      const end = Date.now() + 2000;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [phase]);

  const loadLeaderboard = useCallback(async (tab: 'daily'|'alltime') => {
    try {
      let q;
      if (tab === 'daily') {
        const today = new Date(); today.setHours(0,0,0,0);
        q = query(collection(db, 'treasure_scores'), where('timestamp', '>=', Timestamp.fromDate(today)), orderBy('score', 'desc'), limit(10));
      } else {
        q = query(collection(db, 'treasure_scores'), orderBy('score', 'desc'), limit(10));
      }
      const snap = await getDocs(q);
      setLbData(snap.docs.map(d => { const data = d.data() as Record<string, any>; return { name: data.name, score: data.score, date: data.timestamp?.toDate?.()?.toLocaleDateString() || '' }; }));
    } catch { setLbData([]); }
  }, []);

  const saveScore = useCallback(async () => {
    if (!playerName.trim() || scoreSaved) return;
    try {
      await addDoc(collection(db, 'treasure_scores'), {
        name: playerName.trim(), score, character,
        difficulty: engine.difficulty, timestamp: Timestamp.now(),
      });
      setScoredSaved(true);
      engine.setLastEvent({ type: 'saving' });
      loadLeaderboard(lbTab);
    } catch (e) { console.error('Save failed', e); }
  }, [playerName, score, scoreSaved, character, engine, lbTab, loadLeaderboard]);

  const handleStart = useCallback(() => {
    engine.startGame(menuDiff, menuChar);
    setScoredSaved(false);
    setShowLB(false);
    setSpeechText('Let\'s find that treasure! 🗺️');
  }, [engine, menuDiff, menuChar]);

  const handleTileClick = useCallback((tile: Tile) => {
    if (tile.flagged) return;
    if (tile.revealed && tile.kind !== 'treasure' && !tile.kind.startsWith('gear-')) return;
    
    if (tile.biome !== 'none' && !unlockedBiomes.has(tile.biome)) {
      const gearNeeded = `gear-${tile.biome}`;
      const gearLabel = GEAR_LABELS[gearNeeded] || '❓';
      const biomeName = tile.biome.charAt(0).toUpperCase() + tile.biome.slice(1);
      setSpeechText(language === 'en' 
        ? `🔒 This ${biomeName} is locked! You need ${gearLabel} gear first!` 
        : `🔒 Tato oblast (${biomeName}) je zamčená! Potřebuješ vybavení ${gearLabel}!`);
      return;
    }
    engine.revealTile(tile.row, tile.col);
  }, [engine, unlockedBiomes, language]);

  const handleRightClick = useCallback((e: React.MouseEvent, tile: Tile) => {
    e.preventDefault();
    engine.toggleFlag(tile.row, tile.col);
  }, [engine]);

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  if (!isOpen) return null;

  // ───── MENU SCREEN ─────
  if (phase === 'menu') {
    return (
      <div className="vd-overlay" onClick={onClose}>
        <div className="vd-modal" onClick={e => e.stopPropagation()}>
          <div className="vd-header">
            <div><h1>{t('game_title', language)}</h1><span>{t('game_subtitle', language)}</span></div>
            <button className="vd-close" onClick={onClose}>{t('game_close', language)}</button>
          </div>
          <div className="vd-menu">
            <h2>🏝️ {t('game_title', language)}</h2>
            <h3>{t('game_subtitle', language)}</h3>

            <div className="vd-menu-section">
              <h4>{t('game_select_character', language)}</h4>
              <div className="vd-char-picks">
                {(['kaja','pedro','sara'] as CharacterChoice[]).map(c => (
                  <div key={c} className={`vd-char-pick ${menuChar===c?'selected':''}`} onClick={() => setMenuChar(c)}>
                    <img src={`${IMG}${CHAR_IMAGES[c].select}`} alt={c} />
                    <span>{c.charAt(0).toUpperCase()+c.slice(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="vd-menu-section">
              <h4>{t('game_select_difficulty', language)}</h4>
              <div className="vd-diff-picks">
                {(['easy','medium','hard'] as Difficulty[]).map(d => (
                  <div key={d} className={`vd-diff-pick ${menuDiff===d?'selected':''}`} onClick={() => setMenuDiff(d)}>
                    <strong>{t(`game_${d}`, language)}</strong>
                    <span>{t(`game_${d}_desc`, language)}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="vd-start-btn" onClick={handleStart}>{t('game_start_adventure', language)}</button>
            <span className="vd-hint">{t('game_reveal_hint', language)}</span>

            <div className="vd-how-to">
              <h5>🗺️ {language === 'en' ? 'How to Play' : 'Jak hrát'}</h5>
              <ul>
                <li>{language === 'en' ? 'Reveal tiles to find the Diamond Treasure 💎' : 'Odhaluj políčka a najdi poklad 💎'}</li>
                <li>{language === 'en' ? 'Numbers show how many Disasters 💥 are nearby' : 'Čísla ukazují, kolik nehod 💥 je v okolí'}</li>
                <li>{language === 'en' ? 'Pick up Gear (🚙, ⛷️, 🤿, 🏄) to unlock biomes!' : 'Sbírej vybavení (🚙, ⛷️, 🤿, 🏄) pro odemknutí biomů!'}</li>
                <li>{language === 'en' ? 'Locked tiles (🔒) need specific Gear to be opened' : 'Zamčená pole (🔒) vyžadují konkrétní vybavení'}</li>
                <li>{language === 'en' ? 'Don\'t run out of Hearts ❤️ (Patience)!' : 'Nesmí ti dojít srdíčka ❤️ (Trpělivost)!'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───── END SCREENS (won / gameover) ─────
  if (phase === 'won' || phase === 'gameover') {
    const isWin = phase === 'won';
    const speedBonus = Math.max(0, (180 - timeSec) * 10);
    const heartsBonus = hearts * 500;
    const perfectBonus = disastersHit === 0 ? 2000 : 0;

    return (
      <div className="vd-overlay">
        <div className="vd-modal" onClick={e => e.stopPropagation()}>
          <div className="vd-header">
            <div><h1>{t('game_title', language)}</h1></div>
            <button className="vd-close" onClick={onClose}>{t('game_close', language)}</button>
          </div>
          <div className="vd-endscreen">
            <h2 className={isWin ? 'won' : 'lost'}>{isWin ? t('game_won_title', language) : t('game_over_title', language)}</h2>
            <img src={`${IMG}${currentImage}`} alt="result" />
            <p style={{color:'#a1a1aa',fontStyle:'italic',margin:0}}>{speechText}</p>

            {isWin && (
              <div className="vd-score-breakdown">
                <div className="vd-score-row"><span>Base</span><span>1,000</span></div>
                <div className="vd-score-row"><span>{t('game_speed_bonus', language)}</span><span>{speedBonus.toLocaleString()}</span></div>
                <div className="vd-score-row"><span>{t('game_hearts_bonus', language)}</span><span>{heartsBonus.toLocaleString()}</span></div>
                {perfectBonus > 0 && <div className="vd-score-row"><span>✨ {t('game_perfect_bonus', language)}</span><span>{perfectBonus.toLocaleString()}</span></div>}
                <div className="vd-score-row total"><span>{t('game_score', language)}</span><span>{score.toLocaleString()}</span></div>
              </div>
            )}

            {isWin && !scoreSaved && (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input className="vd-name-input" placeholder={t('game_enter_name', language)} value={playerName} onChange={e => setPlayerName(e.target.value)} maxLength={20} />
                <button className="vd-btn primary" onClick={saveScore} disabled={!playerName.trim()}>{t('game_save_score', language)}</button>
              </div>
            )}
            {scoreSaved && <span style={{color:'#34d399',fontSize:'.85rem'}}>✅ Score saved!</span>}

            <div className="vd-btn-row">
              <button className="vd-btn primary" onClick={() => engine.resetToMenu()}>{t('game_play_again', language)}</button>
              <button className="vd-btn" onClick={() => { setShowLB(!showLB); if (!showLB) loadLeaderboard(lbTab); }}>{t('game_leaderboard', language)}</button>
            </div>

            {showLB && (
              <div className="vd-leaderboard">
                <div className="vd-lb-tabs">
                  <button className={`vd-lb-tab ${lbTab==='daily'?'active':''}`} onClick={()=>{setLbTab('daily');loadLeaderboard('daily');}}>{t('game_daily', language)}</button>
                  <button className={`vd-lb-tab ${lbTab==='alltime'?'active':''}`} onClick={()=>{setLbTab('alltime');loadLeaderboard('alltime');}}>{t('game_alltime', language)}</button>
                </div>
                {lbData.length === 0 ? <p style={{color:'#71717a',fontSize:'.8rem',textAlign:'center'}}>No scores yet</p> :
                  lbData.map((e,i) => (
                    <div key={i} className="vd-lb-entry">
                      <span className="rank">#{i+1}</span>
                      <span className="name">{e.name}</span>
                      <span className="pts">{e.score.toLocaleString()}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ───── PLAYING SCREEN ─────
  const allBiomes: Biome[] = ['beach','ocean','snow','jungle'];

  return (
    <div className="vd-overlay">
      <div className="vd-modal" onClick={e => e.stopPropagation()}>
        <div className="vd-header">
          <div><h1>{t('game_title', language)}</h1><span>{t('game_subtitle', language)}</span></div>
          <button className="vd-close" onClick={() => { engine.resetToMenu(); onClose(); }}>{t('game_close', language)}</button>
        </div>
        <div className="vd-body">
          {/* SIDEBAR */}
          <div className="vd-sidebar">
            <div className="vd-avatar-box">
              <img src={`${IMG}${currentImage}`} alt={character} />
            </div>
            <div className="vd-speech">{speechText || '🗺️ Click a tile to explore!'}</div>
            <div className="vd-stats">
              <div className="vd-stat">
                <div className="vd-stat-label">{t('game_patience', language)}</div>
                <div className="vd-stat-val hearts">
                  {'❤️'.repeat(Math.max(0, Math.min(3, Number(hearts) || 0)))}
                  {'🖤'.repeat(Math.max(0, 3 - (Number(hearts) || 0)))}
                </div>
              </div>
              <div className="vd-stat"><div className="vd-stat-label">{t('game_time', language)}</div><div className="vd-stat-val">{formatTime(timeSec)}</div></div>
              <div className="vd-stat"><div className="vd-stat-label">{t('game_score', language)}</div><div className="vd-stat-val score">{score}</div></div>
              <div className="vd-stat"><div className="vd-stat-label">{t('game_flags', language)}</div><div className="vd-stat-val">🚩 {flagsPlaced}/{totalDisasters}</div></div>
            </div>
            <div className="vd-gear-bar">
              {allBiomes.map(b => {
                const isUnlocked = unlockedBiomes.has(b);
                return (
                  <div key={b} className={`vd-gear-item ${isUnlocked ? 'unlocked' : 'locked'}`} title={b}>
                    <span className="vd-gear-icon">{isUnlocked ? GEAR_LABELS[`gear-${b}`] : '🔒'}</span>
                    <span className="vd-gear-text">{t(`game_biome_${b}`, language)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRID */}
          <div className="vd-grid-area">
            <div className="vd-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(28px, 52px))` }}>
              {grid.flat().map((tile, idx) => {
                const isLocked = tile.biome !== 'none' && !unlockedBiomes.has(tile.biome) && !tile.revealed;
                let cls = 'vd-tile';
                if (!tile.revealed) {
                  cls += ' hidden';
                  if (tile.flagged) cls += ' flagged';
                  if (isLocked) cls += ` biome-${tile.biome} locked`;
                } else {
                  cls += ' revealed';
                  if (tile.kind === 'disaster') cls += ' disaster';
                  if (tile.kind === 'treasure') cls += ' treasure';
                  if (tile.kind.startsWith('gear-')) cls += ' gear';
                }

                let content: React.ReactNode = null;
                if (tile.flagged && !tile.revealed) {
                  content = TILE_EMOJIS.flag;
                } else if (isLocked && !tile.revealed) {
                  content = <span style={{fontSize:'.7rem',opacity:.7}}>🔒</span>;
                } else if (!tile.revealed) {
                  content = tile.biome !== 'none' ? <span style={{fontSize:'.7rem',opacity:.5}}>{BIOME_EMOJIS[tile.biome]}</span> : null;
                } else if (tile.kind === 'disaster') {
                  content = TILE_EMOJIS.disaster;
                } else if (tile.kind === 'treasure') {
                  content = TILE_EMOJIS.treasure;
                } else if (tile.kind.startsWith('gear-')) {
                  content = GEAR_LABELS[tile.kind] || '🎒';
                } else if (tile.adjacentDisasters > 0) {
                  content = <span className={`tile-num n${tile.adjacentDisasters}`}>{tile.adjacentDisasters}</span>;
                }

                return (
                  <div key={idx} className={cls}
                    onClick={() => handleTileClick(tile)}
                    onContextMenu={e => handleRightClick(e, tile)}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
