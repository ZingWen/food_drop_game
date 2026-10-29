/**
 * 遊戲所有可調整的數值都集中在這個檔案。
 * 可改手感、難度、文字。
 */

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GAME_TITLE = '呱，想貪心的烏鴉';
/** 像素字型 Cubic 11（public/fonts），字級用 12 的倍數最清楚 */
export const FONT = '"Cubic11", "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif';

/** true：顯示烏鴉可飛範圍、鳥巢卸貨範圍等除錯框 */
export const DEBUG = false;

export const WORLD = {
  groundHeight: 70,
  gravity: 520,
};

export const BUILDING = {
  width: 240,
  floorHeight: 95,
  ledges: 5, // 有窗台的樓層數（2F～6F）
  ledgeDepth: 36, // 窗台往外凸出的長度
  rightMargin: 20,
};

export const CROW = {
  speed: 380, // 最高飛行速度 (px/s)
  accel: 2600, // 鍵盤操作的加速度
  dragSensitivity: 1.2, // 觸控/滑鼠拖曳的靈敏度
  zoneTopBelowTopLedge: 60, // 最高只能飛到「最高窗台下方」這麼多 px
  zoneBottomAboveGround: 80, // 最低只能飛到離地面這麼多 px
  zoneLeft: 100,
  gapToBuilding: 40, // 籃子和窗台之間至少保持的距離
  beak: { x: 58, y: -6 }, // 嘴巴（籃子掛點）相對烏鴉中心的位置
  cape: { show: true, x: 0, y: 0 }, // 披風：是否顯示、相對烏鴉的位移（換烏鴉圖後用來對齊脖子）
};

export const BASKET = {
  capacity: 8,
  fullSpeedPenalty: 0.4, // 裝滿時速度減少 40%
  rimY: 34, // 籃口離掛點的距離
  rimHalfWidth: 38,
  bodyHeight: 44,
  dirtySeconds: 4, // 腐爛食物讓籃子變髒多久（視覺效果）
};

export const NEST = {
  x: 150, // 鳥巢中心離畫面左邊的距離
  depositHalfWidth: 85,
  depositHeight: 150, // 籃口低於「地面往上這個高度」才算到巢
};

export const STOCK = {
  max: 100,
  start: 50,
  decayPerSec: 2,
  decayPerLevel: 0.5, // 每升一級，每秒多減這麼多
  lowWarning: 0.2, // 低於 20% 時 bar 閃紅
};

export const HEARTS = { start: 5, max: 5 };

export const LEVEL = {
  secondsPerLevel: 30,
  intervals: [2.0, 1.6, 1.3], // 第 1～3 級的跳下間隔（秒）
  intervalStep: 0.1, // 第 4 級起每級再減這麼多
  minInterval: 0.6,
  activeLedges: [3, 4, 5], // 第 1～3 級有幾層會出食物（之後維持最後一個值）
  maxAirborneBase: 2, // 同時在場上的食物上限 = base + 等級
};

export const JUMP = {
  warnSeconds: 0.6, // 跳下前抖動預警的時間
  vxMin: 120,
  vxMax: 320,
  vyMin: 150,
  vyMax: 300,
  speedUpPerLevel: 0.05, // 每升一級，跳出的水平速度 +5%
};

export type FoodId = 'steak' | 'normal' | 'golden' | 'pork' | 'rotten' | 'tomato' | 'bomb';

export interface FoodDef {
  id: FoodId;
  good: boolean;
  weight: number; // 出現機率的權重
  minLevel: number; // 第幾級開始出現
  textures: string[];
  /** 好東西：回巢卸貨時加的囤貨度 */
  stock: number;
  /** 接到當下的愛心變化（金色 +1、壞東西 -1） */
  catchHeart: number;
  catchStun: number;
  catchMessage?: string;
  /** 炸彈：籃子裡的食物全部掉光 */
  spillBasket?: boolean;
  /** 接到後囤貨度暫停減少幾秒 */
  freezeSeconds?: number;
  /** 沒接到（掉到地上）扣的愛心 */
  missHeart: number;
  missMessage?: string;
}

export const FOODS: Record<FoodId, FoodDef> = {
  steak: {
    id: 'steak', good: true, weight: 20, minLevel: 1, textures: ['food_steak'],
    stock: 15, catchHeart: 0, catchStun: 0,
    missHeart: 1, missMessage: '最愛被糟蹋了！',
  },
  normal: {
    id: 'normal', good: true, weight: 55, minLevel: 1,
    textures: ['food_apple', 'food_bread', 'food_cheese', 'food_fish'],
    stock: 5, catchHeart: 0, catchStun: 0, missHeart: 0,
  },
  golden: {
    id: 'golden', good: true, weight: 5, minLevel: 2, textures: ['food_golden'],
    stock: 5, catchHeart: 1, catchStun: 0, missHeart: 0,
  },
  pork: {
    id: 'pork', good: true, weight: 6, minLevel: 1, textures: ['food_pork'],
    stock: 5, catchHeart: 0, catchStun: 0, freezeSeconds: 5, missHeart: 0,
  },
  rotten: {
    id: 'rotten', good: false, weight: 8, minLevel: 2, textures: ['food_rotten'],
    stock: 0, catchHeart: -1, catchStun: 1, catchMessage: '腐爛食物髒了籃子！', missHeart: 0,
  },
  tomato: {
    id: 'tomato', good: false, weight: 8, minLevel: 2, textures: ['food_tomato'],
    stock: 0, catchHeart: -1, catchStun: 1, catchMessage: '番茄是惡魔果實！', missHeart: 0,
  },
  bomb: {
    id: 'bomb', good: false, weight: 4, minLevel: 3, textures: ['food_bomb'],
    stock: 0, catchHeart: -1, catchStun: 1.5, catchMessage: '被炸彈雷了！', spillBasket: true, missHeart: 0,
  },
};

/**
 * 正式圖片：填上路徑就會取代程式畫的暫代圖（路徑相對於 public/）。
 * 例：food_apple: 'assets/images/apple.png'
 */
export const IMAGE_FILES: Record<string, string> = {};

/** 音樂與音效的 key（沒有填檔案的會用程式合成的 8-bit 聲音） */
export type MusicKey = 'bgm_menu' | 'bgm_game' | 'bgm_gameover';
export type SfxKey =
  | 'sfx_select' // 開始遊戲
  | 'sfx_catch' // 接到一般食物
  | 'sfx_steak' // 接到牛排
  | 'sfx_golden' // 接到金色食物（補心）
  | 'sfx_freeze' // 接到松阪豬（囤貨度暫停）
  | 'sfx_hurt' // 扣心
  | 'sfx_bomb' // 炸彈爆炸
  | 'sfx_bounce' // 食物被籃子彈開
  | 'sfx_full' // 籃子滿了
  | 'sfx_land' // 食物掉到地上
  | 'sfx_deposit' // 回巢卸貨
  | 'sfx_levelup'; // 升級

export const AUDIO = {
  musicVolume: 0.45,
  sfxVolume: 0.7,
};

/**
 * 正式音樂/音效：填上路徑就會取代合成的聲音（路徑相對於 public/，mp3/ogg/wav 都可以）。
 * 例：bgm_game: 'assets/audio/battle.mp3', sfx_catch: 'assets/audio/coin.wav'
 */
export const AUDIO_FILES: Partial<Record<MusicKey | SfxKey, string>> = {};

/** 烏鴉 sprite sheet（拍翅動畫，每格 128×128，橫排）。null 表示用暫代圖 */
export const CROW_SHEET_FILE: string | null = null;

/**
 * 披風 sprite sheet（飄動動畫，每格 176×128，橫排）。null 表示用暫代圖
 * 右邊 128px 和烏鴉的格子對齊，左邊多 48px 給披風尾端；脖子在 (132, 48)
 */
export const CAPE_SHEET_FILE: string | null = null;
