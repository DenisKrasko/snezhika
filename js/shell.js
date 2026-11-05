/* ============================================================
   Wise shell: приложение — обычная страница (шапка + разделы),
   всплывающие карточки по центру, плоские диалоги.
   Без оконных рамок: нет заголовков с кнопками, перетаскивания,
   разворачивания и часов в трее. Работает без зависимостей и с file://
   ============================================================ */
window.Shell = (function () {
  const desk = () => document.getElementById('desktop');
  let zTop = 100;
  const wins = new Map();
  let seq = 0;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Крестик рисуем геометрией, а не шрифтовой буквой: только так он стоит
  // ровно по центру круглой кнопки.
  const glyph = (kind) => '<svg width="16" height="16" viewBox="0 0 12 12" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" focusable="false" aria-hidden="true">' +
    (kind === 'close' ? '<path d="M2 2 10 10M10 2 2 10"/>' : '') + '</svg>';

  // Знак бренда — лист вместо оконной иконки: отсылка к зелёному акценту темы.
  const LEAF = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M12.8 3.1c-6.1.2-9.2 3-9.2 7.2 0 .9.1 1.6.1 1.6s5-.4 7.5-3.8c1.8-2.5 1.6-5 1.6-5z" fill="#0d2a06"/>' +
    '<path d="M4.3 12.2c1.4-2.9 3.7-4.7 6-5.8" stroke="#bae79a" stroke-width="1.2" stroke-linecap="round"/></svg>';

  const statusHtml = (text, text2) =>
    '<span class="cell grow">' + esc(text) + '</span>' +
    '<span class="cell" data-status2>' + esc(text2 || '') + '</span>';

  /* ---------- сборка разметки ---------- */
  // Главное окно (chrome:false) = страница: шапка с брендом и разделами,
  // крупный заголовок раздела, содержимое, тонкая строка состояния внизу.
  function buildApp(el, cfg) {
    el.className = 'app';
    el.dataset.id = cfg.id;
    el.innerHTML =
      '<header class="topbar">' +
      '<span class="brand"><span class="b-dot">' + LEAF + '</span>Садовод-посредник</span>' +
      (cfg.toolbar !== undefined ? '<nav class="toolbar" data-toolbar></nav>' : '') +
      '</header>' +
      '<div class="page-head"><span class="t-text">' + esc(cfg.title || '') + '</span></div>' +
      '<main class="win-body" data-body></main>' +
      (cfg.status !== false ? '<footer class="statusbar" data-status>' + statusHtml(cfg.status || 'Готово', cfg.status2) + '</footer>' : '');
  }

  // Всплывающее окно = карточка по центру затемнения.
  function buildSheet(el, cfg) {
    el.className = 'sheet';
    el.dataset.id = cfg.id;
    el.style.setProperty('--w', Math.min(cfg.w || 620, window.innerWidth - 48) + 'px');
    el.innerHTML =
      '<header class="sheet-head">' +
      (cfg.icon ? '<span class="t-ico">' + ico(cfg.icon, 20) + '</span>' : '') +
      '<span class="t-text">' + esc(cfg.title) + '</span>' +
      '<button class="x" data-x aria-label="Закрыть">' + glyph('close') + '</button>' +
      '</header>' +
      (cfg.menu ? '<div class="menubar" data-menu></div>' : '') +
      '<main class="win-body" data-body></main>' +
      (cfg.status !== false ? '<footer class="statusbar" data-status>' + statusHtml(cfg.status || 'Готово', cfg.status2) + '</footer>' : '');
  }

  /* ---------- window ---------- */
  function openWindow(cfg) {
    const id = cfg.id || ('w' + (++seq));
    if (wins.has(id)) { if (cfg.reveal) cfg.reveal(); return wins.get(id).api; }

    const chrome = cfg.chrome !== false;
    let host = null;
    const el = document.createElement('div');

    if (chrome) {
      host = document.createElement('div');
      host.className = 'sheet-host';
      host.style.zIndex = ++zTop;
      buildSheet(el, cfg);
      host.appendChild(el);
      document.body.appendChild(host);
    } else {
      buildApp(el, cfg);
      desk().appendChild(el);
    }

    const tryClose = () => { (cfg.onClose ? cfg.onClose(id) : true) !== false && close(id); };

    const api = {
      id, el,
      body: el.querySelector('[data-body]'),
      setTitle(t) { el.querySelector('.t-text').textContent = t; },
      setStatus(t, t2) {
        const c = el.querySelector('[data-status]');
        if (!c) return;
        c.children[0].textContent = t;
        if (t2 !== undefined && c.children[1]) c.children[1].textContent = t2;
      },
      close() { close(id); },
      menu(items) { buildMenu(el.querySelector('[data-menu]'), items); },
      toolbar(html) { const t = el.querySelector('[data-toolbar]'); if (t) t.innerHTML = html; },
      status2(html) { const s = el.querySelector('[data-status2]'); if (s) s.innerHTML = html; },
      // Кнопка «Закрыть» встаёт в правый конец ряда с остальными кнопками карточки.
      // Перерисовка тела её стирает, поэтому вьюхи с paint() вызывают closeBtn() в конце отрисовки.
      closeBtn() {
        if (!chrome) return;
        const bind = (bar, html) => {
          bar.insertAdjacentHTML('beforeend', html);
          const btn = bar.querySelector('[data-a="wclose"]');
          if (btn) btn.addEventListener('click', tryClose);
        };
        let bar = el.querySelector('.win-body [data-btnrow]');
        if (!bar) {
          const bars = el.querySelectorAll('.win-body .toolbar');
          bar = bars[bars.length - 1];
        }
        if (bar) {
          if (bar.querySelector('[data-a="wclose"]')) return;
          if (!bar.querySelector('.spacer')) bind(bar, '<span class="spacer"></span>');
          bind(bar, '<button class="btn" data-a="wclose">Закрыть</button>');
          return;
        }
        bind(api.body, '<div class="toolbar mid" data-btnrow><button class="btn" data-a="wclose">Закрыть</button></div>');
      }
    };

    const rec = { id, el, host, api, cfg };
    wins.set(id, rec);

    if (chrome) {
      el.querySelector('[data-x]').addEventListener('click', tryClose);
      // Клик по затемнению вокруг карточки тоже закрывает её — как принято в вебе.
      host.addEventListener('pointerdown', (e) => { if (e.target === host) tryClose(); });
      rec.onKey = (e) => { if (e.key === 'Escape') tryClose(); };
      document.addEventListener('keydown', rec.onKey);
    }

    if (cfg.menu) api.menu(cfg.menu);
    if (typeof cfg.toolbar === 'string') api.toolbar(cfg.toolbar);
    if (cfg.render) cfg.render(api);
    // closeBtn:false — у карточки уже есть своя кнопка действия (например «Понятно»),
    // вторая «Закрыть» рядом не нужна: крестик в шапке и Esc остаются.
    if (cfg.closeBtn !== false) api.closeBtn();

    return api;
  }

  function close(id) {
    const r = wins.get(id);
    if (!r) return;
    if (r.onKey) document.removeEventListener('keydown', r.onKey);
    (r.host || r.el).remove();
    wins.delete(id);
  }

  /* ---------- меню с выпадающими списками ---------- */
  function buildMenu(bar, groups) {
    bar.innerHTML = '';
    groups.forEach((g) => {
      const mi = document.createElement('div');
      mi.className = 'mi';
      mi.innerHTML = g.label.replace(/&(\p{L})/u, '<span class="u">$1</span>');
      bar.appendChild(mi);
      if (!g.items) { mi.addEventListener('click', () => g.action && g.action()); return; }
      const dd = document.createElement('div');
      dd.className = 'menu';
      dd.style.display = 'none';
      g.items.forEach((it) => {
        if (it === '-') { const s = document.createElement('div'); s.className = 'sep'; dd.appendChild(s); return; }
        const n = document.createElement('div');
        n.className = 'mi' + (it.dis ? ' dis' : '') + (it.check ? ' chk' : '') + (it.sub ? ' sub' : '');
        n.innerHTML = (it.icon ? '<span style="margin-right:6px;display:inline-block;vertical-align:-3px">' + ico(it.icon, 16) + '</span>' : '') + esc(it.label);
        n.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (it.dis) return;
          hideAll();
          it.action && it.action();
        });
        dd.appendChild(n);
      });
      // Подложка привязана к своему пункту, а не к строке меню: тогда она не уезжает,
      // когда пункты переносятся на новую строку.
      mi.appendChild(dd);
      mi.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const open = dd.style.display === 'block';
        hideAll();
        if (!open) { dd.style.display = 'block'; mi.classList.add('open'); }
      });
    });
  }

  function hideAll() {
    document.querySelectorAll('.menu').forEach((m) => (m.style.display = 'none'));
    document.querySelectorAll('.menubar .mi').forEach((m) => m.classList.remove('open'));
  }
  document.addEventListener('click', hideAll);

  /* ---------- диалоги ---------- */
  let lastForm = null;
  function dialog(cfg) {
    return new Promise((resolve) => {
      const m = document.getElementById('modal');
      m.classList.add('show');
      const box = document.createElement('div');
      box.className = 'dlg';
      const icon = cfg.icon ? '<div style="flex:none">' + ico(cfg.icon, 32) + '</div>' : '';
      box.innerHTML =
        '<div class="head"><span class="t-text">' + esc(cfg.title || 'Внимание') + '</span>' +
        '<button class="x" data-x aria-label="Закрыть">' + glyph('close') + '</button></div>' +
        '<div class="row">' + icon + '<div class="msg">' + (cfg.html ? cfg.text : esc(cfg.text).replace(/\n/g, '<br>')) + '</div></div>' +
        (cfg.form ? '<div data-form style="padding:0 22px 6px">' + cfg.form + '</div>' : '') +
        '<div class="acts">' + (cfg.buttons || ['OK']).map((b, i) =>
          '<button class="btn' + (i === 0 ? ' def' : '') + '" data-b="' + esc(b) + '">' + esc(b) + '</button>').join('') +
        '</div>';
      m.appendChild(box);
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      const done = (v) => {
        lastForm = cfg.form ? box : null;
        document.removeEventListener('keydown', onKey);
        box.remove();
        if (!m.children.length) m.classList.remove('show');
        resolve(v);
      };
      document.addEventListener('keydown', onKey);
      box.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => done(b.dataset.b)));
      box.querySelector('[data-x]').addEventListener('click', () => done(null));
      const fi = box.querySelector('[data-form] input');
      if (fi) { fi.focus(); fi.addEventListener('keydown', (e) => { if (e.key === 'Enter') done((cfg.buttons || ['OK'])[0]); }); }
    });
  }
  const formValue = (sel) => {
    const n = lastForm && lastForm.querySelector(sel);
    return n ? n.value : null;
  };

  const alert = (text, title) => dialog({ text, title: title || 'Внимание', icon: 'info', buttons: ['OK'] });
  const confirm = (text, title) => dialog({ text, title: title || 'Подтверждение', icon: 'warn', buttons: ['Да', 'Нет'] }).then((v) => v === 'Да');
  const prompt = (text, def, title) => dialog({
    text, title: title || 'Ввод', icon: 'key',
    form: '<input type="text" style="width:100%" value="' + esc(def || '') + '">',
    buttons: ['OK', 'Отмена']
  }).then((v) => (v === 'OK' ? formValue('[data-form] input') : null));

  /* ---------- boot ---------- */
  function boot(cfg) {
    cfg.onBoot && cfg.onBoot();
  }

  return { openWindow, close, dialog, alert, confirm, prompt, boot, esc, formValue, getWin: (id) => wins.get(id) && wins.get(id).api };
})();
