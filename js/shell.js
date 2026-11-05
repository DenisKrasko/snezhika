/* ============================================================
   Win98 shell: full-page app window, floating windows,
   dialogs. No dependencies, works from file://
   ============================================================ */
window.Shell = (function () {
  const desk = () => document.getElementById('desktop');
  let zTop = 10;
  const wins = new Map();
  let focused = null;
  let seq = 0;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Знаки кнопок шапки рисуем геометрией, а не шрифтовой буквой: только так крестик
  // становится крупным и стоит ровно по центру кнопки при любой неактивной расцветке
  // (stroke="currentColor" наследует серый цвет неактивного окна).
  const GLYPH = {
    close: '<path d="M2 2 10 10M10 2 2 10"/>',
    max: '<rect x="2" y="2" width="8" height="8" fill="none"/><path d="M2 4.4h8" stroke-width="2.6"/>',
    restore: '<rect x="2" y="4" width="7" height="7" fill="none"/><path d="M4.5 2h7.5v7.5"/>'
  };
  const glyph = (kind) => '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="square" focusable="false" aria-hidden="true">' +
    GLYPH[kind] + '</svg>';

  const clampPos = (x, y, w, h) => {
    const d = desk().getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(x, Math.max(0, d.width - w))),
      y: Math.max(0, Math.min(y, Math.max(0, d.height - h)))
    };
  };

  /* ---------- window ---------- */
  function openWindow(cfg) {
    const id = cfg.id || ('w' + (++seq));
    if (wins.has(id)) { focus(id); if (cfg.reveal) cfg.reveal(); return wins.get(id).api; }

    const chrome = cfg.chrome !== false;
    const el = document.createElement('div');
    el.className = 'win' + (chrome ? '' : ' static');
    el.dataset.id = id;
    if (chrome) {
      const d = desk().getBoundingClientRect();
      const w = Math.min(cfg.w || 620, d.width - 12);
      const h = Math.min(cfg.h || 440, d.height - 12);
      const pos = clampPos(cfg.x != null ? cfg.x : Math.round((d.width - w) / 2) + (wins.size * 18),
        cfg.y != null ? cfg.y : Math.max(6, Math.round((d.height - h) / 2) - 20 + (wins.size * 14)), w, h);
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    }

    const right = chrome
      ? '<span class="t-btns">' +
      '<button class="tbtn" data-a="max" title="Развернуть" aria-label="Развернуть">' + glyph('max') + '</button>' +
      '<button class="tbtn" data-a="close" title="Закрыть" aria-label="Закрыть">' + glyph('close') + '</button>' +
      '</span>'
      : '';

    // Часы живут в правом конце строки состояния основного окна, а не в шапке.
    const tray = '<div id="tray">' + ico('network', 14) + ico('clock', 14) + '<span id="clock"></span></div>';

    el.innerHTML =
      '<div class="titlebar">' +
      (cfg.icon ? '<span class="t-ico">' + ico(cfg.icon, 14) + '</span>' : '') +
      '<span class="t-text">' + esc(cfg.title) + '</span>' +
      right + '</div>' +
      (cfg.menu ? '<div class="menubar" data-menu></div>' : '') +
      (cfg.toolbar ? '<div class="toolbar" data-toolbar></div>' : '') +
      '<div class="win-body" data-body></div>' +
      (cfg.status !== false ? '<div class="statusbar" data-status><span class="cell panel grow">' + esc(cfg.status || 'Готово') + '</span><span class="cell panel" data-status2>' + esc(cfg.status2 || '') + '</span>' + (chrome ? '' : tray) + '</div>' : '') +
      (chrome ? '<div class="grip" data-grip style="position:absolute;right:0;bottom:0;width:12px;height:12px;cursor:se-resize"></div>' : '');

    desk().appendChild(el);

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
      focus() { focus(id); },
      maximize(on) { toggleMax(id, on); },
      menu(items) { buildMenu(el.querySelector('[data-menu]'), items); },
      toolbar(html) { const t = el.querySelector('[data-toolbar]'); if (t) { t.innerHTML = html; } },
      status2(html) { const s = el.querySelector('[data-status2]'); if (s) s.innerHTML = html; },
      // Кнопка «Закрыть» становится в правый конец строки с остальными кнопками окна (data-btnrow).
      // Своих кнопок нет — ставим её по центру отдельной строкой. Перерисовка тела её стирает,
      // поэтому вьюхи с paint() вызывают closeBtn() в конце своей отрисовки.
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

    const rec = { id, el, api, cfg, max: false, restore: null, static: !chrome };
    wins.set(id, rec);

    if (chrome) {
      el.addEventListener('mousedown', () => focus(id), true);
      el.querySelector('.titlebar').addEventListener('dblclick', (e) => {
        if (e.target.closest('.tbtn')) return; toggleMax(id);
      });
      el.querySelector('.titlebar').addEventListener('pointerdown', (e) => startDrag(e, id));
      el.querySelector('[data-grip]').addEventListener('pointerdown', (e) => startResize(e, id));
      el.querySelectorAll('.tbtn').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = b.dataset.a;
        if (a === 'close') tryClose();
        if (a === 'max') toggleMax(id);
      }));
    }

    if (cfg.menu) api.menu(cfg.menu);
    if (cfg.toolbar && typeof cfg.toolbar === 'string') api.toolbar(cfg.toolbar);
    syncVeil();
    if (cfg.render) cfg.render(api);
    api.closeBtn();

    focus(id);
    return api;
  }

  function close(id) {
    const r = wins.get(id);
    if (!r) return;
    r.el.remove();
    wins.delete(id);
    if (focused === id) focused = null;
    const rest = [...wins.values()].filter((x) => !x.static);
    if (rest.length) focus(rest[rest.length - 1].id);
    syncVeil();
  }

  function focus(id) {
    const r = wins.get(id);
    if (!r || r.static) return;
    [...wins.values()].forEach((x) => { if (!x.static) x.el.classList.remove('active'); });
    r.el.classList.add('active');
    r.el.style.zIndex = ++zTop;
    focused = id;
  }

  // Пока открыто хоть одно всплывающее окно, основное окно под точечной маской и без кликов.
  function syncVeil() {
    desk().classList.toggle('haswin', [...wins.values()].some((x) => !x.static));
  }

  function toggleMax(id, force) {
    const r = wins.get(id);
    if (!r || r.static) return;
    const d = desk().getBoundingClientRect();
    const want = force != null ? force : !r.max;
    if (want) {
      r.restore = { l: r.el.style.left, t: r.el.style.top, w: r.el.style.width, h: r.el.style.height };
      r.el.style.left = '0px'; r.el.style.top = '0px';
      r.el.style.width = d.width + 'px'; r.el.style.height = d.height + 'px';
      r.max = true;
    } else if (r.restore) {
      Object.assign(r.el.style, { left: r.restore.l, top: r.restore.t, width: r.restore.w, height: r.restore.h });
      r.max = false;
    }
    const mb = r.el.querySelector('[data-a="max"]');
    if (mb) mb.innerHTML = r.max ? glyph('restore') : glyph('max');
    if (r.cfg.onResize) r.cfg.onResize(r.api);
    focus(id);
  }

  function startDrag(e, id) {
    if (e.target.closest('.tbtn')) return;
    const r = wins.get(id);
    if (!r || r.max) return;
    e.preventDefault();
    const d = desk().getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const ox = r.el.offsetLeft, oy = r.el.offsetTop;
    const move = (ev) => {
      const nx = Math.max(-r.el.offsetWidth + 60, Math.min(ox + ev.clientX - sx, d.width - 40));
      const ny = Math.max(0, Math.min(oy + ev.clientY - sy, d.height - 24));
      r.el.style.left = nx + 'px'; r.el.style.top = ny + 'px';
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  function startResize(e, id) {
    e.preventDefault(); e.stopPropagation();
    const r = wins.get(id);
    if (!r || r.max) return;
    const d = desk().getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const ow = r.el.offsetWidth, oh = r.el.offsetHeight;
    const move = (ev) => {
      r.el.style.width = Math.max(260, Math.min(ow + ev.clientX - sx, d.width - r.el.offsetLeft)) + 'px';
      r.el.style.height = Math.max(160, Math.min(oh + ev.clientY - sy, d.height - r.el.offsetTop)) + 'px';
      if (r.cfg.onResize) r.cfg.onResize(r.api);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  /* ---------- menubar with dropdowns ---------- */
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
      dd.style.left = mi.offsetLeft + 'px';
      dd.style.top = '100%';
      g.items.forEach((it) => {
        if (it === '-') { const s = document.createElement('div'); s.className = 'sep'; dd.appendChild(s); return; }
        const n = document.createElement('div');
        n.className = 'mi' + (it.dis ? ' dis' : '') + (it.check ? ' chk' : '') + (it.sub ? ' sub' : '');
        n.innerHTML = (it.icon ? '<span style="margin-right:4px;display:inline-block;vertical-align:-2px">' + ico(it.icon, 14) + '</span>' : '') + esc(it.label);
        n.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (it.dis) return;
          hideAll();
          it.action && it.action();
        });
        dd.appendChild(n);
      });
      bar.appendChild(dd);
      mi.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const open = dd.style.display === 'block';
        hideAll();
        if (!open) { dd.style.display = 'block'; mi.classList.add('open'); }
      });
    });
  }

  function hideAll() {
    document.querySelectorAll('.menubar .menu').forEach((m) => (m.style.display = 'none'));
    document.querySelectorAll('.menubar .mi').forEach((m) => m.classList.remove('open'));
  }
  document.addEventListener('click', hideAll);

  /* ---------- dialogs ---------- */
  let lastForm = null;
  function dialog(cfg) {
    return new Promise((resolve) => {
      const m = document.getElementById('modal');
      m.classList.add('show');
      // Пока открыт модальный диалог, все окна под затемнением — неактивные (серые шапки), как в Win98.
      document.body.classList.add('modal');
      const box = document.createElement('div');
      box.className = 'dlg';
      const icon = cfg.icon ? '<div style="flex:none">' + ico(cfg.icon, 32) + '</div>' : '';
      box.innerHTML =
        '<div class="titlebar"><span class="t-ico">' + ico(cfg.icon || 'info', 14) + '</span>' +
        '<span class="t-text">' + esc(cfg.title || 'Внимание') + '</span>' +
        '<span class="t-btns"><button class="tbtn" data-x aria-label="Закрыть">' + glyph('close') + '</button></span></div>' +
        '<div class="row">' + icon + '<div class="msg">' + (cfg.html ? cfg.text : esc(cfg.text).replace(/\n/g, '<br>')) + '</div></div>' +
        (cfg.form ? '<div data-form style="padding:0 12px 6px">' + cfg.form + '</div>' : '') +
        '<div class="acts">' + (cfg.buttons || ['OK']).map((b, i) =>
          '<button class="btn' + (i === 0 ? ' def' : '') + '" data-b="' + esc(b) + '">' + esc(b) + '</button>').join('') +
        '</div>';
      m.appendChild(box);
      const done = (v) => {
        lastForm = cfg.form ? box : null;
        box.remove();
        if (!m.children.length) { m.classList.remove('show'); document.body.classList.remove('modal'); }
        resolve(v);
      };
      box.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => done(b.dataset.b)));
      box.querySelector('[data-x]').addEventListener('click', () => done(null));
      const fi = box.querySelector('[data-form] input');
      if (fi) { fi.focus(); fi.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(( cfg.buttons || ['OK'])[0]); }); }
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); });
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

  /* ---------- tray clock ---------- */
  function tickClock() {
    const c = document.getElementById('clock');
    if (!c) return;
    const d = new Date();
    c.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ---------- boot ---------- */
  function boot(cfg) {
    cfg.onBoot && cfg.onBoot();
    tickClock();
    setInterval(tickClock, 10000);
  }

  return { openWindow, close, focus, toggleMax, dialog, alert, confirm, prompt, boot, esc, wins, formValue, getWin: (id) => wins.get(id) && wins.get(id).api };
})();
