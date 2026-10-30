import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio';
import { BASKET, BUILDING, CROW, DEBUG, FRENZY, FrenzyEvent, HEARTS, JUMP, NEST, STOCK, WORLD } from '../config';
import { Building } from '../objects/Building';
import { Crow, ITEM_SIZE } from '../objects/Crow';
import { fitSize, Food, FOOD_RADIUS } from '../objects/Food';
import {
  activeLedgeCount,
  frenzyAt,
  frenzyStart,
  levelAt,
  maxOnField,
  pickFood,
  spawnInterval,
  stockDecayPerSec,
} from '../rules';
import { drawLandscape } from '../scenery';
import { outlineStyle } from '../ui';

export type GameOverReason = 'stock' | 'hearts';

export interface HudState {
  stock: number;
  hearts: number;
  elapsed: number;
  level: number;
  basket: number;
  /** 囤貨度暫停剩下的秒數 */
  freeze: number;
  /** 瘋狂掉落：預告中（倒數到開始）或進行中（倒數到結束），沒有就是 null */
  frenzy: { phase: 'warn' | 'active'; name: string; seconds: number } | null;
}

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

/**
 * 主遊戲。對 UIScene 發出的事件：
 * - 'banner' (text)：扣心等大字提示
 * - 'levelup' (level)
 * - 'splat'：番茄汁噴到畫面
 */
export class GameScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private building!: Building;
  private nest!: Phaser.GameObjects.Image;
  private crow!: Crow;
  private debugGfx?: Phaser.GameObjects.Graphics;
  private keys?: Keys;

  private foods: Food[] = [];
  private drag = { x: 0, y: 0, lastX: 0, lastY: 0 };
  private zone = new Phaser.Geom.Rectangle();
  private groundY = 0;

  private stock = 0;
  private stockFreeze = 0;
  private hearts = 0;
  private elapsed = 0;
  private level = 1;
  private spawnTimer = 0;
  private fullHintCooldown = 0;
  private over = false;
  /** 已經開始過幾次瘋狂掉落 */
  private frenzyCount = 0;
  private frenzy: FrenzyEvent | null = null;
  private frenzyLeft = 0;
  private frenzyWarned = false;

  constructor() {
    super('Game');
  }

  get isOver() {
    return this.over;
  }

  get hud(): HudState {
    return {
      stock: this.stock,
      hearts: this.hearts,
      elapsed: this.elapsed,
      level: this.level,
      basket: this.crow.itemCount,
      freeze: this.stockFreeze,
      frenzy: this.frenzyHud(),
    };
  }

  private frenzyHud(): HudState['frenzy'] {
    if (this.frenzy) return { phase: 'active', name: this.frenzy.name, seconds: this.frenzyLeft };
    if (!this.frenzyWarned) return null;
    return { phase: 'warn', name: FRENZY.warnMessage, seconds: frenzyStart(this.frenzyCount) - this.elapsed };
  }

  create() {
    // scene.restart 會重用同一個物件，所以狀態要在這裡重設
    this.foods = [];
    this.drag = { x: 0, y: 0, lastX: 0, lastY: 0 };
    this.stock = STOCK.start;
    this.stockFreeze = 0;
    this.hearts = HEARTS.start;
    this.elapsed = 0;
    this.level = 1;
    this.spawnTimer = 0.8;
    this.fullHintCooldown = 0;
    this.over = false;
    this.frenzyCount = 0;
    this.frenzy = null;
    this.frenzyLeft = 0;
    this.frenzyWarned = false;

    this.bg = this.add.graphics().setDepth(0);
    this.building = new Building(this);
    this.nest = this.add.image(0, 0, 'nest').setOrigin(0.5, 1).setDepth(2);
    this.crow = new Crow(this, 0, 0);
    this.debugGfx = DEBUG ? this.add.graphics().setDepth(10) : undefined;

    this.setupInput();
    this.layout();
    this.crow.setPosition(this.zone.centerX, this.zone.centerY);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.scene.launch('UI');
    playMusic('bgm_game');
  }

  private setupInput() {
    this.keys = this.input.keyboard?.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D',
    }) as Keys | undefined;

    // 拖曳是「相對位移」：手指移多少，烏鴉就飛多少，不會瞬移到手指底下
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.drag.lastX = p.x;
      this.drag.lastY = p.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      this.drag.x += (p.x - this.drag.lastX) * CROW.dragSensitivity;
      this.drag.y += (p.y - this.drag.lastY) * CROW.dragSensitivity;
      this.drag.lastX = p.x;
      this.drag.lastY = p.y;
    });
  }

  private readDirection() {
    const k = this.keys;
    if (!k) return { x: 0, y: 0 };
    const x = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const y = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    return { x, y };
  }

  /** 依目前畫面大小擺放所有東西（EXPAND 模式下畫面寬高會變） */
  private layout() {
    const { width, height } = this.scale;
    this.groundY = height - WORLD.groundHeight;
    drawLandscape(this.bg, width, height, this.groundY);
    this.building.layout(width - BUILDING.rightMargin, this.groundY);
    this.nest.setPosition(NEST.x, this.groundY + 12);

    const top = this.building.ledgeY(0) + CROW.zoneTopBelowTopLedge;
    const bottom = this.groundY - CROW.zoneBottomAboveGround;
    const right = this.building.left - BUILDING.ledgeDepth - CROW.gapToBuilding - (CROW.beak.x + BASKET.rimHalfWidth);
    this.zone.setTo(CROW.zoneLeft, top, right - CROW.zoneLeft, bottom - top);

    for (const food of this.foods) {
      if (food.state !== 'warning') continue;
      const spot = this.building.foodSpot(food.ledge);
      food.setPosition(spot.x, spot.y);
    }
    this.crow.clampTo(this.zone);

    if (this.debugGfx) {
      this.debugGfx.clear().lineStyle(2, 0xff00ff, 1).strokeRectShape(this.zone);
      this.debugGfx.lineStyle(2, 0x00ffff, 1).strokeRect(
        NEST.x - NEST.depositHalfWidth, this.groundY - NEST.depositHeight, NEST.depositHalfWidth * 2, NEST.depositHeight,
      );
    }
  }

  update(_time: number, deltaMs: number) {
    if (this.over) return;
    // 限制最大 delta，避免切回分頁或暫停後一次跳太多
    const dt = Math.min(deltaMs, 50) / 1000;

    this.elapsed += dt;
    const level = levelAt(this.elapsed);
    if (level !== this.level) {
      this.level = level;
      this.events.emit('levelup', level);
      playSfx('sfx_levelup');
    }

    this.updateFrenzy(dt);

    this.crow.update(dt, this.readDirection(), this.drag, this.zone);
    this.fullHintCooldown -= dt;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawnFood()) this.spawnTimer = this.frenzy?.interval ?? spawnInterval(this.level);

    for (const food of this.foods) this.updateFood(food, dt);
    this.foods = this.foods.filter((f) => f.state !== 'gone');

    this.tryDeposit();

    if (this.stockFreeze > 0) this.stockFreeze = Math.max(0, this.stockFreeze - dt);
    else this.stock -= stockDecayPerSec(this.level) * dt;
    if (this.stock <= 0) {
      this.stock = 0;
      this.gameOver('stock');
    }
  }

  /** 瘋狂掉落：時間到前先預告，時間到就開始，持續 duration 秒 */
  private updateFrenzy(dt: number) {
    if (this.frenzy) {
      this.frenzyLeft -= dt;
      if (this.frenzyLeft > 0) return;
      this.frenzy = null;
      this.spawnTimer = spawnInterval(this.level);
    }

    const next = frenzyAt(this.frenzyCount);
    if (!next) return;
    const start = frenzyStart(this.frenzyCount);
    if (!this.frenzyWarned && this.elapsed >= start - FRENZY.warnSeconds) {
      this.frenzyWarned = true;
      playSfx('sfx_warn');
    }
    if (this.elapsed >= start) {
      this.frenzy = next;
      this.frenzyLeft = next.duration;
      this.frenzyCount++;
      this.frenzyWarned = false;
      this.spawnTimer = 0;
      playSfx('sfx_frenzy');
      this.cameras.main.shake(400, 0.006);
    }
  }

  private spawnFood(): boolean {
    const frenzy = this.frenzy;
    if (this.foods.length >= (frenzy?.maxOnField ?? maxOnField(this.level))) return false;
    const busy = new Set(this.foods.filter((f) => f.state === 'warning').map((f) => f.ledge));
    const free: number[] = [];
    const ledges = frenzy ? BUILDING.ledges : activeLedgeCount(this.level);
    for (let i = 0; i < ledges; i++) if (!busy.has(i)) free.push(i);
    if (free.length === 0) return false;

    const ledge = Phaser.Math.RND.pick(free);
    const spot = this.building.foodSpot(ledge);
    const food = new Food(this, pickFood(this.level, frenzy?.foods), ledge, spot.x, spot.y, JUMP.warnSeconds);
    if (frenzy && !frenzy.missHurts) food.missHurts = false;
    this.foods.push(food);
    return true;
  }

  private updateFood(food: Food, dt: number) {
    if (food.state === 'warning') {
      if (food.tickWarning(dt)) {
        const boost = 1 + (this.level - 1) * JUMP.speedUpPerLevel;
        food.jump(
          -Phaser.Math.FloatBetween(JUMP.vxMin, JUMP.vxMax) * boost,
          -Phaser.Math.FloatBetween(JUMP.vyMin, JUMP.vyMax),
        );
      }
      return;
    }
    if (food.state !== 'flying') return;

    food.step(dt, WORLD.gravity);
    if (food.catchable && food.vy > 0) this.checkBasket(food);
    if (food.state !== 'flying') return;

    if (food.y >= this.groundY - FOOD_RADIUS || food.x < -FOOD_RADIUS * 2) this.foodLanded(food);
  }

  private checkBasket(food: Food) {
    const rim = this.crow.rim();
    const dx = Math.abs(food.x - rim.x);
    const side = food.x < rim.x ? -1 : 1;

    // 從上方穿過籃口才算接住（用相對位置判斷，烏鴉往上衝時也接得到）
    const crossed = food.prevY <= this.crow.previousRimY && food.y >= rim.y;
    if (crossed && dx <= rim.halfWidth) {
      if (food.def.good && this.crow.isFull) {
        food.bounce(side);
        if (!this.hintFull()) playSfx('sfx_bounce');
      } else {
        this.catchFood(food);
      }
      return;
    }

    // 從側面撞到籃身 → 彈開
    const hitBody = dx <= rim.halfWidth + FOOD_RADIUS * 0.6 && food.y > rim.y && food.y < rim.y + BASKET.bodyHeight;
    if (hitBody) {
      food.bounce(side);
      playSfx('sfx_bounce');
    }
  }

  private catchFood(food: Food) {
    const def = food.def;
    food.remove();

    if (def.good) {
      this.crow.addItem(food.texture, def.stock);
      if (def.freezeSeconds) {
        this.stockFreeze = Math.max(this.stockFreeze, def.freezeSeconds);
        this.floatText(this.crow.x, this.crow.y - 60, `囤貨度暫停 ${def.freezeSeconds} 秒！`, '#9fe8ff', 24);
        playSfx('sfx_freeze');
      } else {
        playSfx(def.id === 'steak' ? 'sfx_steak' : def.id === 'golden' ? 'sfx_golden' : 'sfx_catch');
      }
      if (def.catchHeart > 0) this.gainHeart(def.catchHeart);
      return;
    }

    if (def.spillBasket) {
      this.crow.spill();
      this.boom(food.x, food.y);
      playSfx('sfx_bomb');
    }
    if (def.id === 'tomato') this.events.emit('splat');
    if (def.id === 'rotten') this.crow.makeDirty(BASKET.dirtySeconds);
    this.crow.stun(def.catchStun);
    this.loseHeart(-def.catchHeart, def.catchMessage, this.crow.x, this.crow.y - 60);
  }

  private foodLanded(food: Food) {
    food.land(this);
    if (food.def.id === 'bomb') {
      this.boom(food.x, food.y);
      playSfx('sfx_bomb', 0.5);
    } else {
      playSfx('sfx_land', 0.6);
    }
    if (food.missHurts && food.def.missHeart > 0) this.loseHeart(food.def.missHeart, food.def.missMessage, food.x, food.y - 40);
  }

  private tryDeposit() {
    if (this.crow.itemCount === 0 || this.crow.isStunned) return;
    const rim = this.crow.rim();
    if (Math.abs(rim.x - this.nest.x) > NEST.depositHalfWidth) return;
    if (rim.y < this.groundY - NEST.depositHeight) return;

    const items = this.crow.takeAll();
    const total = items.reduce((sum, it) => sum + it.stock, 0);
    this.stock = Math.min(STOCK.max, this.stock + total);

    items.forEach((item, i) => {
      const img = this.add.image(rim.x, rim.y, item.texture).setDepth(5);
      fitSize(img, ITEM_SIZE);
      this.tweens.add({
        targets: img,
        x: this.nest.x + Phaser.Math.Between(-40, 40),
        y: this.nest.y - 45,
        duration: 300,
        delay: i * 50,
        onComplete: () => img.destroy(),
      });
    });
    this.floatText(this.nest.x, this.nest.y - 110, `+${total}`, '#7cfc7c');
    playSfx('sfx_deposit');
  }

  private loseHeart(amount: number, message: string | undefined, x: number, y: number) {
    this.hearts = Math.max(0, this.hearts - amount);
    if (message) this.events.emit('banner', message);
    this.floatText(x, y, '-1', '#ff5a5a', 36, 'heart_full');
    playSfx('sfx_hurt');
    this.cameras.main.shake(180, 0.008);
    if (this.hearts <= 0) this.gameOver('hearts');
  }

  private gainHeart(amount: number) {
    this.hearts = Math.min(HEARTS.max, this.hearts + amount);
    this.floatText(this.crow.x, this.crow.y - 60, `+${amount}`, '#ffd700', 36, 'heart_full');
  }

  /** 提示「籃子滿了」，冷卻中回傳 false */
  private hintFull(): boolean {
    if (this.fullHintCooldown > 0) return false;
    this.fullHintCooldown = 1.5;
    this.floatText(this.crow.x, this.crow.y - 70, '籃子滿了！快回巢', '#ffffff', 24);
    playSfx('sfx_full');
    return true;
  }

  /** 飄起來淡出的文字；icon 是放在文字右邊的小圖（例如愛心） */
  private floatText(x: number, y: number, text: string, color: string, size = 36, icon?: string) {
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.text(0, 0, text, outlineStyle(size, color)).setOrigin(icon ? 1 : 0.5, 0.5),
    ];
    if (icon) parts.push(this.add.image(4, 0, icon).setOrigin(0, 0.5));
    const c = this.add.container(x, y, parts).setDepth(6);
    this.tweens.add({ targets: c, y: y - 50, alpha: 0, duration: 1000, onComplete: () => c.destroy() });
  }

  /** 炸彈爆炸的像素火花 */
  private boom(x: number, y: number) {
    const img = this.add.image(x, y, 'fx_boom').setDepth(6).setScale(0.5);
    this.tweens.add({ targets: img, scale: 1.5, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  private gameOver(reason: GameOverReason) {
    if (this.over) return;
    this.over = true;
    if (reason === 'stock') this.events.emit('banner', '存糧見底了…');
    playMusic('bgm_gameover');
    // 停一下，讓玩家看清楚是怎麼輸的
    this.time.delayedCall(1600, () => {
      this.scene.stop('UI');
      this.scene.start('GameOver', { reason, time: this.elapsed });
    });
  }
}
