import Phaser from 'phaser';
import { FOODS, FoodDef, FoodId, FRENZY, FrenzyEvent, LEVEL, STOCK } from './config';

export function levelAt(seconds: number): number {
  return 1 + Math.floor(seconds / LEVEL.secondsPerLevel);
}

export function spawnInterval(level: number): number {
  const table = LEVEL.intervals;
  if (level <= table.length) return table[level - 1];
  const extra = (level - table.length) * LEVEL.intervalStep;
  return Math.max(LEVEL.minInterval, table[table.length - 1] - extra);
}

export function activeLedgeCount(level: number): number {
  const table = LEVEL.activeLedges;
  return table[Math.min(level, table.length) - 1];
}

export function maxOnField(level: number): number {
  return LEVEL.maxAirborneBase + level;
}

export function stockDecayPerSec(level: number): number {
  return STOCK.decayPerSec + (level - 1) * STOCK.decayPerLevel;
}

/** 第 index 次（0 起算）瘋狂掉落的設定；沒有就回傳 null */
export function frenzyAt(index: number): FrenzyEvent | null {
  const list = FRENZY.events;
  if (list.length === 0 || (!FRENZY.loop && index >= list.length)) return null;
  return list[index % list.length];
}

/** 第 index 次瘋狂掉落開始的秒數 */
export function frenzyStart(index: number): number {
  return (index + 1) * FRENZY.everySeconds;
}

/** 依權重抽出這個等級可以出現的食物；指定 only 時只從那些種類抽（不管等級） */
export function pickFood(level: number, only?: 'all' | FoodId[]): FoodDef {
  const pool = only
    ? Object.values(FOODS).filter((f) => only === 'all' || only.includes(f.id))
    : Object.values(FOODS).filter((f) => f.minLevel <= level);
  const total = pool.reduce((sum, f) => sum + f.weight, 0);
  let roll = Phaser.Math.FloatBetween(0, total);
  for (const food of pool) {
    roll -= food.weight;
    if (roll <= 0) return food;
  }
  return pool[pool.length - 1];
}
