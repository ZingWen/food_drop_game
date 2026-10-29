import Phaser from 'phaser';
import { FOODS, FoodDef, LEVEL, STOCK } from './config';

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

/** 依權重抽出這個等級可以出現的食物 */
export function pickFood(level: number): FoodDef {
  const pool = Object.values(FOODS).filter((f) => f.minLevel <= level);
  const total = pool.reduce((sum, f) => sum + f.weight, 0);
  let roll = Phaser.Math.FloatBetween(0, total);
  for (const food of pool) {
    roll -= food.weight;
    if (roll <= 0) return food;
  }
  return pool[pool.length - 1];
}
