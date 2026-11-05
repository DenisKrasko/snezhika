/* ============================================================
   Садовод-посредник 98 — разделы кабинета поверх Win98-оболочки
   ============================================================ */
(function () {
  const D = window.DATA;
  const esc = Shell.esc;
  const LS = 'sadpos98:v1';

  /* ---------------- state ---------------- */
  const state = {
    logged: false,
    view: 'sellers',
    fav: [], black: [],
    orders: JSON.parse(JSON.stringify(D.orders)),
    collections: JSON.parse(JSON.stringify(D.collections)),
    balance: JSON.parse(JSON.stringify(D.balance)),
    goods: JSON.parse(JSON.stringify(D.goods)),
    votes: {},
    filters: {
      sellers: { tc: '', cat: '', q: '', sort: 'rating', dir: -1, page: 1, list: 'all' },
      orders: { status: '', q: '' },
      goods: { cat: 'Все товары', q: '', sup: '' },
      balance: { type: '' }
    },
    collTab: 'Мои'
  };

  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        logged: state.logged, fav: state.fav, black: state.black,
        orders: state.orders, collections: state.collections, balance: state.balance, votes: state.votes
      }));
    } catch (e) { /* приватный режим — работаем в памяти */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS);
      if (!raw) return;
      const s = JSON.parse(raw);
      Object.assign(state, s);
    } catch (e) { /* ignore */ }
  }

  /* ---------------- utils ---------------- */
  const money = (n) => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ru-RU') + ' ₽';
  const supBy = (code) => D.suppliers.find((s) => s.code === code) || { name: '—', cat: '—', tc: 0 };
  const pillClass = (st) => ({
    'Новый': 'blue', 'Подтверждён': 'blue', 'Собирается': 'yellow', 'Выкуплен': 'yellow',
    'Отправлен': 'blue', 'Доставлен': 'green', 'На стопе': 'gray', 'Отменён': 'red',
    'Работает': 'green', 'Не отвечает': 'yellow', 'На паузе': 'gray', 'Закрыт': 'red',
    'Идёт сбор': 'blue', 'Собран': 'green', 'Набор': 'yellow', 'В наличии': 'green'
  }[st] || 'gray');
  const pill = (st) => '<span class="pill ' + pillClass(st) + '">' + esc(st) + '</span>';
  const dt = (s) => { const p = String(s).split(' '); return p[0].split('-').reverse().join('.') + (p[1] ? ' ' + p[1] : ''); };
  const nowStamp = () => {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  const $all = (root, sel) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function moveBalance(sum, type, ref, comment) {
    state.balance.current += sum;
    if (sum < 0 && type === 'Резерв') state.balance.frozen += -sum;
    if (sum > 0 && type === 'Возврат') state.balance.frozen = Math.max(0, state.balance.frozen - sum);
    state.balance.movements.unshift({ date: nowStamp(), type, sum, ref: ref || '', comment });
    save();
    refreshAll();
  }

  /* ---------------- shared bits ---------------- */
  function th(label, key, cur) {
    if (!key) return '<th>' + esc(label) + '</th>';
    const on = cur.sort === key;
    return '<th data-sort="' + key + '" class="' + (on ? 'sort-on' : '') + '">' + esc(label) +
      (on ? '<span class="arrow">' + (cur.dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>';
  }

  function bindSort(root, cur, redraw) {
    $all(root, 'th[data-sort]').forEach((h) => h.addEventListener('click', () => {
      const k = h.dataset.sort;
      if (cur.sort === k) cur.dir = -cur.dir; else { cur.sort = k; cur.dir = 1; }
      redraw();
    }));
  }

  function pager(total, page, per) {
    const pages = Math.max(1, Math.ceil(total / per));
    page = Math.min(page, pages);
    let out = '<div class="pager"><span class="mut" style="margin-right:6px">Стр. ' + page + ' из ' + pages + '</span>';
    const win = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 2) win.push(i);
    }
    let prev = 0;
    win.forEach((i) => {
      if (i - prev > 1) out += '<span class="gap">…</span>';
      out += '<span class="pg' + (i === page ? ' on' : '') + '" data-pg="' + i + '">' + i + '</span>';
      prev = i;
    });
    return { html: out + '</div>', pages, page };
  }

  /* ---------------- view: Поставщики ---------------- */
  function viewSellers(api) {
    const f = state.filters.sellers;
    let rows = D.suppliers.filter((s) =>
      (!f.tc || s.tc === +f.tc) && (!f.cat || s.cat === f.cat) &&
      (!f.q || (s.name + s.code + s.note + s.cat).toLowerCase().includes(f.q.toLowerCase())) &&
      (f.list === 'all' || (f.list === 'fav' ? state.fav.includes(s.code) : state.black.includes(s.code))));
    rows = rows.slice().sort((a, b) => {
      const k = f.sort;
      const va = k === 'rating' ? a.rating + (state.votes[a.code] || 0) : a[k], vb = k === 'rating' ? b.rating + (state.votes[b.code] || 0) : b[k];
      return (va > vb ? 1 : va < vb ? -1 : 0) * f.dir;
    });

    const per = 8;
    const pg = pager(rows.length, f.page, per);
    const slice = rows.slice((pg.page - 1) * per, pg.page * per);

    api.body.innerHTML =
      '<div class="toolbar">' +
      '<span class="mut">ТЦ:</span><select data-f="tc"><option value="">все</option>' +
      D.tc.map((t, i) => '<option value="' + i + '"' + (f.tc == i ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
      '<span class="mut">Категория:</span><select data-f="cat"><option value="">все</option>' +
      D.categories.slice(1).map((c) => '<option' + (f.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<span class="mut">Список:</span><select data-f="list">' +
      '<option value="all"' + (f.list === 'all' ? ' selected' : '') + '>Все поставщики</option>' +
      '<option value="fav"' + (f.list === 'fav' ? ' selected' : '') + '>Избранные (' + state.fav.length + ')</option>' +
      '<option value="black"' + (f.list === 'black' ? ' selected' : '') + '>Чёрный список (' + state.black.length + ')</option></select>' +
      '<span class="spacer"></span><input type="search" data-f="q" placeholder="Поиск по имени, месту, описанию" value="' + esc(f.q) + '" style="width:230px">' +
      '<button class="btn sm" data-a="reset">Сброс</button></div>' +
      '<div class="pad" style="padding-bottom:6px"><b style="font-size:12px">Бесплатная база поставщиков Садовод, Люблино, Южные ворота</b>' +
      '<span class="mut"> · найдено ' + rows.length + ' из ' + D.suppliers.length + '</span></div>' +
      '<div class="grid-wrap in" style="flex:1;margin:0 8px"><table class="grid"><thead><tr>' +
      th('Место', 'code', f) + th('', null, f) + th('Имя', 'name', f) + th('Статус', 'status', f) +
      th('Чем торгует', 'cat', f) + th('Рейтинг', 'rating', f) + th('Обновления', 'upd', f) +
      th('ТЦ', 'tc', f) + th('Добавлен', 'added', f) + th('Действия', null, f) +
      '</tr></thead><tbody>' +
      (slice.length ? slice.map((s) => {
        const v = state.votes[s.code] || 0;
        return '<tr data-code="' + s.code + '">' +
          '<td><b>' + esc(s.code) + '</b><div class="sub">' + esc(s.pav) + '</div></td>' +
          '<td class="ctr"><span class="avatar"></span></td>' +
          '<td><span class="link" data-open="' + s.code + '">' + esc(s.name) + '</span>' +
          '<div class="sub">' + (s.tg ? esc(s.tg) + ' ' : '') + (s.wa ? '· ' + esc(s.wa) + ' ' : '') + (s.vk ? '· ' + esc(s.vk) : '') + '</div></td>' +
          '<td>' + pill(s.status) + '</td>' +
          '<td>' + esc(s.cat) + '</td>' +
          '<td class="num" style="white-space:nowrap"><b>' + (s.rating + v) + '</b> ' +
          '<button class="btn sm" data-vote="1" title="Хорошо">▲</button>' +
          '<button class="btn sm" data-vote="-1" title="Плохо">▼</button></td>' +
          '<td class="sub">' + dt(s.upd) + '</td>' +
          '<td class="sub">' + esc(D.tc[s.tc]) + '</td>' +
          '<td class="sub">' + dt(s.added) + '</td>' +
          '<td><button class="btn sm" data-star>' + (state.fav.includes(s.code) ? '★ в избранных' : '☆ в избранное') + '</button></td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="10" class="empty">Ничего не найдено. Измените фильтры.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="toolbar" style="border-top:1px solid var(--sha)">' + pg.html +
      '<span class="spacer"></span><span class="mut">Минималка и условия — в карточке поставщика (двойной клик по имени)</span></div>';

    bindSort(api.body, f, () => mount(api, 'sellers'));
    $all(api.body, '.pg[data-pg]').forEach((b) => b.addEventListener('click', () => { f.page = +b.dataset.pg; mount(api, 'sellers'); }));
    $all(api.body, '[data-f]').forEach((i) => i.addEventListener('change', () => {
      f[i.dataset.f] = i.value; f.page = 1; mount(api, 'sellers');
    }));
    $all(api.body, 'input[data-f="q"]').forEach((i) => i.addEventListener('input', () => {
      f.q = i.value; f.page = 1;
      const pos = i.selectionStart; mount(api, 'sellers');
      const ni = api.body.querySelector('input[data-f="q"]'); if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); }
    }));
    api.body.querySelector('[data-a="reset"]').addEventListener('click', () => {
      state.filters.sellers = { tc: '', cat: '', q: '', sort: 'rating', dir: -1, page: 1, list: 'all' };
      mount(api, 'sellers');
    });
    $all(api.body, '[data-open]').forEach((a) => a.addEventListener('click', () => openSupplier(a.dataset.open, api)));
    $all(api.body, 'tr[data-code]').forEach((tr) => tr.addEventListener('dblclick', () => openSupplier(tr.dataset.code, api)));
    $all(api.body, '[data-vote]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = b.closest('tr').dataset.code, d = +b.dataset.vote;
      state.votes[code] = (state.votes[code] || 0) + d; save(); mount(api, 'sellers');
    }));
    $all(api.body, '[data-star]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = b.closest('tr').dataset.code;
      toggleList(code); mount(api, 'sellers');
    }));
    api.setStatus('Поставщиков: ' + rows.length, 'ТЦ: ' + (f.tc === '' ? 'все' : D.tc[f.tc]));
  }

  function toggleList(code) {
    const inFav = state.fav.includes(code);
    if (inFav) state.fav = state.fav.filter((c) => c !== code);
    else { state.fav = state.fav.concat(code); state.black = state.black.filter((c) => c !== code); }
    save(); refreshAll();
  }

  /* ---------------- view: Заказы ---------------- */
  function viewOrders(api) {
    if (!state.logged) return needLogin(api, 'Заказы');
    const f = state.filters.orders;
    const rows = state.orders.filter((o) => (!f.status || o.status === f.status) &&
      (!f.q || (o.id + o.sup + o.comment + supBy(o.sup).name).toLowerCase().includes(f.q.toLowerCase())));

    api.body.innerHTML =
      '<div class="toolbar">' +
      '<button class="btn" data-a="new">' + ico('save', 14) + ' Создать заказ</button>' +
      '<span class="mut">Статус:</span><select data-f="status"><option value="">все</option>' +
      D.orderStatuses.map((s) => '<option' + (f.status === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select>' +
      '<input type="search" data-f="q" placeholder="Поиск: №, поставщик, комментарий" value="' + esc(f.q) + '" style="width:220px">' +
      '<span class="spacer"></span><span class="mut">Всего на сумму: <b>' + money(rows.reduce((a, o) => a + o.sum, 0)) + '</b></span></div>' +
      '<div class="grid-wrap in" style="flex:1;margin:8px"><table class="grid"><thead><tr>' +
      '<th>№ заказа</th><th>Дата</th><th>Поставщик</th><th class="ctr">Позиций</th><th class="num">Сумма</th>' +
      '<th class="ctr">Предоплата</th><th>Статус</th><th>Доставка</th><th>Трек</th><th>Комментарий</th></tr></thead><tbody>' +
      (rows.length ? rows.map((o) => '<tr data-id="' + o.id + '">' +
        '<td><span class="link">' + esc(o.id) + '</span></td><td class="sub">' + dt(o.date) + '</td>' +
        '<td>' + esc(o.sup) + '<div class="sub">' + esc(supBy(o.sup).name) + '</div></td>' +
        '<td class="ctr">' + o.items + '</td><td class="num money">' + money(o.sum) + '</td>' +
        '<td class="ctr">' + (o.prepay ? '✔' : '—') + '</td><td>' + pill(o.status) + '</td>' +
        '<td class="sub">' + esc(o.send) + '</td><td class="sub">' + (o.track ? '<span class="link" data-track="' + esc(o.track) + '">' + esc(o.track) + '</span>' : '—') + '</td>' +
        '<td class="sub">' + esc(o.comment) + '</td></tr>').join('')
        : '<tr><td colspan="10" class="empty">Заказов нет. Создайте первый.</td></tr>') +
      '</tbody></table></div>';

    $all(api.body, '[data-f]').forEach((i) => i.addEventListener('change', () => { f[i.dataset.f] = i.value; mount(api, 'orders'); }));
    $all(api.body, 'input[data-f="q"]').forEach((i) => i.addEventListener('input', () => { f.q = i.value; mount(api, 'orders'); i.focus(); }));
    $all(api.body, 'tr[data-id]').forEach((tr) => {
      tr.addEventListener('dblclick', () => openOrder(tr.dataset.id, api));
      tr.querySelector('.link').addEventListener('click', () => openOrder(tr.dataset.id, api));
    });
    $all(api.body, '[data-track]').forEach((a) => a.addEventListener('click', (e) => {
      e.stopPropagation();
      Shell.alert('Трек-номер ' + a.dataset.track + '\nСтатус: «в пути», последняя сканировка — сортировочный центр «Люблино».', 'Отслеживание');
    }));
    api.body.querySelector('[data-a="new"]').addEventListener('click', () => newOrderWizard(api));
    api.setStatus('Заказов: ' + rows.length, 'Доступно: ' + money(state.balance.current - state.balance.frozen));
  }

  function openOrder(id, api) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    Shell.openWindow({
      id: 'order-' + id, title: id + ' — ' + supBy(o.sup).name, icon: 'doc', w: 620, h: 420,
      menu: [
        { label: '&Файл', items: [{ label: 'Обновить', action: () => openOrder(id, api) }, '-', { label: 'Закрыть', action: () => Shell.close('order-' + id) }] },
        { label: '&Заказ', items: [
          { label: 'Добавить замену', icon: 'refresh', action: () => Shell.prompt('Артикул позиции, которую нужно заменить', '', 'Замена позиции').then((v) => { if (v) Shell.alert('Замена на ' + v + ' запрошена у посредника. Ответ — в группе.', 'Замена'); }) },
          { label: 'Редактировать', icon: 'notepad', action: () => editOrderStatus(o, api) },
          { label: 'Отменить заказ', icon: 'stop', dis: ['Отменён', 'Доставлен'].includes(o.status), action: () => cancelOrder(o, api) }
        ] }
      ],
      render(w) {
        w.body.innerHTML =
          '<div class="pad">' +
          '<div class="row wrap"><span class="pill ' + pillClass(o.status) + '">' + esc(o.status) + '</span>' +
          '<b>' + esc(o.id) + '</b><span class="mut">от ' + dt(o.date) + '</span>' +
          '<span class="spacer"></span><b class="money">' + money(o.sum) + '</b></div>' +
          '<div class="hr"></div>' +
          '<div class="row wrap"><span class="mut">Поставщик:</span><b>' + esc(o.sup) + ' · ' + esc(supBy(o.sup).name) + '</b>' +
          '<span class="mut">ТЦ:</span>' + esc(D.tc[supBy(o.sup).tc]) +
          '<span class="mut">Доставка:</span>' + esc(o.send) + (o.track ? ' · трек ' + esc(o.track) : '') +
          '<span class="mut">Предоплата:</span>' + (o.prepay ? 'да' : 'нет') + '</div>' +
          (o.comment ? '<div class="mut" style="margin-top:6px">Комментарий: ' + esc(o.comment) + '</div>' : '') +
          '<fieldset class="group"><legend>Состав заказа</legend>' +
          '<div class="grid-wrap in" style="max-height:180px"><table class="grid"><thead><tr>' +
          '<th>Артикул</th><th>Наименование</th><th>Размер</th><th class="ctr">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead><tbody>' +
          o.pos.map((p) => '<tr><td><b>' + esc(p.art) + '</b></td><td>' + esc(p.name) + '</td><td class="sub">' + esc(p.size || '—') + '</td>' +
            '<td class="ctr">' + p.qty + '</td><td class="num">' + money(p.price) + '</td><td class="num">' + money(p.qty * p.price) + '</td></tr>').join('') +
          '</tbody></table></div></fieldset>' +
          '<div class="row" style="margin-top:8px"><button class="btn" data-a="status">Изменить статус</button>' +
          '<button class="btn" data-a="print">' + ico('notepad', 14) + ' Распечатать накладную</button>' +
          '<span class="spacer"></span><span class="mut">Итог по позициям: ' + money(o.pos.reduce((a, p) => a + p.qty * p.price, 0)) + '</span></div>' +
          '</div>';
        w.body.querySelector('[data-a="status"]').addEventListener('click', () => editOrderStatus(o, api));
        w.body.querySelector('[data-a="print"]').addEventListener('click', () => Shell.alert('Накладная ' + o.id + ' отправлена на печать.\nПринтер: HP LaserJet 1100', 'Печать'));
      }
    });
  }

  function editOrderStatus(o, api) {
    Shell.dialog({
      title: 'Статус ' + o.id, icon: 'gear', text: 'Выберите новый статус заказа. Служба поддержки — в группе посредника.',
      form: '<select id="st" style="width:100%">' + D.orderStatuses.map((s) => '<option' + (s === o.status ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select>',
      buttons: ['Сохранить', 'Отмена']
    }).then((v) => {
      if (v !== 'Сохранить') return;
      const val = Shell.formValue('#st');
      if (!val || val === o.status) return;
      o.status = val; save(); refreshAll();
      Shell.close('order-' + o.id);
      Shell.alert('Заказ ' + o.id + ': статус → «' + val + '».', 'Готово');
    });
  }

  function cancelOrder(o, api) {
    Shell.confirm('Отменить заказ ' + o.id + ' на сумму ' + money(o.sum) + '?\nПредоплата вернётся на баланс.', 'Отмена заказа')
      .then((yes) => {
        if (!yes) return;
        o.status = 'Отменён';
        if (o.prepay) moveBalance(o.sum, 'Возврат', o.id, 'Отменён заказ ' + o.id);
        else { state.orders = state.orders.filter((x) => x !== o); save(); refreshAll(); }
        Shell.close('order-' + o.id);
        Shell.alert('Заказ отменён.', 'Готово');
      });
  }

  function newOrderWizard(api) {
    const lines = [{ art: '', name: '', qty: 1, price: 0 }];
    Shell.openWindow({
      id: 'neworder', title: 'Новый заказ посреднику', icon: 'cart', w: 560, h: 430,
      render(w) {
        const draw = () => {
          w.body.innerHTML =
            '<div class="pad col">' +
            '<div class="row"><span class="mut" style="width:110px">Поставщик:</span>' +
            '<select data-k="sup" style="flex:1">' + D.suppliers.map((s) => '<option value="' + s.code + '">' + esc(s.code + ' — ' + s.name) + '</option>').join('') + '</select></div>' +
            '<div class="row"><span class="mut" style="width:110px">Доставка:</span>' +
            '<select data-k="send" style="flex:1"><option>Отправка СДЭК</option><option>Отправка Почта</option><option>ТК «ПЭК»</option><option>Самовывоз</option></select></div>' +
            '<div class="row"><span class="mut" style="width:110px">Предоплата:</span>' +
            '<label class="chk"><input type="checkbox" data-k="prepay"><span class="box"></span>Да, оплатить с баланса сейчас</label></div>' +
            '<fieldset class="group"><legend>Позиции</legend>' +
            '<div class="grid-wrap in" style="max-height:140px"><table class="grid"><thead><tr>' +
            '<th>Артикул</th><th>Наименование</th><th class="ctr">Кол-во</th><th class="num">Цена</th><th></th></tr></thead>' +
            '<tbody>' + lines.map((l, i) => '<tr><td><input data-i="' + i + '" data-c="art" value="' + esc(l.art) + '" style="width:90px"></td>' +
              '<td><input data-i="' + i + '" data-c="name" value="' + esc(l.name) + '" style="width:170px"></td>' +
              '<td class="ctr"><input data-i="' + i + '" data-c="qty" type="number" min="1" value="' + l.qty + '" style="width:52px"></td>' +
              '<td><input data-i="' + i + '" data-c="price" type="number" min="0" value="' + l.price + '" style="width:80px"></td>' +
              '<td><button class="btn sm" data-del="' + i + '">×</button></td></tr>').join('') + '</tbody></table></div>' +
            '<div class="row" style="margin-top:6px"><button class="btn sm" data-a="add">+ Добавить позицию</button>' +
            '<span class="spacer"></span><b class="money">' + money(lines.reduce((a, l) => a + l.qty * l.price, 0)) + '</b></div></fieldset>' +
            '<div class="row"><span class="mut" style="width:110px">Комментарий:</span>' +
            '<input data-k="comment" style="flex:1" placeholder="Например: микс размеров, отправка после проверки"></div>' +
            '<div class="row" style="margin-top:6px"><button class="btn def" data-a="ok">Оформить заказ</button>' +
            '<button class="btn" data-a="cancel">Отмена</button>' +
            '<span class="spacer"></span><span class="mut">Баланс: ' + money(state.balance.current) + '</span></div></div>';

          $all(w.body, 'input[data-i]').forEach((inp) => inp.addEventListener('input', () => {
            const l = lines[+inp.dataset.i];
            l[inp.dataset.c] = inp.dataset.c === 'name' || inp.dataset.c === 'art' ? inp.value : (parseInt(inp.value, 10) || 0);
            if (inp.dataset.c === 'qty' || inp.dataset.c === 'price') {
              w.body.querySelector('.group .money').textContent = money(lines.reduce((a, x) => a + x.qty * x.price, 0));
            }
          }));
          $all(w.body, '[data-del]').forEach((b) => b.addEventListener('click', () => { lines.splice(+b.dataset.del, 1); if (!lines.length) lines.push({ art: '', name: '', qty: 1, price: 0 }); draw(); }));
          w.body.querySelector('[data-a="add"]').addEventListener('click', () => { lines.push({ art: '', name: '', qty: 1, price: 0 }); draw(); });
          w.body.querySelector('[data-a="cancel"]').addEventListener('click', () => Shell.close('neworder'));
          w.body.querySelector('[data-a="ok"]').addEventListener('click', () => {
            const sup = w.body.querySelector('[data-k="sup"]').value;
            const send = w.body.querySelector('[data-k="send"]').value;
            const prepay = w.body.querySelector('[data-k="prepay"]').checked;
            const comment = w.body.querySelector('[data-k="comment"]').value;
            const pos = lines.filter((l) => l.art && l.price > 0);
            if (!pos.length) return Shell.alert('Добавьте хотя бы одну позицию с артикулом и ценой.', 'Нельзя оформить');
            const sum = pos.reduce((a, l) => a + l.qty * l.price, 0);
            const id = 'З-' + (2419 + state.orders.filter((o) => o.id.startsWith('З-24')).length);
            const o = { id, date: nowStamp(), sup, status: 'Новый', items: pos.reduce((a, l) => a + l.qty, 0), sum, prepay, send, track: '', comment, pos: pos.map((l) => ({ art: l.art, name: l.name || l.art, qty: l.qty, price: l.price, size: '' })) };
            state.orders.unshift(o);
            if (prepay) moveBalance(-sum, 'Списание', id, 'Предоплата заказа ' + id);
            else save();
            refreshAll();
            Shell.close('neworder');
            Shell.alert('Заказ ' + id + ' на сумму ' + money(sum) + ' создан.\nСтатус «Новый» — посредник подтвердит его в группе.', 'Заказ оформлен');
            openOrder(id, api);
          });
        };
        draw();
      }
    });
  }

  /* ---------------- view: Сборы ---------------- */
  function viewCollections(api) {
    if (!state.logged) return needLogin(api, 'Сборы');
    const rows = state.collections[state.collTab] || [];
    api.body.innerHTML =
      '<div class="tabs">' + D.collectionTabs.map((t) =>
        '<div class="tab' + (t === state.collTab ? ' on' : '') + '" data-tab="' + esc(t) + '">' + esc(t) +
        ' <span class="mut">(' + (state.collections[t] || []).length + ')</span></div>').join('') + '</div>' +
      '<div class="tabpane"><div class="row wrap" style="margin-bottom:8px">' +
      '<b style="font-size:12px">' + esc(state.collTab) + '</b><span class="spacer"></span>' +
      '<button class="btn sm" data-a="join">' + ico('users', 14) + ' Вступить в сбор</button>' +
      '<button class="btn sm" data-a="remind">Напомнить о закрытии</button></div>' +
      '<div class="grid-wrap in" style="max-height:none"><table class="grid"><thead><tr>' +
      '<th>Сбор</th><th>Поставщик</th><th class="ctr">Собрано / план</th><th class="ctr">Участников</th>' +
      '<th>Закрывается</th><th>Статус</th><th class="num">Моя доля</th><th>Прогресс</th></tr></thead><tbody>' +
      (rows.length ? rows.map((c, i) => '<tr data-i="' + i + '"><td><b>' + esc(c.id) + '</b> ' + esc(c.name) + '</td>' +
        '<td>' + esc(c.sup) + '<div class="sub">' + esc(supBy(c.sup).name) + '</div></td>' +
        '<td class="ctr">' + c.done + ' / ' + c.plan + '</td><td class="ctr">' + c.parts + '</td>' +
        '<td class="sub">' + esc(c.close) + '</td><td>' + pill(c.status) + '</td>' +
        '<td class="num">' + esc(c.my) + '</td>' +
        '<td style="width:130px"><div class="prog"><i style="width:' + Math.round(c.done / c.plan * 100) + '%"></i></div></td></tr>').join('')
        : '<tr><td colspan="8" class="empty">В этом разделе пока пусто.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="mut" style="margin-top:8px">Сборы закрываются автоматически. После «На выкупе» деньги списываются с баланса, невывкупленное возвращается на баланс.</div></div>';

    $all(api.body, '.tab').forEach((t) => t.addEventListener('click', () => { state.collTab = t.dataset.tab; mount(api, 'collections'); }));
    $all(api.body, 'tr[data-i]').forEach((tr) => tr.addEventListener('dblclick', () => openCollection(rows[+tr.dataset.i], api)));
    api.body.querySelector('[data-a="join"]').addEventListener('click', () => joinCollection(rows[0], api));
    api.body.querySelector('[data-a="remind"]').addEventListener('click', () =>
      Shell.alert('Бот в группе ВК напомнит участникам за 2 часа до закрытия сбора.', 'Напоминание'));
    api.setStatus('Вкладок: ' + D.collectionTabs.length, 'Активная: ' + state.collTab);
  }

  function openCollection(c, api) {
    if (!c) return;
    Shell.openWindow({
      id: 'coll-' + c.id, title: c.id + ' — ' + c.name, icon: 'box', w: 520, h: 320,
      render(w) {
        w.body.innerHTML = '<div class="pad col">' +
          '<div class="row"><span class="pill ' + pillClass(c.status) + '">' + esc(c.status) + '</span>' +
          '<b>' + esc(c.id) + '</b><span class="mut">' + esc(c.close) + '</span></div>' +
          '<div class="grid-wrap in"><table class="grid"><tbody>' +
          [['Поставщик', c.sup + ' — ' + supBy(c.sup).name], ['Категория', supBy(c.sup).cat],
          ['Собрано', c.done + ' из ' + c.plan + ' шт'], ['Участников', String(c.parts)],
          ['Моя доля', c.my], ['Минималка', supBy(c.sup).min + ' шт'], ['Отправка', supBy(c.sup).send ? 'есть' : 'нет'],
          ['Комментарий точки', supBy(c.sup).note]].map((r) =>
            '<tr><td style="width:150px" class="mut">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') +
          '</tbody></table></div>' +
          '<div class="row"><button class="btn def" data-a="join">Вступить</button>' +
          '<button class="btn" data-a="leave">Выйти из сбора</button>' +
          '<span class="spacer"></span><span class="mut">Баланс: ' + money(state.balance.current) + '</span></div></div>';
        w.body.querySelector('[data-a="join"]').addEventListener('click', () => joinCollection(c, api));
        w.body.querySelector('[data-a="leave"]').addEventListener('click', () => Shell.confirm('Выйти из сбора ' + c.id + '?', 'Выход').then((y) => {
          if (!y) return; Shell.close('coll-' + c.id); Shell.alert('Вы вышли из сбора. Бронь снята.', 'Готово');
        }));
      }
    });
  }

  function joinCollection(c, api) {
    if (!c) return Shell.alert('Нет сбора для вступления.', 'Пусто');
    Shell.dialog({
      title: 'Вступление в сбор ' + c.id, icon: 'users',
      text: 'Сбор: ' + c.name + '\nПлан: ' + c.done + '/' + c.plan + ' шт. Укажите, сколько штук берёте.',
      form: '<input type="number" min="1" value="' + Math.max(1, supBy(c.sup).min || 1) + '" style="width:120px"> шт',
      buttons: ['Вступить', 'Отмена']
    }).then((v) => {
      if (v !== 'Вступить') return;
      const qty = Math.max(1, parseInt(Shell.formValue('input[type=number]') || '1', 10) || 1);
      const price = 400;
      const sum = qty * price;
      c.done = Math.min(c.plan, c.done + qty);
      c.parts += 1;
      c.my = qty + ' шт / ' + money(sum);
      moveBalance(-sum, 'Списание', c.id, 'Вступление в сбор ' + c.id + ' (' + qty + ' шт)');
      Shell.close('coll-' + c.id);
      refreshAll();
      Shell.alert('Вы вступили в сбор ' + c.id + ': ' + qty + ' шт на ' + money(sum) + '.\nДеньги списаны с баланса.', 'Готово');
    });
  }

  /* ---------------- view: Товары ---------------- */
  function viewGoods(api) {
    const f = state.filters.goods;
    const rows = state.goods.filter((g) => (f.cat === 'Все товары' || g.cat === f.cat) &&
      (!f.q || (g.art + g.name + g.sup).toLowerCase().includes(f.q.toLowerCase())) &&
      (!f.sup || g.sup === f.sup));

    api.body.innerHTML =
      '<div class="toolbar"><span class="mut">Категория:</span><select data-k="cat" style="width:260px">' +
      D.categories.map((c) => '<option' + (f.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<span class="mut">Поставщик:</span><select data-k="sup"><option value="">все</option>' +
      D.suppliers.map((s) => '<option value="' + s.code + '"' + (f.sup === s.code ? ' selected' : '') + '>' + esc(s.code) + '</option>').join('') + '</select>' +
      '<input type="search" data-k="q" placeholder="Артикул или название" value="' + esc(f.q) + '" style="width:200px">' +
      '<span class="spacer"></span><span class="mut">Позиций: <b>' + rows.length + '</b></span></div>' +
      '<div style="flex:1; display:flex; min-height:0; gap:8px; padding:8px">' +
      '<div class="in tree" style="width:230px; flex:none">' + '<ul>' + D.categories.slice(1).map((c) =>
        '<li><div class="node' + (f.cat === c ? ' sel' : '') + '" data-cat="' + esc(c) + '">' + ico('folder', 14) + esc(c) + '</div></li>').join('') + '</ul></div>' +
      '<div class="grid-wrap in" style="flex:1"><table class="grid"><thead><tr><th>Артикул</th><th>Наименование</th><th>Поставщик</th>' +
      '<th>Размеры</th><th class="ctr">Остаток</th><th class="num">Цена</th><th class="num">Сумма</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map((g) => '<tr><td><b>' + esc(g.art) + '</b></td><td>' + esc(g.name) + '<div class="sub">' + esc(g.cat) + '</div></td>' +
        '<td class="sub">' + esc(g.sup) + '</td><td class="sub">' + esc(g.sizes || '—') + '</td>' +
        '<td class="ctr">' + g.qty + '</td><td class="num">' + money(g.price) + '</td>' +
        '<td class="num">' + money(g.price * g.qty) + '</td>' +
        '<td><button class="btn sm" data-cart="' + esc(g.art) + '">в заказ</button></td></tr>').join('')
        : '<tr><td colspan="8" class="empty">Товаров в этой категории нет.</td></tr>') +
      '</tbody></table></div></div>';

    $all(api.body, '[data-k]').forEach((i) => i.addEventListener('change', () => { f[i.dataset.k] = i.value; mount(api, 'goods'); }));
    const q = api.body.querySelector('input[data-k="q"]');
    q.addEventListener('input', () => { f.q = q.value; mount(api, 'goods'); q.focus(); });
    $all(api.body, '[data-cat]').forEach((n) => n.addEventListener('click', () => { f.cat = n.dataset.cat; mount(api, 'goods'); }));
    $all(api.body, '[data-cart]').forEach((b) => b.addEventListener('click', () => {
      const g = state.goods.find((x) => x.art === b.dataset.cart);
      Shell.alert('Позиция ' + g.art + ' (' + g.name + ') добавлена в новый заказ.\nОткройте «Заказы» → «Создать заказ».', 'Товар в корзине');
      go('orders');
    }));
    api.setStatus('Товаров: ' + rows.length, 'Категория: ' + f.cat);
  }

  /* ---------------- view: Баланс ---------------- */
  function viewBalance(api) {
    if (!state.logged) return needLogin(api, 'Баланс');
    const f = state.filters.balance;
    // остаток считается по всем операциям, фильтр по типу его не сбивает
    let run = state.balance.current;
    const all = state.balance.movements.map((m) => {
      const after = run; run -= m.sum;
      return Object.assign({}, m, { after });
    });
    const mv = all.filter((m) => !f.type || m.type === f.type);
    const types = [...new Set(state.balance.movements.map((m) => m.type))];

    api.body.innerHTML =
      '<div class="pad row wrap">' +
      '<div class="card" style="min-width:170px"><div class="mut">Баланс</div><div style="font-size:18px"><b>' + money(state.balance.current) + '</b></div></div>' +
      '<div class="card" style="min-width:170px"><div class="mut">Заморожено (резерв)</div><div style="font-size:18px"><b>' + money(state.balance.frozen) + '</b></div></div>' +
      '<div class="card" style="min-width:170px"><div class="mut">Доступно</div><div style="font-size:18px"><b class="pos">' + money(state.balance.current - state.balance.frozen) + '</b></div></div>' +
      '<span class="spacer"></span>' +
      '<button class="btn def" data-a="top">' + ico('wallet', 14) + ' Пополнить</button>' +
      '<button class="btn" data-a="export">' + ico('save', 14) + ' Выгрузить CSV</button></div>' +
      '<div class="toolbar"><span class="mut">Тип операции:</span><select data-k="type"><option value="">все</option>' +
      types.map((t) => '<option' + (f.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
      '<span class="spacer"></span><span class="mut">Записей: <b>' + mv.length + '</b></span></div>' +
      '<div class="grid-wrap in" style="flex:1;margin:0 8px 8px"><table class="grid"><thead><tr>' +
      '<th>Дата</th><th>Тип</th><th>Номер</th><th class="num">Сумма</th><th class="num">Остаток</th><th>Комментарий</th></tr></thead><tbody>' +
      mv.map((m) => '<tr>' +
        '<td class="sub">' + dt(m.date) + '</td><td>' + pill(m.type) + '</td><td class="sub">' + (m.ref ? esc(m.ref) : '—') + '</td>' +
        '<td class="num money ' + (m.sum >= 0 ? 'pos' : 'neg') + '">' + (m.sum >= 0 ? '+' : '') + money(m.sum) + '</td>' +
        '<td class="num sub">' + money(m.after) + '</td><td class="sub">' + esc(m.comment) + '</td></tr>').join('') +
      '</tbody></table></div>';

    api.body.querySelector('[data-k="type"]').addEventListener('change', (e) => { f.type = e.target.value; mount(api, 'balance'); });
    api.body.querySelector('[data-a="top"]').addEventListener('click', () => {
      Shell.dialog({
        title: 'Пополнение баланса', icon: 'wallet',
        text: 'Переведите сумму по реквизитам посредника, затем укажите её здесь. Зачисление — после подтверждения менеджером.',
        form: '<input type="number" min="100" step="100" value="10000" style="width:140px"> ₽',
        buttons: ['Зачислить', 'Отмена']
      }).then((v) => {
        if (v !== 'Зачислить') return;
        const sum = Math.max(100, parseInt(Shell.formValue('input[type=number]') || '10000', 10) || 10000);
        moveBalance(sum, 'Пополнение', '', 'Пополнение через бота, ' + money(sum));
        Shell.alert('Баланс пополнен на ' + money(sum) + '.', 'Готово');
      });
    });
    api.body.querySelector('[data-a="export"]').addEventListener('click', () => {
      const csv = ['дата;тип;номер;сумма;комментарий'].concat(
        state.balance.movements.map((m) => [m.date, m.type, m.ref, m.sum, m.comment.replace(/;/g, ',')].join(';'))).join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('' + csv);
      a.download = 'sadovod-balance.csv'; a.click();
      Shell.alert('Файл sadovod-balance.csv сохранён.', 'Выгрузка');
    });
    api.setStatus('Движений: ' + mv.length, 'Доступно: ' + money(state.balance.current - state.balance.frozen));
  }

  /* ---------------- view: Помощь ---------------- */
  function viewHelp(api) {
    api.body.innerHTML =
      '<div class="pad"><b style="font-size:12px">Справка по работе с сервисом</b>' +
      '<div class="mut" style="margin:4px 0 8px">Двойной клик по теме — откроется окно с описанием.</div>' +
      '<div class="grid-wrap in"><table class="grid"><thead><tr><th>Тема</th><th>О чём</th></tr></thead><tbody>' +
      D.help.map((h, i) => '<tr data-h="' + i + '"><td><b>' + esc(h.t) + '</b></td><td class="sub">' + esc(h.d) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="hr"></div><div class="row wrap"><span class="mut">Статус заказа, подтверждение оплаты и возврат средств —</span>' +
      '<span class="link" data-a="group">в группе вашего посредника</span><span class="mut">.</span></div></div>';

    $all(api.body, 'tr[data-h]').forEach((tr) => tr.addEventListener('dblclick', () => {
      const h = D.help[+tr.dataset.h];
      Shell.openWindow({ id: 'help-' + tr.dataset.h, title: h.t, icon: 'help', w: 520, h: 300, render(w) {
        w.body.innerHTML = '<div class="pad col"><b>' + esc(h.t) + '</b><div style="line-height:1.6">' + esc(h.d) +
          '\n\nРаздел доступен из меню «Сборы» и «Заказы». Если что-то не сходится — напишите посреднику в группе, ' +
          'он подтвердит статус заказа и проведёт оплату вручную.</div></div>';
      } });
    }));
    api.body.querySelector('[data-a="group"]').addEventListener('click', () =>
      Shell.alert('Группа посредника: vk.com/sadovod_posrednik\nБот отвечает в течение 15 минут.', 'Контакты'));
    api.setStatus('Тем: ' + D.help.length, '');
  }

  /* ---------------- view: Вход ---------------- */
  function viewLogin(api) {
    api.body.innerHTML =
      '<div style="padding:16px; display:flex; justify-content:center">' +
      '<fieldset class="group" style="width:340px"><legend>Авторизация</legend>' +
      '<div class="col">' +
      '<div class="row"><span class="mut" style="width:74px">Логин:</span><input data-k="l" value="denis.k" style="flex:1"></div>' +
      '<div class="row"><span class="mut" style="width:74px">Пароль:</span><input data-k="p" type="password" value="12345" style="flex:1"></div>' +
      '<label class="chk" style="margin-left:74px"><input type="checkbox" checked><span class="box"></span>Запомнить на этом компьютере</label>' +
      '<div class="row" style="margin-top:6px"><button class="btn def" data-a="in">Войти</button>' +
      '<button class="btn" data-a="vk">' + ico('vk', 14) + ' Через ВКонтакте</button></div>' +
      '<div class="row" style="margin-top:6px"><span class="link" data-a="forgot">Забыли пароль?</span></div>' +
      '<div class="hr"></div><div class="mut">Новый пароль бот отправляет в группе посредника. ' +
      'Регистрация — через менеджера, доступ к каталогу платный.</div>' +
      '</div></fieldset></div>';

    const enter = () => {
      state.logged = true; save(); refreshAll();
      Shell.alert('Добро пожаловать, ' + D.user.name + '! Группа: ' + D.user.group, 'Вход выполнен');
      go('orders');
    };
    api.body.querySelector('[data-a="in"]').addEventListener('click', enter);
    api.body.querySelector('[data-a="vk"]').addEventListener('click', enter);
    api.body.querySelector('[data-a="forgot"]').addEventListener('click', () =>
      Shell.prompt('Укажите ссылку на вашу страницу ВК — бот пришлёт туда новый пароль', 'https://vk.com/id1', 'Восстановление пароля')
        .then((v) => { if (v) Shell.alert('Заявка принята. Новый пароль придёт в личные сообщения.', 'Восстановление'); }));
    api.setStatus('Гость', 'Нажмите «Войти»');
  }

  function needLogin(api, name) {
    api.body.innerHTML = '<div class="empty">' + ico('lock', 32) + '<div style="margin-top:8px">Раздел «' + esc(name) + '» доступен после входа.</div>' +
      '<div style="margin-top:10px"><button class="btn def" data-a="go">Войти</button></div></div>';
    api.body.querySelector('[data-a="go"]').addEventListener('click', () => go('login'));
  }

  /* ---------------- main window ---------------- */
  const VIEWS = {
    sellers: { title: 'Поставщики', icon: 'users', render: viewSellers },
    orders: { title: 'Заказы', icon: 'cart', render: viewOrders },
    collections: { title: 'Сборы', icon: 'box', render: viewCollections },
    goods: { title: 'Товары', icon: 'tag', render: viewGoods },
    balance: { title: 'Баланс', icon: 'wallet', render: viewBalance },
    help: { title: 'Помощь', icon: 'help', render: viewHelp },
    login: { title: 'Вход', icon: 'key', render: viewLogin }
  };

  const MAIN = 'main';
  function menuFor() {
    return [
      { label: '&Поставщики', items: [
        { label: 'Все поставщики', icon: 'users', action: () => go('sellers') },
        { label: 'Избранные', icon: 'star', action: () => { state.filters.sellers.list = 'fav'; go('sellers'); } },
        { label: 'Чёрный список', icon: 'stop', action: () => { state.filters.sellers.list = 'black'; go('sellers'); } }, '-',
        { label: 'Закрыть окно', action: () => Shell.close(MAIN) }
      ] },
      { label: '&Заказы', items: [
        { label: 'Мои заказы', icon: 'cart', action: () => go('orders') },
        { label: 'Создать заказ', icon: 'save', action: () => { go('orders'); setTimeout(() => newOrderWizard(Shell.getWin(MAIN)), 30); } }
      ] },
      { label: '&Сборы', items: D.collectionTabs.map((t) => ({ label: t, icon: 'box', action: () => { state.collTab = t; go('collections'); } })) },
      { label: '&Товары', action: () => go('goods') },
      { label: '&Баланс', action: () => go('balance') },
      { label: '&Помощь', items: [
        { label: 'Разделы помощи', icon: 'help', action: () => go('help') },
        { label: 'О программе', icon: 'info', action: openAbout }
      ] },
      { label: state.logged ? '&Выход' : '&Вход', action: () => {
          if (state.logged) { state.logged = false; save(); refreshAll(); Shell.alert('Вы вышли из кабинета.', 'Выход'); }
          else go('login');
        } }
    ];
  }

  function toolbarFor() {
    return ['sellers', 'orders', 'collections', 'goods', 'balance', 'help'].map((k) =>
      '<button class="btn sm' + (state.view === k ? ' on' : '') + '" data-v="' + k + '">' + ico(VIEWS[k].icon, 14) + ' ' + VIEWS[k].title + '</button>').join('') +
      '<span class="tb-sep" style="width:2px; align-self:stretch; box-shadow:inset 1px 0 0 var(--sha), inset -1px 0 0 var(--hi)"></span>' +
      '<button class="btn sm' + (state.view === 'login' ? ' on' : '') + '" data-v="login">' + ico(state.logged ? 'user' : 'key', 14) + ' ' +
      (state.logged ? esc(D.user.name) : 'Вход') + '</button>' +
      '<span class="spacer"></span><span class="mut">Баланс: <b>' + money(state.balance.current) + '</b></span>';
  }

  function mount(api, view) {
    state.view = view;
    api.menu(menuFor());
    api.toolbar(toolbarFor());
    $all(api.el, '[data-v]').forEach((b) => b.onclick = () => go(b.dataset.v));
    VIEWS[view].render(api);
  }

  function go(view) {
    let api = Shell.getWin(MAIN);
    if (!VIEWS[view]) view = 'sellers';
    if (!api) {
      api = Shell.openWindow({
        id: MAIN, title: 'Садовод-посредник — ' + VIEWS[view].title, icon: 'globe',
        chrome: false, menu: menuFor(), toolbar: toolbarFor(), status: 'Готово'
      });
      mount(api, view);
      return;
    }
    api.setTitle('Садовод-посредник — ' + VIEWS[view].title);
    mount(api, view);
  }

  function refreshAll() {
    const api = Shell.getWin(MAIN);
    if (api) { api.setTitle('Садовод-посредник — ' + VIEWS[state.view].title); mount(api, state.view); }
  }

  /* ---------------- about ---------------- */
  function openAbout() {
    Shell.openWindow({
      id: 'about', title: 'О программе', icon: 'info', w: 420, h: 250, render(w) {
        w.body.innerHTML = '<div class="pad row"><div style="flex:none">' + ico('globe', 32) + '</div><div class="msg">' +
          '<b>Садовод-посредник 98</b><br>Версия 1.0 (сборка 2010)<br><br>' +
          'Демонстрация интерфейса в стиле Windows 98: база поставщиков рынков «Садовод», «Люблино», «Южные ворота», ' +
          'заказы, сборы и баланс.<br><br>Данные локальные, ничего не отправляется в сеть.' +
          '<div class="hr"></div><span class="mut">ОК — закрыть окно</span></div></div>' +
          '<div class="acts" style="display:flex;justify-content:center;padding-bottom:10px"><button class="btn def" data-x>OK</button></div>';
        w.body.querySelector('[data-x]').addEventListener('click', () => Shell.close('about'));
      }
    });
  }

  /* ---------------- boot ---------------- */
  window.addEventListener('DOMContentLoaded', () => {
    load();
    Shell.boot({ onBoot: () => go(state.logged ? 'sellers' : 'login') });
    window.addEventListener('resize', () => {
      const d = document.getElementById('desktop').getBoundingClientRect();
      [...Shell.wins.values()].forEach((r) => {
        if (r.static) return;
        if (r.max) { Shell.toggleMax(r.id, true); return; }
        const w = Math.min(r.el.offsetWidth, d.width), h = Math.min(r.el.offsetHeight, d.height);
        r.el.style.left = Math.max(0, Math.min(r.el.offsetLeft, d.width - w)) + 'px';
        r.el.style.top = Math.max(0, Math.min(r.el.offsetTop, d.height - h)) + 'px';
      });
    });
  });

  function openSupplier(code) {
    const s = supBy(code);
    if (!s || !s.code) return;
    const v = state.votes[s.code] || 0;
    Shell.openWindow({
      id: 'sup-' + code, title: s.code + ' — ' + s.name, icon: 'users', w: 560, h: 400,
      render(w) {
        const goods = state.goods.filter((g) => g.sup === code);
        w.body.innerHTML = '<div class="pad row" style="align-items:flex-start">' +
          '<span class="avatar lg" style="width:64px;height:64px"></span>' +
          '<div style="flex:1"><b style="font-size:13px">' + esc(s.name) + '</b> ' + pill(s.status) +
          '<div class="mut">' + esc(s.pav) + ' · ' + esc(D.tc[s.tc]) + '</div>' +
          '<div class="mut">Чем торгует: <b>' + esc(s.cat) + '</b> · Рейтинг: <b>' + (s.rating + v) + '</b></div></div>' +
          '<div class="col" style="gap:4px">' +
          (s.tg ? '<span class="link">' + ico('tg', 14) + ' ' + esc(s.tg) + '</span>' : '') +
          (s.wa ? '<span class="link">' + ico('wa', 14) + ' ' + esc(s.wa) + '</span>' : '') +
          (s.vk ? '<span class="link">' + ico('vk', 14) + ' ' + esc(s.vk) + '</span>' : '') + '</div></div>' +
          '<div class="pad" style="padding-top:0"><div class="card">' + esc(s.note) + '</div>' +
          '<div class="row wrap" style="margin-top:8px">' +
          '<span class="pill">Минималка: ' + s.min + ' шт</span>' +
          '<span class="pill">Отправка: ' + (s.send ? 'есть' : 'нет') + '</span>' +
          '<span class="pill">Самовывоз: ' + (s.pickup ? 'есть' : 'нет') + '</span>' +
          '<span class="pill">Обновлён: ' + dt(s.upd) + '</span></div></div>' +
          '<div class="toolbar"><b>Товары точки (' + goods.length + ')</b></div>' +
          '<div class="grid-wrap in" style="flex:1;margin:0 8px 8px"><table class="grid"><thead><tr><th>Артикул</th><th>Наименование</th><th>Размеры</th><th class="ctr">Остаток</th><th class="num">Цена</th></tr></thead><tbody>' +
          (goods.length ? goods.map((g) => '<tr><td><b>' + esc(g.art) + '</b></td><td>' + esc(g.name) + '</td><td class="sub">' + esc(g.sizes || '—') + '</td><td class="ctr">' + g.qty + '</td><td class="num">' + money(g.price) + '</td></tr>').join('')
            : '<tr><td colspan="5" class="empty">Товары этой точки не выгружены.</td></tr>') + '</tbody></table></div>' +
          '<div class="toolbar"><button class="btn def" data-a="order">Заказать</button>' +
          '<button class="btn" data-a="star">' + (state.fav.includes(code) ? 'Убрать из избранного' : 'В избранное') + '</button>' +
          '<button class="btn" data-a="black">' + (state.black.includes(code) ? 'Убрать из ЧС' : 'В чёрный список') + '</button>' +
          '<span class="spacer"></span><span class="mut">Добавлен в базу: ' + dt(s.added) + '</span></div>';
        w.body.querySelector('[data-a="order"]').addEventListener('click', () => { Shell.close('sup-' + code); go('orders'); setTimeout(() => newOrderWizard(w), 40); });
        w.body.querySelector('[data-a="star"]').addEventListener('click', () => { toggleList(code); Shell.close('sup-' + code); openSupplier(code); });
        w.body.querySelector('[data-a="black"]').addEventListener('click', () => {
          state.black = state.black.includes(code) ? state.black.filter((c) => c !== code) : state.black.concat(code);
          state.fav = state.fav.filter((c) => c !== code); save(); Shell.close('sup-' + code); refreshAll();
        });
      }
    });
  }
})();
