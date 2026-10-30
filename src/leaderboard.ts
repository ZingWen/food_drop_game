import { LEADERBOARD } from './config';

/**
 * 鴉鴉榜：每個名稱只留最佳時間，存在這台裝置的 localStorage。
 * 訪客不上榜，但結算時會告訴他可以排第幾名。
 */

export interface BoardEntry {
  name: string;
  time: number; // 撐過的秒數
  date: number; // 創下紀錄的時間 (ms)
}

const BOARD_KEY = 'crow-yaya-board';
const NAME_KEY = 'crow-player-name';

/** 目前的玩家；null 代表訪客 */
let player: string | null = null;

export function getPlayer(): string | null {
  return player;
}

export function setPlayer(name: string | null) {
  player = name ? cleanName(name) || null : null;
}

/** 記住輸入過的名稱（就算這局選訪客），下次預先填好 */
export function rememberName(name: string) {
  const cleaned = cleanName(name);
  if (!cleaned) return;
  try {
    localStorage.setItem(NAME_KEY, cleaned);
  } catch {
    // 存不了就下次再輸入
  }
}

/** 上次用的名稱，開新局時預先填好 */
export function lastPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, LEADERBOARD.nameMaxLength);
}

/** 依時間由長到短排好 */
export function loadBoard(): BoardEntry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(BOARD_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e): e is BoardEntry => typeof e?.name === 'string' && typeof e?.time === 'number')
      .sort((a, b) => b.time - a.time);
  } catch {
    return [];
  }
}

function saveBoard(board: BoardEntry[]) {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(board));
  } catch {
    // 無痕模式等情況存不了，就算了
  }
}

export interface SubmitResult {
  board: BoardEntry[];
  /** 這次成績的名次（1 起算）；訪客是「如果上榜會排第幾」 */
  rank: number;
  /** 這個名稱之前的最佳時間，沒玩過是 0 */
  previousBest: number;
  /** 刷新了自己的最佳時間 */
  isPersonalBest: boolean;
}

/** 記錄一局的成績。同名只保留最佳時間 */
export function submitScore(name: string | null, time: number): SubmitResult {
  const board = loadBoard();
  const previous = name ? board.find((e) => e.name === name) : undefined;
  const previousBest = previous?.time ?? 0;
  const isPersonalBest = !!name && time > previousBest;

  if (name && isPersonalBest) {
    if (previous) {
      previous.time = time;
      previous.date = Date.now();
    } else {
      board.push({ name, time, date: Date.now() });
    }
    board.sort((a, b) => b.time - a.time);
    saveBoard(board);
  }

  const rank = board.filter((e) => e.time > time && e.name !== name).length + 1;
  return { board, rank, previousBest, isPersonalBest };
}
