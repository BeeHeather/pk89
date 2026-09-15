import { emptyState, h, header } from '../ui.js';

export function renderAccounting(ctx) {
  return h('div', { class: 'screen' },
    header({ title: 'Учёт' }),
    h('div', { class: 'scroll' },
      emptyState('🗒️', 'Здесь пока пусто', 'Раздел «Учёт» появится позже.'),
    ),
  );
}
