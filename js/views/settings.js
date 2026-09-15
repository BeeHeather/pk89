import { button, confirmDialog, h, openSheet, shareOrDownload } from '../ui.js';
import { todayIso } from '../format.js';
import { exportJson, importJson } from '../store.js';
import { sendBackup } from '../backup.js';

export function openSettings(ctx) {
  openSheet('Настройки', (close) => {
    // ---- восстановление из файла ----

    const picker = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });

    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];
      picker.value = '';
      if (!file) return;

      const ok = await confirmDialog({
        title: 'Заменить все данные?',
        message: 'Рецептура, заявки, учёт и настройки из файла полностью заменят текущие. Отменить это будет нельзя.',
        confirmText: 'Заменить',
      });
      if (!ok) return;

      try {
        const imported = await importJson(file);
        ctx.update((s) => { Object.assign(s, imported); });
        ctx.toast('Данные загружены из копии');
        close();
      } catch (error) {
        console.error(error);
        ctx.toast('Не удалось прочитать файл — похоже, это не копия приложения', { error: true });
      }
    });

    // ---- автокопия на почту ----

    const sendNow = button('Отправить на почту сейчас', async () => {
      try {
        await sendBackup(ctx.state);
        ctx.toast('Отправлено — проверьте почту');
      } catch (error) {
        console.error(error);
        ctx.toast(`Не удалось отправить: ${error?.message || error}`, { error: true });
      }
    }, { wide: true });

    return [
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Резервная копия' }),
        h('p', { class: 'hint', style: { marginBottom: '10px' } },
          'Все данные хранятся только на этом телефоне. Скачайте копию перед сменой устройства или чисткой браузера.'),
        h('div', { class: 'btn-row' },
          button('Скачать копию', async () => {
            const result = await shareOrDownload(
              exportJson(ctx.state), `polevaya-kuhnya-89-${todayIso()}.json`, 'Резервная копия');
            if (result === 'downloaded') ctx.toast('Копия сохранена в загрузки');
          }),
          button('Загрузить из резервной копии', () => picker.click()),
        ),
        picker,
      ),
      h('div', { class: 'block' },
        h('p', { class: 'label', text: 'Автокопия на почту' }),
        h('p', { class: 'hint', style: { marginBottom: '10px' } },
          'Раз в сутки при открытии приложение само отправляет копию на почту. Кнопка ниже — чтобы отправить не дожидаясь.'),
        sendNow,
      ),
    ];
  });
}
