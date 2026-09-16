import { clear, h, handlePop, pushOverlay, runCleanups, toast } from './ui.js';
import { flushState, loadState, requestPersistence, saveState } from './store.js';
import { maybeSendDailyBackup } from './backup.js';
import { syncPackings, syncRequests } from './sync.js';
import { renderProducts } from './views/products.js';
import { renderRecipe } from './views/recipe.js';
import { renderPacking } from './views/packing.js';
import { renderAccounting } from './views/accounting.js';
import { renderRequests } from './views/requests.js';

const TABS = [
  { id: 'products', title: 'Рецептура' },
  { id: 'packing', title: 'Фасовка' },
  { id: 'requests', title: 'Заявки' },
  { id: 'accounting', title: 'Учёт' },
];

const root = document.getElementById('root');

const route = { tab: 'products', productId: null };
let state = null;

/** Контекст, который получают все экраны. */
const ctx = {
  get state() { return state; },
  update,
  updateQuiet,
  openProduct,
  render,
  toast,
  syncRequests: () => syncRequests(ctx),
  syncPackings: () => syncPackings(ctx),
};

/** Изменить данные и перерисовать. Мутатор работает с копией. */
function update(mutator) {
  const draft = structuredClone(state);
  mutator(draft);
  state = draft;
  saveState(state);
  render();
}

/**
 * То же, но без перерисовки: нужно кликеру, который сам подкрашивает
 * счётчик и кольцо — перестраивать весь экран на каждое касание незачем.
 */
function updateQuiet(mutator) {
  const draft = structuredClone(state);
  mutator(draft);
  state = draft;
  saveState(state);
}

function openProduct(id) {
  route.productId = id;
  render();
  pushOverlay(() => {
    route.productId = null;
    render();
  });
}

function render() {
  const product = route.productId
    ? state.products.find((p) => p.id === route.productId)
    : null;

  // карточку могли удалить, пока экран открыт
  if (route.productId && !product) route.productId = null;

  runCleanups();
  clear(root);

  if (product) {
    root.appendChild(renderRecipe(ctx, product));
    return;
  }

  const screen = h('div', { class: 'screen' });
  if (route.tab === 'products') screen.appendChild(renderProducts(ctx));
  else if (route.tab === 'packing') screen.appendChild(renderPacking(ctx));
  else if (route.tab === 'requests') screen.appendChild(renderRequests(ctx));
  else screen.appendChild(renderAccounting(ctx));

  screen.appendChild(renderTabs());
  root.appendChild(screen);
}

function renderTabs() {
  return h('nav', { class: 'tabbar' },
    TABS.map((tab) => h('button', {
      class: tab.id === route.tab ? 'on' : '',
      type: 'button',
      onclick: () => {
        if (route.tab === tab.id) return;
        route.tab = tab.id;
        render();
        // вход на общий раздел подтягивает свежие данные с сервера
        if (tab.id === 'requests') syncRequests(ctx);
        if (tab.id === 'accounting') syncPackings(ctx);
      },
    }, tab.title)),
  );
}

// ---------- запуск ----------

window.addEventListener('popstate', () => {
  handlePop();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushState();
});

window.addEventListener('pagehide', () => {
  flushState();
});

async function start() {
  history.replaceState({ pk89: 0 }, '');
  state = await loadState();
  render();

  requestPersistence();
  maybeSendDailyBackup(state);
  syncRequests(ctx);
  syncPackings(ctx);

  // вернулась сеть — дольём накопленные офлайн изменения
  window.addEventListener('online', () => {
    syncRequests(ctx);
    syncPackings(ctx);
  });

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (error) {
      console.warn('Service worker не зарегистрировался', error);
    }
  }
}

start().catch((error) => {
  console.error(error);
  root.appendChild(h('div', { class: 'empty' },
    h('div', { class: 'e' }, '⚠️'),
    h('h3', {}, 'Не удалось запустить'),
    h('p', {}, String(error?.message || error)),
  ));
});
