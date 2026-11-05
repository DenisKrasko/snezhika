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
    rates: {},
    // Правая кнопка меню — это сам клиент; её настройки (уведомления, тариф, контакты)
    // живут здесь и, как и остальное, пишутся в localStorage.
    account: { email: D.user.email, dob: D.user.dob, city: D.user.city, phone: D.user.phone, notif: true, tariff: D.user.tariff, avatar: '' },
    filters: {
      sellers: { tc: '', cat: '', q: '', sort: 'rating', dir: -1, page: 1, list: 'all' },
      orders: { status: '', q: '' },
      goods: { cat: 'Все товары', q: '', sup: '' },
      balance: { type: '' }
    },
    collTab: 'Мои'
  };

  // false — хранилище переполнено или недоступен приватный режим; зовущий код решает,
  // как об этом сказать (аватарка, например, крупнее остальных записей).
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        rev: D.rev, logged: state.logged, fav: state.fav, black: state.black,
        orders: state.orders, collections: state.collections, balance: state.balance, rates: state.rates,
        account: state.account
      }));
      return true;
    } catch (e) { return false; }
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS);
      if (!raw) return;
      const s = JSON.parse(raw);
      /* данные в seed.js обновились — берём новый сид, избранные списки и свои отзывы оставляем */
      if (s.rev !== D.rev) {
        state.logged = !!s.logged; state.fav = s.fav || []; state.black = s.black || []; state.rates = s.rates || {};
        save(); return;
      }
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

  // Аватар клиента: своя картинка (обрезанная квадратом и уменьшенная до 128 px) или
  // нейтральный значок человека из icons.js — он стоит и до загрузки фото, и после
  // удаления, поэтому картинка возвращается ровно та же. src подставляется только если
  // это data-изображение: в хранилище не должно быть ничего другого.
  const AVA_SIDE = 128;
  function avatarHtml(px) {
    const src = state.account.avatar;
    return src && src.indexOf('data:image/') === 0
      ? '<img class="ava" src="' + src + '" width="' + px + '" height="' + px + '" alt="Аватар клиента">'
      : ico('user', px);
  }

  // Картинка поставщика. Фото есть не у всех, и вместо него та же серая плашка с
  // нейтральным человеком, что стоит по умолчанию у клиента: рамка и outer-размер
  // совпадают с фото, поэтому колонка в списке не гуляет от строки к строке.
  const SUP_THUMB = 64;
  function supImgHtml(s, px) {
    return s.img
      ? '<img class="supimg" src="' + s.img + '" width="' + px + '" height="' + px +
        '" loading="lazy" alt="Витрина: ' + esc(s.name) + '">'
      : '<span class="supava" style="width:' + px + 'px;height:' + px + 'px">' +
        ico('user', px - 2) + '</span>';
  }

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

  /* ---------------- звёздный рейтинг поставщиков ---------------- */
  const REV_FORMS = ['отзыв', 'отзыва', 'отзывов'];
  const plural = (n, forms) => {
    const a = n % 10, b = n % 100;
    return forms[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2];
  };
  const revCount = (n) => n + ' ' + plural(n, REV_FORMS);

  // Отзывы из сида + та оценка, которую поставил текущий пользователь.
  function reviewsOf(code) {
    const list = (D.reviews[code] || []).slice();
    const mine = state.rates[code];
    if (mine) list.unshift({ who: D.user.name, stars: mine.stars, date: mine.date, text: mine.text || '', mine: true });
    return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  function ratingOf(code) {
    const list = reviewsOf(code), dist = [0, 0, 0, 0, 0];
    let sum = 0;
    list.forEach((r) => { sum += r.stars; dist[r.stars - 1]++; });
    return { avg: list.length ? sum / list.length : 0, count: list.length, dist, list };
  }
  const fmtAvg = (n) => (n ? n.toFixed(1).replace('.', ',') : '—');

  // Серый ряд звёзд + золотой слой, обрезанный по средней: получается полоска, а не число.
  const FIVE = '<span class="sg">★</span>'.repeat(5);
  function starsBar(avg, code, big) {
    return '<span class="stars' + (big ? ' big' : '') + '"' + (code ? ' data-stars="' + esc(code) + '"' : '') + '>' +
      '<span class="sbase">' + FIVE + '</span>' +
      '<span class="sfill" style="width:' + (avg / 5 * 100).toFixed(1) + '%">' + FIVE + '</span>' +
      (code ? [1, 2, 3, 4, 5].map((i) => '<i class="hit" data-hit="' + i + '" style="left:' + ((i - 1) * 20) + '%" title="Оценка: ' + i + '"></i>').join('') : '') +
      '</span>';
  }

  function bindStars(root, redraw) {
    $all(root, '.stars[data-stars]').forEach((st) => {
      const fill = st.querySelector('.sfill');
      const real = fill.style.width;
      $all(st, '.hit').forEach((h) => {
        h.addEventListener('mouseenter', () => { st.classList.add('hot'); fill.style.width = h.dataset.hit * 20 + '%'; });
        h.addEventListener('mouseleave', () => { st.classList.remove('hot'); fill.style.width = real; });
        h.addEventListener('click', (e) => {
          e.stopPropagation();
          rateSupplier(st.dataset.stars, +h.dataset.hit, redraw);
        });
      });
      st.addEventListener('dblclick', (e) => e.stopPropagation());
    });
  }

  function rateSupplier(code, stars, redraw) {
    const prev = state.rates[code];
    state.rates[code] = { stars, date: nowStamp(), text: prev ? prev.text : '' };
    save();
    redraw();
    Shell.dialog({
      title: 'Ваш отзыв — ' + supBy(code).name, icon: 'star', html: true,
      text: '<div style="margin-bottom:6px">' + starsBar(stars) + ' <b>' + stars + '</b> из 5 — оценка сохранена.</div>' +
        '<div class="mut">Комментарий необязателен, но другим посредникам он полезен.</div>',
      form: '<textarea data-cmt rows="3" style="width:100%;font:inherit" placeholder="Например: размер в размер, отправку задержала на два дня">' + esc(prev ? prev.text : '') + '</textarea>',
      buttons: ['Сохранить', 'Без комментария']
    }).then((v) => {
      if (v !== 'Сохранить') return;
      state.rates[code].text = (Shell.formValue('[data-cmt]') || '').trim();
      save(); redraw();
    });
  }

  function bindRatingUi(api, redraw) {
    bindStars(api.body, redraw);
    $all(api.body, '[data-reviews]').forEach((a) => a.addEventListener('click', (e) => {
      e.stopPropagation();
      openReviews(a.dataset.reviews);
    }));
  }

  /* ---------------- view: Поставщики ---------------- */
  function viewSellers(api) {
    const f = state.filters.sellers;
    const rt = {};
    D.suppliers.forEach((s) => { rt[s.code] = ratingOf(s.code); });
    let rows = D.suppliers.filter((s) =>
      (!f.tc || s.tc === +f.tc) && (!f.cat || s.cat === f.cat) &&
      (!f.q || (s.name + s.code + s.note + s.cat).toLowerCase().includes(f.q.toLowerCase())) &&
      (f.list === 'all' || (f.list === 'fav' ? state.fav.includes(s.code) : state.black.includes(s.code))));
    rows = rows.slice().sort((a, b) => {
      const k = f.sort;
      let d;
      if (k === 'rating') d = (rt[a.code].avg - rt[b.code].avg) || (rt[a.code].count - rt[b.code].count);
      else d = a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0;
      return d * f.dir;
    });

    // Строка поставщика высокая (две строки текста + звёзды), поэтому восемь штук на экран
    // было тесно, а страниц — слишком много. Держим тот же объём, что и в «Заказах»,
    // где список идёт одной простынёй: 40 записей, дальше пагинация.
    const per = 40;
    const pg = pager(rows.length, f.page, per);
    const slice = rows.slice((pg.page - 1) * per, pg.page * per);

    api.body.innerHTML =
      '<div class="toolbar">' +
      '<span class="mut">ТЦ:</span><select data-f="tc"><option value="">все</option>' +
      D.tc.map((t, i) => '<option value="' + i + '"' + (f.tc == i ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
      '<span class="mut">Категория:</span><select data-f="cat"><option value="">все</option>' +
      D.categories.slice(1).map((c) => '<option' + (f.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<span class="spacer"></span><input type="search" data-f="q" placeholder="Поиск по имени, месту, описанию" value="' + esc(f.q) + '" style="width:230px">' +
      '<button class="btn sm" data-a="reset">Сброс</button></div>' +
      // Три крупных переключателя вместо прежнего выпадающего списка: активный вдавлен.
      '<div class="toolbar">' +
      '<button class="btn big' + (f.list === 'all' ? ' on' : '') + '" data-list="all">' + ico('users', 16) + ' Все (' + D.suppliers.length + ')</button>' +
      '<button class="btn big' + (f.list === 'fav' ? ' on' : '') + '" data-list="fav">' + ico('star', 16) + ' Избранные (' + state.fav.length + ')</button>' +
      '<button class="btn big' + (f.list === 'black' ? ' on' : '') + '" data-list="black">' + ico('stop', 16) + ' Чёрный список (' + state.black.length + ')</button>' +
      '<span class="mut" style="margin-left:8px">' + (f.list === 'all' ? 'показаны все поставщики'
        : f.list === 'fav' ? 'показаны только избранные' : 'показан только чёрный список') + '</span></div>' +
      '<div class="pad" style="padding-bottom:6px"><b style="font-size:12px">Бесплатная база поставщиков Садовод, Люблино, Южные ворота</b>' +
      '<span class="mut"> · найдено ' + rows.length + ' из ' + D.suppliers.length + '</span></div>' +
      '<div class="grid-wrap in" style="flex:1;margin:0 8px"><table class="grid"><thead><tr>' +
      th('Место', 'code', f) + th('', null, f) + th('Имя', 'name', f) + th('Статус', 'status', f) +
      th('Чем торгует', 'cat', f) + th('Оценка', 'rating', f) + th('Обновления', 'upd', f) +
      th('ТЦ', 'tc', f) + th('Добавлен', 'added', f) + th('Действия', null, f) +
      '</tr></thead><tbody>' +
      (slice.length ? slice.map((s) => {
        const r = rt[s.code], mine = state.rates[s.code];
        return '<tr data-code="' + s.code + '">' +
          '<td><b>' + esc(s.code) + '</b><div class="sub">' + esc(s.pav) + '</div></td>' +
          '<td class="ctr">' + supImgHtml(s, SUP_THUMB) + '</td>' +
          '<td><span class="link" data-open="' + s.code + '">' + esc(s.name) + '</span>' +
          '<div class="sub">' + (s.tg ? esc(s.tg) + ' ' : '') + (s.wa ? '· ' + esc(s.wa) + ' ' : '') + (s.vk ? '· ' + esc(s.vk) : '') + '</div></td>' +
          '<td>' + pill(s.status) + '</td>' +
          '<td>' + esc(s.cat) + '</td>' +
          '<td class="rate">' + starsBar(r.avg, s.code) +
          '<div class="sub"><b>' + fmtAvg(r.avg) + '</b> · <span class="link" data-reviews="' + s.code + '" title="Открыть отзывы">' +
          revCount(r.count) + '</span>' + (mine ? ' <span class="pill blue">моя ' + mine.stars + '</span>' : '') + '</div></td>' +
          '<td class="sub">' + dt(s.upd) + '</td>' +
          '<td class="sub">' + esc(D.tc[s.tc]) + '</td>' +
          '<td class="sub">' + dt(s.added) + '</td>' +
          '<td><button class="btn sm" data-star>' + (state.fav.includes(s.code) ? '★ в избранных' : '☆ в избранное') + '</button></td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="10" class="empty">Ничего не найдено. Измените фильтры.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="toolbar" style="border-top:1px solid var(--sha)">' + pg.html +
      '<span class="spacer"></span><span class="mut">Клик по звезде — ваша оценка, клик по числу отзывов — все отзывы</span></div>';

    bindSort(api.body, f, () => mount(api, 'sellers'));
    $all(api.body, '.pg[data-pg]').forEach((b) => b.addEventListener('click', () => { f.page = +b.dataset.pg; mount(api, 'sellers'); }));
    $all(api.body, '[data-list]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.list;
      f.list = f.list === k ? 'all' : k;
      f.page = 1; mount(api, 'sellers');
    }));
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
    $all(api.body, '[data-open]').forEach((a) => a.addEventListener('click', () => openSupplier(a.dataset.open)));
    $all(api.body, 'tr[data-code]').forEach((tr) => tr.addEventListener('dblclick', () => openSupplier(tr.dataset.code)));
    bindRatingUi(api, () => mount(api, 'sellers'));
    $all(api.body, '[data-star]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = b.closest('tr').dataset.code;
      toggleList(code); mount(api, 'sellers');
    }));
    api.setStatus('Поставщиков: ' + rows.length, 'ТЦ: ' + (f.tc === '' ? 'все' : D.tc[f.tc]));
  }

  function openReviews(code) {
    const s = supBy(code);
    const paint = (w) => {
      const r = ratingOf(code), mine = state.rates[code];
      const max = Math.max(1, Math.max.apply(null, r.dist));
      w.body.innerHTML =
        '<div class="pad rsum">' +
        '<div class="row" style="align-items:center">' + starsBar(r.avg, code, true) +
        '<b class="ravg">' + fmtAvg(r.avg) + '</b>' +
        '<div class="rdist">' + [4, 3, 2, 1, 0].map((i) =>
          '<div class="row" style="align-items:center">' +
          '<span class="rstar">' + (i + 1) + '★</span>' +
          '<span class="rbar"><span style="width:' + (r.dist[i] / max * 100).toFixed(0) + '%"></span></span>' +
          '<span class="mut rnum">' + r.dist[i] + '</span></div>').join('') +
        '</div></div>' +
        '<div class="mut" style="margin-top:5px">' + esc(s.name) + ' (' + esc(code) + ') · ' + revCount(r.count) +
        (mine ? ' · ваша оценка ' + mine.stars + '★' + (mine.text ? ' с комментарием' : '') : ' · вы ещё не оценивали') + '</div></div>' +
        '<div class="toolbar" data-btnrow><b>Отзывы</b><span class="spacer"></span>' +
        (mine ? '<button class="btn sm" data-a="clear">Убрать мою оценку</button>' : '') + '</div>' +
        '<div class="revs in">' + (r.list.length ? r.list.map(rvHtml).join('')
          : '<div class="empty">Отзывов пока нет — кликните по звезде выше.</div>') + '</div>';
      bindRatingUi(w, () => { paint(w); refreshAll(); });
      const c = w.body.querySelector('[data-a="clear"]');
      if (c) c.addEventListener('click', () => { delete state.rates[code]; save(); paint(w); refreshAll(); });
      w.setStatus(revCount(r.count), 'средняя ' + fmtAvg(r.avg));
      w.closeBtn();
    };
    paint(Shell.openWindow({ id: 'rev-' + code, title: 'Отзывы — ' + s.name, icon: 'star', w: 620, h: 460 }));
  }

  function rvHtml(r) {
    return '<div class="rev' + (r.mine ? ' mine' : '') + '">' +
      '<div class="row" style="align-items:center">' + starsBar(r.stars) +
      '<b>' + esc(r.who) + '</b>' + (r.mine ? '<span class="pill blue">вы</span>' : '') +
      '<span class="spacer"></span><span class="sub">' + dt(r.date) + '</span></div>' +
      '<div class="rtext">' + (r.text ? esc(r.text) : '<span class="mut">Комментарий не оставлен.</span>') + '</div></div>';
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
          '<div class="row" data-btnrow style="margin-top:8px"><button class="btn" data-a="status">Изменить статус</button>' +
          '<button class="btn" data-a="print">' + ico('notepad', 14) + ' Распечатать накладную</button></div>' +
          '</div>';
        w.body.querySelector('[data-a="status"]').addEventListener('click', () => editOrderStatus(o, api));
        w.body.querySelector('[data-a="print"]').addEventListener('click', () => Shell.alert('Накладная ' + o.id + ' отправлена на печать.\nПринтер: HP LaserJet 1100', 'Печать'));
        w.setStatus('Готово', 'Итог по позициям: ' + money(o.pos.reduce((a, p) => a + p.qty * p.price, 0)));
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
            '<div class="row" data-btnrow style="margin-top:6px"><button class="btn def" data-a="ok">Оформить заказ</button>' +
            '<button class="btn" data-a="cancel">Отмена</button></div></div>';
          w.setStatus('Готово', 'Баланс: ' + money(state.balance.current));
          w.closeBtn();

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
          '<div class="row" data-btnrow><button class="btn def" data-a="join">Вступить</button>' +
          '<button class="btn" data-a="leave">Выйти из сбора</button></div></div>';
        w.setStatus('Готово', 'Баланс: ' + money(state.balance.current));
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
      Shell.openWindow({ id: 'help-' + tr.dataset.h, title: h.t, icon: 'help', w: 520, h: 178, render(w) {
        w.body.innerHTML = '<div class="pad col"><b>' + esc(h.t) + '</b><div style="line-height:1.6">' + esc(h.d) +
          '\n\nРаздел доступен из меню «Сборы» и «Заказы». Если что-то не сходится — напишите посреднику в группе, ' +
          'он подтвердит статус заказа и проведёт оплату вручную.</div></div>';
      } });
    }));
    api.body.querySelector('[data-a="group"]').addEventListener('click', () =>
      Shell.alert('Группа посредника: vk.com/sadovod_posrednik\nБот отвечает в течение 15 минут.', 'Контакты'));
    api.setStatus('Тем: ' + D.help.length, '');
  }

  /* ---------------- view: Личный кабинет ---------------- */
  // Открывается по кнопке с именем клиента в меню — как на asya.sadpos.ru/users:
  // код клиента, контакты, уведомления, баланс, тариф, реферальная ссылка и полезные ссылки.
  function viewAccount(api) {
    if (!state.logged) return needLogin(api, 'Личный кабинет');
    const a = state.account;
    const tariffs = D.user.tariffs;
    const cur = tariffs.find((t) => t.t === a.tariff) || tariffs[0];
    const lbl = (t) => '<span class="mut" style="width:118px;flex:none">' + t + '</span>';
    const fs = (legend, inner) => '<fieldset class="group"><legend>' + legend + '</legend>' + inner + '</fieldset>';

    api.body.innerHTML =
      '<div class="in cab" style="flex:1;min-height:0;overflow:auto;margin:8px">' +
      '<div class="pad">' +
      '<div class="row wrap" style="align-items:flex-start;gap:10px">' +
      '<div style="flex:none">' + avatarHtml(64) + '</div>' +
      '<div class="col" style="gap:2px">' +
      '<div style="font-size:14px"><b>' + esc(D.user.name) + '</b></div>' +
      '<div class="mut">Код клиента <b style="color:#000080;font-size:13px">№' + D.user.code + '</b> · в кабинете с ' + dt(D.user.since) + '</div>' +
      '<div class="mut">Группа: <b>' + esc(D.user.group) + '</b> · посредник: ' + esc(D.user.manager) + '</div>' +
      '<div class="row" style="gap:10px;margin-top:4px">' +
      '<span class="link" data-soc="vk">' + ico('vk', 14) + ' Группа ВКонтакте</span>' +
      '<span class="link" data-soc="tg">' + ico('tg', 14) + ' Товары группы в Telegram</span></div>' +
      '</div>' +
      '<span class="spacer"></span>' +
      '<div class="card" style="min-width:180px"><div class="mut">Баланс</div>' +
      '<div style="font-size:18px"><b>' + money(state.balance.current) + '</b></div>' +
      '<div class="mut" style="margin-top:2px">Доступно: ' + money(state.balance.current - state.balance.frozen) + '</div>' +
      '<span class="link" data-a="tobal">Пополнить и история &raquo;</span></div>' +
      '</div>' +
      '<div class="hr"></div>' +
      '<div class="row wrap" style="align-items:flex-start;gap:8px">' +

      '<div class="col cab-col">' +
      fs('Данные пользователя',
        '<div class="col">' +
        '<div class="row">' + lbl('Имя пользователя:') + '<input data-k="login" value="' + esc(D.user.login) + '" readonly style="flex:1 1 140px" title="Логин задаёт посредник">' +
        '<button class="btn sm" data-a="phone">' + ico('info', 14) + ' Телефон</button></div>' +
        '<div class="row">' + lbl('Email:') + '<input data-k="email" value="' + esc(a.email) + '" style="flex:1 1 140px"></div>' +
        '<div class="row">' + lbl('Дата рождения:') + '<input data-k="dob" value="' + esc(a.dob) + '" style="width:110px;flex:none">' +
        '<span class="mut">формат: дд.мм.гггг</span></div>' +
        '<div class="row">' + lbl('Город:') + '<input data-k="city" value="' + esc(a.city) + '" style="flex:1 1 140px"></div>' +
        '<div class="row">' + lbl('Аватар:') +
        '<span class="avaprev">' + avatarHtml(32) + '</span>' +
        '<span class="row" style="gap:3px;flex:none">' +
        '<button class="btn sm" data-a="ava">Загрузить…</button>' +
        '<button class="btn sm" data-a="ava-del">Удалить</button></span>' +
        '<input type="file" accept="image/*" data-k="avafile" style="display:none"></div>' +
        '<div class="row" style="margin-top:2px">' +
        '<button class="btn def" data-a="save">' + ico('save', 14) + ' Сохранить</button>' +
        '<button class="btn" data-a="newpass">' + ico('key', 14) + ' Задать новый пароль</button></div>' +
        '</div>') +
      fs('Настройка уведомлений',
        '<label class="chk" style="margin-bottom:4px"><input type="checkbox" data-k="notif"' + (a.notif ? ' checked' : '') +
        '><span class="box"></span>Получать уведомления о невыкупленных заказах во время закупки</label>' +
        '<div class="mut">' + (a.notif
          ? 'Напоминание придёт в бота за сутки до закрытия сбора.'
          : 'Напоминаний не будет: пропущенный выкуп зависит только от вас.') + '</div>') +
      '</div>' +

      '<div class="col cab-col">' +
      fs('Выбор тарифа',
        '<div class="row">' + lbl('Тариф:') +
        '<select data-k="tariff" style="flex:1 1 140px">' + tariffs.map((t) => '<option' + (a.tariff === t.t ? ' selected' : '') + '>' + esc(t.t) + '</option>').join('') + '</select>' +
        '<button class="btn def" data-a="pay">Оплатить</button></div>' +
        '<div class="mut" style="margin-top:4px">' + esc(cur.note) + ' · ' +
        (cur.fee ? 'абонентская плата <b>' + money(cur.fee) + '</b> в месяц, списывается с баланса.' : 'абонентской платы нет.') + '</div>') +
      fs('Ссылка для регистрации друзей',
        '<div class="row"><input data-k="ref" value="' + esc(D.user.ref) + '" readonly style="flex:1 1 140px">' +
        '<button class="btn sm" data-a="copy">Копировать</button></div>' +
        '<ul style="margin:6px 0 0 18px;padding:0">' +
        '<li class="mut">За каждого зарегистрированного по ссылке — 300 ₽ на ваш баланс после его первого выкупа.</li>' +
        '<li class="mut">Друг получит месяц тарифа «Оптовый» бесплатно, обязательств это никаких не накладывает.</li></ul>') +
      fs('Полезные ссылки',
        '<div class="col" style="gap:3px">' + D.user.links.map((l, i) =>
          '<span class="link" data-link="' + i + '">' + ico('globe', 12) + ' ' + esc(l.t) + '</span>').join('') + '</div>') +
      '</div>' +

      '</div></div></div>';

    api.body.querySelector('[data-a="tobal"]').addEventListener('click', () => go('balance'));
    $all(api.body, '[data-soc]').forEach((s) => s.addEventListener('click', () => {
      Shell.alert('Откроется ' + (s.dataset.soc === 'vk' ? 'группа посредника ВКонтакте' : 'канал группы в Telegram') +
        '.\nВ демо-версии ссылки отключены — напишите ' + D.user.manager + ' напрямую.', 'Сообщество');
    }));
    api.body.querySelector('[data-a="phone"]').addEventListener('click', () =>
      Shell.alert('Телефон: ' + a.phone + '\nДоступен с 10:00 до 20:00 по Москве.', 'Контакты'));
    const file = api.body.querySelector('[data-k="avafile"]');
    api.body.querySelector('[data-a="ava"]').addEventListener('click', () => file.click());
    api.body.querySelector('[data-a="ava-del"]').addEventListener('click', () => {
      if (!a.avatar) { Shell.alert('Своя аватарка не загружена — сейчас стоит значок человека по умолчанию.', 'Аватар'); return; }
      a.avatar = ''; save();
      mount(api, 'account');
      Shell.alert('Аватарку убрали, вернули значок человека по умолчанию.', 'Аватар');
    });
    // Файл читаем локально: обрезаем по центру до квадрата и уменьшаем до 128 px, чтобы
    // фото весило в localStorage десятки килобайт, а не мегабайты. Наружу ничего не уходит.
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement('canvas');
        c.width = c.height = AVA_SIDE;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, AVA_SIDE, AVA_SIDE);
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVA_SIDE, AVA_SIDE);
        const prev = a.avatar;
        a.avatar = c.toDataURL('image/jpeg', 0.85);
        if (!save()) {
          a.avatar = prev;
          Shell.alert('Картинка не влезла в локальное хранилище — оставили прежнюю аватарку.', 'Аватар');
          return;
        }
        mount(api, 'account');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        Shell.alert('«' + f.name + '» не читается как картинка. Возьмите JPG, PNG или GIF.', 'Аватар');
      };
      img.src = url;
    });
    api.body.querySelector('[data-a="save"]').addEventListener('click', () => {
      const v = (k) => api.body.querySelector('[data-k="' + k + '"]').value.trim();
      const email = v('email');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        Shell.alert('Проверьте адрес почты: нужен вид name@domain.ru.', 'Email не похож на адрес');
        return;
      }
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(v('dob'))) {
        Shell.alert('Дату рождения пишите в формате дд.мм.гггг, например 24.06.1997.', 'Неверный формат даты');
        return;
      }
      a.email = email; a.dob = v('dob'); a.city = v('city');
      save();
      Shell.alert('Данные сохранены. Их увидит только Ваш посредник.', 'Изменения сохранены');
      api.setStatus('Сохранено: ' + (email || 'без почты'), 'Город: ' + (a.city || 'не указан'));
    });
    api.body.querySelector('[data-a="newpass"]').addEventListener('click', () => {
      Shell.dialog({
        title: 'Новый пароль', icon: 'key',
        text: 'Придумайте пароль от входа в кабинет. Старый перестанет работать сразу.',
        form: '<input type="password" style="width:220px">',
        buttons: ['Задать', 'Отмена']
      }).then((v) => {
        if (v !== 'Задать') return;
        const p = Shell.formValue('[data-form] input') || '';
        if (p.length < 5) { Shell.alert('Пароль короче пяти символов — возьмите длиннее.', 'Слабый пароль'); return; }
        Shell.alert('Пароль обновлён. ' + (a.email ? 'Копия ушла на ' + a.email + '.' : 'Почту не указали — сохраните пароль сами.'), 'Готово');
      });
    });
    api.body.querySelector('[data-k="notif"]').addEventListener('change', (e) => {
      a.notif = e.target.checked; save(); mount(api, 'account');
    });
    api.body.querySelector('[data-k="tariff"]').addEventListener('change', (e) => {
      a.tariff = e.target.value; save(); mount(api, 'account');
    });
    api.body.querySelector('[data-a="pay"]').addEventListener('click', () => {
      if (!cur.fee) { Shell.alert('Тариф «' + cur.t + '» без абонентской платы — платить не за что.', 'Выбор тарифа'); return; }
      Shell.confirm('Списать ' + money(cur.fee) + ' с баланса за месяц тарифа «' + cur.t + '»?\n' +
        cur.note, 'Оплата тарифа').then((yes) => {
        if (!yes) return;
        if (state.balance.current - state.balance.frozen < cur.fee) {
          Shell.alert('Свободных денег не хватает: доступно ' + money(state.balance.current - state.balance.frozen) +
            '.', 'Оплата тарифа');
          return;
        }
        moveBalance(-cur.fee, 'Списание', '', 'Тариф «' + cur.t + '» на месяц');
        Shell.alert('Тариф «' + cur.t + '» оплачен, ' + money(cur.fee) + ' списано с баланса.', 'Готово');
      });
    });
    api.body.querySelector('[data-a="copy"]').addEventListener('click', () => {
      const i = api.body.querySelector('[data-k="ref"]');
      i.select();
      const manual = 'Ссылка выделена — скопируйте вручную (Ctrl+C):\n' + D.user.ref;
      const done = (text) => Shell.alert(text, 'Копирование');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(D.user.ref).then(() => done('Ссылка скопирована в буфер обмена.'), () => done(manual));
      } else {
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { /* старый браузер — оставим выделение */ }
        done(ok ? 'Ссылка скопирована в буфер обмена.' : manual);
      }
    });
    $all(api.body, '[data-link]').forEach((s) => s.addEventListener('click', () => {
      const l = D.user.links[+s.dataset.link];
      Shell.alert(l.t + '\n' + l.d, 'Полезная ссылка');
    }));
    api.setStatus('Клиент №' + D.user.code + ', тариф «' + cur.t + '»', 'Группа: ' + D.user.group);
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
    sellers: { title: 'Поставщики', render: viewSellers },
    orders: { title: 'Заказы', render: viewOrders },
    collections: { title: 'Сборы', render: viewCollections },
    goods: { title: 'Товары', render: viewGoods },
    balance: { title: 'Баланс', render: viewBalance },
    help: { title: 'Помощь', render: viewHelp },
    account: { title: 'Личный кабинет', render: viewAccount },
    login: { title: 'Вход', render: viewLogin }
  };

  const MAIN = 'main';

  // Единственное меню кабинета: ровная строка текстовых кнопок.
  // Вложенные команды («Избранные», «Чёрный список», вкладки сборов, «Создать заказ») живут
  // в самих разделах, отдельное выпадающее меню для них не нужно.
  function toolbarFor() {
    const item = (k) => '<button class="btn nav' + (state.view === k ? ' on' : '') + '" data-v="' + k + '">' + esc(VIEWS[k].title) + '</button>';
    // Кнопка с именем клиента ведёт в личный кабинет; форма входа нужна только гостю.
    const me = state.logged ? 'account' : 'login';
    return ['sellers', 'orders', 'collections', 'goods', 'balance', 'help'].map(item).join('') +
      '<span class="msep"></span>' +
      '<button class="btn nav me' + (state.view === me ? ' on' : '') + '" data-v="' + me + '">' +
      (state.logged ? avatarHtml(16) + esc(D.user.name) : 'Вход') + '</button>' +
      '<button class="btn nav" data-a="about">О программе</button>' +
      (state.logged ? '<button class="btn nav" data-a="exit">Выход</button>' : '') +
      '<span class="spacer"></span><span class="mut">Баланс: <b>' + money(state.balance.current) + '</b></span>';
  }

  function mount(api, view) {
    state.view = view;
    api.toolbar(toolbarFor());
    $all(api.el, '[data-v]').forEach((b) => b.onclick = () => go(b.dataset.v));
    const ab = api.el.querySelector('[data-a="about"]');
    if (ab) ab.onclick = openAbout;
    const ex = api.el.querySelector('[data-a="exit"]');
    if (ex) ex.onclick = () => {
      state.logged = false; save(); go('login');
      Shell.alert('Вы вышли из кабинета.', 'Выход');
    };
    VIEWS[view].render(api);
  }

  function go(view) {
    let api = Shell.getWin(MAIN);
    if (!VIEWS[view]) view = 'sellers';
    if (!api) {
      api = Shell.openWindow({
        id: MAIN, title: 'Садовод-посредник — ' + VIEWS[view].title, icon: 'globe',
        chrome: false, toolbar: toolbarFor(), status: 'Готово'
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
          '<div class="acts" data-btnrow style="display:flex;justify-content:center;padding-bottom:10px"><button class="btn def" data-x>OK</button></div>';
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
    const paint = (w) => {
      const r = ratingOf(code), mine = state.rates[code];
      const goods = state.goods.filter((g) => g.sup === code);
      w.body.innerHTML = '<div class="pad row" style="align-items:flex-start">' +
        supImgHtml(s, 64) +
        '<div style="flex:1"><b style="font-size:13px">' + esc(s.name) + '</b> ' + pill(s.status) +
        '<div class="mut">' + esc(s.pav) + ' · ' + esc(D.tc[s.tc]) + '</div>' +
        '<div class="mut">Чем торгует: <b>' + esc(s.cat) + '</b></div>' +
        '<div class="row" style="align-items:center;margin-top:3px">' + starsBar(r.avg, code, true) +
        '<b>' + fmtAvg(r.avg) + '</b><span class="link" data-reviews="' + esc(code) + '">' + revCount(r.count) + '</span>' +
        (mine ? '<span class="pill blue">моя ' + mine.stars + '</span>' : '') + '</div></div>' +
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
        '<div class="toolbar" data-btnrow><button class="btn def" data-a="order">Заказать</button>' +
        '<button class="btn" data-a="star">' + (state.fav.includes(code) ? 'Убрать из избранного' : 'В избранное') + '</button>' +
        '<button class="btn" data-a="black">' + (state.black.includes(code) ? 'Убрать из ЧС' : 'В чёрный список') + '</button></div>';
      bindRatingUi(w, () => { paint(w); refreshAll(); });
      w.body.querySelector('[data-a="order"]').addEventListener('click', () => { Shell.close('sup-' + code); go('orders'); setTimeout(() => newOrderWizard(w), 40); });
      w.body.querySelector('[data-a="star"]').addEventListener('click', () => { toggleList(code); paint(w); });
      w.body.querySelector('[data-a="black"]').addEventListener('click', () => {
        state.black = state.black.includes(code) ? state.black.filter((c) => c !== code) : state.black.concat(code);
        state.fav = state.fav.filter((c) => c !== code); save(); Shell.close('sup-' + code); refreshAll();
      });
      w.setStatus('Готово', 'Добавлен в базу: ' + dt(s.added));
      w.closeBtn();
    };
    paint(Shell.openWindow({ id: 'sup-' + code, title: s.code + ' — ' + s.name, icon: 'users', w: 560, h: 420 }));
  }
})();
