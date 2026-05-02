import { useState, useCallback, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════
// Vacation Disasters — Game Engine Hook
// ═══════════════════════════════════════════

export type TileKind = 'safe' | 'disaster' | 'treasure' | 'gear-beach' | 'gear-ocean' | 'gear-snow' | 'gear-jungle';
export type Biome = 'none' | 'beach' | 'ocean' | 'snow' | 'jungle';
export type Phase = 'menu' | 'playing' | 'won' | 'gameover';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type CharacterChoice = 'kaja' | 'pedro' | 'sara';

export interface Tile {
  kind: TileKind;
  biome: Biome;
  adjacentDisasters: number;
  revealed: boolean;
  flagged: boolean;
  row: number;
  col: number;
}

export interface GameEvent {
  type: 'safe' | 'number-high' | 'disaster' | 'gear' | 'treasure' | 'flag' | 'idle' | 'gameover' | 'won' | 'saving';
  biome?: Biome;
  gearType?: string;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { size: number; disasters: number; gearCount: number }> = {
  easy:   { size: 6,  disasters: 5,  gearCount: 2 },
  medium: { size: 8,  disasters: 10, gearCount: 3 },
  hard:   { size: 10, disasters: 18, gearCount: 4 },
};

const BIOMES: Biome[] = ['beach', 'ocean', 'snow', 'jungle'];
const GEAR_TYPES: TileKind[] = ['gear-beach', 'gear-ocean', 'gear-snow', 'gear-jungle'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNeighbors(row: number, col: number, size: number): [number, number][] {
  const n: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < size && c >= 0 && c < size) n.push([r, c]);
    }
  }
  return n;
}

function generateGrid(difficulty: Difficulty): Tile[][] {
  const { size, disasters, gearCount } = DIFFICULTY_CONFIG[difficulty];
  const grid: Tile[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ({
      kind: 'safe' as TileKind, biome: 'none' as Biome,
      adjacentDisasters: 0, revealed: false, flagged: false, row: r, col: c,
    }))
  );

  // Place items on random cells
  const allCells = shuffle(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number])
  );

  let idx = 0;
  // Place treasure
  const [tr, tc] = allCells[idx++];
  grid[tr][tc].kind = 'treasure';

  // Place disasters
  for (let i = 0; i < disasters && idx < allCells.length; i++, idx++) {
    const [r, c] = allCells[idx];
    grid[r][c].kind = 'disaster';
  }

  // Place gear items (up to gearCount unique biomes)
  const gearBiomes = shuffle(GEAR_TYPES).slice(0, gearCount);
  for (const gearKind of gearBiomes) {
    if (idx >= allCells.length) break;
    const [r, c] = allCells[idx++];
    grid[r][c].kind = gearKind;
  }

  // Assign biome terrains to ONLY plain safe tiles (never gear or treasure)
  const usedBiomes = gearBiomes.map(g => g.replace('gear-', '') as Biome);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c].kind === 'safe' && Math.random() < 0.25) {
        grid[r][c].biome = usedBiomes[Math.floor(Math.random() * usedBiomes.length)] || 'none';
      }
    }
  }

  // Calculate adjacent disaster counts
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c].kind !== 'safe' && !grid[r][c].kind.startsWith('gear')) continue;
      let count = 0;
      for (const [nr, nc] of getNeighbors(r, c, size)) {
        if (grid[nr][nc].kind === 'disaster') count++;
      }
      grid[r][c].adjacentDisasters = count;
    }
  }

  return grid;
}

export function useGameEngine() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [character, setCharacter] = useState<CharacterChoice>('kaja');
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [timeSec, setTimeSec] = useState(0);
  const [flagsPlaced, setFlagsPlaced] = useState(0);
  const [disastersHit, setDisastersHit] = useState(0);
  const [unlockedBiomes, setUnlockedBiomes] = useState<Set<Biome>>(new Set());
  const [lastEvent, setLastEvent] = useState<GameEvent>({ type: 'idle' });
  const [lastDisasterText, setLastDisasterText] = useState('');
  const [treasureText, setTreasureText] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gridSize = DIFFICULTY_CONFIG[difficulty].size;
  const totalDisasters = DIFFICULTY_CONFIG[difficulty].disasters;

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startGame = useCallback((diff: Difficulty, char: CharacterChoice) => {
    setDifficulty(diff);
    setCharacter(char);
    setGrid(generateGrid(diff));
    setHearts(3);
    setScore(0);
    setTimeSec(0);
    setFlagsPlaced(0);
    setDisastersHit(0);
    setUnlockedBiomes(new Set());
    setLastEvent({ type: 'idle' });
    setLastDisasterText('');
    setTreasureText('');
    setPhase('playing');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimeSec(t => t + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const calculateScore = useCallback((heartsLeft: number, time: number, disasters: number) => {
    let s = 1000; // base for finding treasure
    s += Math.max(0, (180 - time)) * 10; // speed bonus
    s += heartsLeft * 500; // hearts bonus
    if (disasters === 0) s += 2000; // perfect
    return s;
  }, []);

  const floodReveal = useCallback((g: Tile[][], row: number, col: number, size: number, unlocked: Set<Biome>) => {
    const stack: [number, number][] = [[row, col]];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const tile = g[r][c];
      if (tile.biome !== 'none' && !unlocked.has(tile.biome)) continue;
      if (tile.kind !== 'safe') continue; // Only flood-reveal safe tiles
      tile.revealed = true;
      tile.flagged = false;
      if (tile.adjacentDisasters === 0 && tile.kind === 'safe') {
        for (const [nr, nc] of getNeighbors(r, c, size)) {
          if (!g[nr][nc].revealed && !g[nr][nc].flagged) stack.push([nr, nc]);
        }
      }
    }
  }, []);

  const revealTile = useCallback((row: number, col: number) => {
    if (phase !== 'playing' || hearts <= 0) return;
    setGrid(prev => {
      const g = prev.map(r => r.map(t => ({ ...t })));
      const tile = g[row][col];
      
      // If already revealed, only allow clicking treasure (to win) or gear (to collect if missed)
      if (tile.revealed && tile.kind !== 'treasure' && !tile.kind.startsWith('gear-')) return prev;
      if (tile.flagged) return prev;

      // Check biome lock
      if (tile.biome !== 'none' && !unlockedBiomes.has(tile.biome)) {
        setLastEvent({ type: 'idle', biome: tile.biome });
        return prev;
      }

      tile.revealed = true;

      if (tile.kind === 'disaster') {
        setHearts(h => {
          const newH = Math.max(0, h - 1);
          if (newH === 0) {
            stopTimer();
            setPhase('gameover');
            setLastEvent({ type: 'gameover' });
          } else {
            setDisastersHit(d => d + 1);
            setLastEvent({ type: 'disaster' });
          }
          return newH;
        });
      } else if (tile.kind === 'treasure') {
        stopTimer();
        const finalScore = calculateScore(hearts, timeSec, disastersHit);
        setScore(finalScore);
        setPhase('won');
        setLastEvent({ type: 'treasure' });
      } else if (tile.kind.startsWith('gear-')) {
        const biome = tile.kind.replace('gear-', '') as Biome;
        if (!unlockedBiomes.has(biome)) {
          setUnlockedBiomes(prevSet => new Set([...prevSet, biome]));
          setLastEvent({ type: 'gear', gearType: tile.kind, biome });
          setScore(s => s + 200);
        } else {
          setLastEvent({ type: 'safe' });
        }
      } else {
        // Safe tile
        const size = g.length;
        if (tile.adjacentDisasters === 0) {
          floodReveal(g, row, col, size, unlockedBiomes);
        }
        setLastEvent(tile.adjacentDisasters >= 3 ? { type: 'number-high' } : { type: 'safe' });
      }

      return g;
    });
  }, [phase, unlockedBiomes, stopTimer, calculateScore, floodReveal]);

  const toggleFlag = useCallback((row: number, col: number) => {
    if (phase !== 'playing') return;
    setGrid(prev => {
      const g = prev.map(r => r.map(t => ({ ...t })));
      const tile = g[row][col];
      if (tile.revealed) return prev;
      tile.flagged = !tile.flagged;
      setFlagsPlaced(f => tile.flagged ? f + 1 : f - 1);
      if (tile.flagged) setLastEvent({ type: 'flag' });
      return g;
    });
  }, [phase]);

  const resetToMenu = useCallback(() => {
    stopTimer();
    setPhase('menu');
    setGrid([]);
    setLastEvent({ type: 'idle' });
  }, [stopTimer]);

  return {
    phase, difficulty, character, grid, hearts, score, timeSec,
    flagsPlaced, disastersHit, unlockedBiomes, lastEvent, gridSize, totalDisasters,
    lastDisasterText, setLastDisasterText, treasureText, setTreasureText,
    setLastEvent, setScore,
    startGame, revealTile, toggleFlag, resetToMenu,
  };
}
