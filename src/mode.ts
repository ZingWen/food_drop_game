/** 目前是不是「上班一條蟲」模式（回到主選單時會重設） */
let wormMode = false;

export function isWormMode(): boolean {
  return wormMode;
}

export function setWormMode(on: boolean) {
  wormMode = on;
}
