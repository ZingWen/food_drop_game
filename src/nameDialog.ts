import { LEADERBOARD } from './config';
import { lastPlayerName, rememberName, setPlayer } from './leaderboard';

/**
 * 開局前問玩家名稱。用 HTML 輸入框（手機鍵盤、中文輸入法才能正常用），
 * 放在 #game 裡面，全螢幕時才看得到。
 */

let dialog: HTMLElement | null = null;

function build(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'name-dialog';
  root.innerHTML = `
    <form class="rpg-window">
      <h2>你是哪隻烏鴉？</h2>
      <input name="player" type="text" autocomplete="nickname" enterkeyhint="go"
        maxlength="${LEADERBOARD.nameMaxLength}" placeholder="輸入名稱" />
      <p>用同一個名稱會記住最佳時間，登上${LEADERBOARD.title}！</p>
      <div class="buttons">
        <button type="submit" class="primary">開始</button>
        <button type="button" data-guest>當訪客</button>
      </div>
    </form>`;
  // 不讓按鍵、點擊傳到 Phaser（它在 window 上聽，打字時會觸發空白鍵開始、M 靜音）
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
    root.addEventListener(type, (e) => e.stopPropagation());
  }
  (document.getElementById('game') ?? document.body).appendChild(root);
  return root;
}

/** 顯示名稱輸入框，選好之後（名稱或訪客）resolve */
export function askPlayerName(): Promise<void> {
  dialog ??= build();
  const root = dialog;
  const form = root.querySelector('form')!;
  const input = root.querySelector('input')!;
  const guest = root.querySelector<HTMLButtonElement>('[data-guest]')!;
  input.value = lastPlayerName();
  root.classList.add('show');
  const openedAt = performance.now();
  // 手機不自動聚焦，免得鍵盤一跳出來就把畫面蓋住。
  // 等一下再聚焦：按空白鍵開始時，那個空白字元會打進輸入框，把預填的名稱蓋掉
  if (!window.matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  }

  return new Promise((resolve) => {
    const done = (name: string | null) => {
      // 剛打開時的點擊可能是上一個畫面的殘留，不算
      if (performance.now() - openedAt < 300) return;
      form.removeEventListener('submit', onSubmit);
      guest.removeEventListener('click', onGuest);
      input.blur();
      root.classList.remove('show');
      rememberName(input.value);
      setPlayer(name);
      resolve();
    };
    const onSubmit = (e: Event) => {
      e.preventDefault();
      done(input.value);
    };
    const onGuest = () => done(null);
    form.addEventListener('submit', onSubmit);
    guest.addEventListener('click', onGuest);
  });
}
