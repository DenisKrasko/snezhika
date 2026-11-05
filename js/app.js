/* ============================================================
   Садовод-посредник — разделы кабинета поверх Wise-оболочки
   ============================================================ */
(function () {
  const D = window.DATA;
  const esc = Shell.esc;
  const LS = 'sadpos98:v1';

  /* ---------------- state ---------------- */
  const state = {
    logged: false,
    view: 'orders',
    // «client» — только смотрит и грузит позиции, «manager» — помечает этапы выкупа
    role: 'client',
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
      // day — открытый выкуп (уровень карточек), all — плоский список «Все заказы»,
      // detail — подробные колонки/позиции, stages — какие этапы показывать.
      orders: { q: '', page: 1, per: 10, sort: 'date', day: '', all: false, detail: true, stages: {} },
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
        rev: D.rev, logged: state.logged, role: state.role, fav: state.fav, black: state.black,
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
      '<div class="pad" style="padding-bottom:6px"><b style="font-size:17px">Бесплатная база поставщиков Садовод, Люблино, Южные ворота</b>' +
      '<span class="mut"> · найдено ' + rows.length + ' из ' + D.suppliers.length + '</span></div>' +
      '<div class="grid-wrap in" style="flex:1;margin-bottom:8px"><table class="grid"><thead><tr>' +
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

  /* ---------------- view: Заказы: сводка выкупов → карточки дня ---------------- */
  // Модель выкупа: одна дата = один выкуп посредника на рынке. Клиент навешивает на дату
  // позиции — каждая стартует белым «ЗАКАЗОМ»; посредник перекрашивает её в зелёный
  // «ВЫКУП» или красный «НЕВЫКУП», а вечером отправленные — в синий «ВЫдачу».
  // Этапы намеренно не пишут движения на баланс: остаток в демо вычисляется из истории mv,
  // и сгенерированные выкупы увели бы его от нормальных 90 000 ₽.
  const STAGE_CLS = {
    'Заказ': 'zakaz', 'Выкуп': 'vykup', 'Невыкуп': 'nevykup', 'Выдача': 'vydacha',
    'Получено': 'polucheno', 'Отменён': 'otmenen', 'Заменён': 'zamenen'
  };
  // Подписи как в исходном кабинете, где отправленное пишется «ВЫдача» — с прописной «ы».
  const STAGE_CAP = {
    'Заказ': 'ЗАКАЗ', 'Выкуп': 'ВЫКУП', 'Невыкуп': 'НЕВЫКУП', 'Выдача': 'ВЫдача',
    'Получено': 'ПОЛУЧЕНО', 'Отменён': 'ОТМЕНЁН', 'Заменён': 'ЗАМЕНЁН'
  };
  const STAGE_HINT = {
    'Заказ': 'позиция загружена на дату, ждёт решения посредника',
    'Выкуп': 'товар выкуплен у поставщика',
    'Невыкуп': 'товара нет — сумма вернётся на баланс',
    'Выдача': 'вечером передан на отправку',
    'Получено': 'коробка дошла до клиента',
    'Заменён': 'вместо этой позиции согласована другая',
    'Отменён': 'заказ снят с выкупа'
  };
  // Проценты «выкуплено» считаются по трём этапам цепочки: то, что посредник реально взял.
  const BOUGHT = ['Выкуп', 'Выдача', 'Получено'];
  const CHARGED = ['Выкуп', 'Выдача', 'Получено', 'Заменён'];
  const NEXT_STAGES = {
    'Заказ': ['Выкуп', 'Невыкуп', 'Заменён', 'Отменён'],
    'Выкуп': ['Выдача', 'Невыкуп', 'Заменён', 'Отменён'],
    'Невыкуп': ['Выкуп', 'Заменён', 'Отменён'],
    'Выдача': ['Получено'],
    'Получено': ['Заменён'],
    'Заменён': ['Выкуп', 'Невыкуп'],
    'Отменён': ['Заказ']
  };
  const stageCls = (st) => STAGE_CLS[st] || 'zakaz';
  const dmy = (day) => String(day).split('-').reverse().join('.');
  const dayAdd = (day, n) => {
    const d = new Date(String(day) + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Строка = календарный день выкупа, номера идут сверху вниз от №4950, как в исходном кабинете.
  function wykups() {
    const map = {};
    state.orders.forEach((o) => {
      const d = String(o.date).slice(0, 10);
      (map[d] || (map[d] = [])).push(o);
    });
    return Object.keys(map).sort().reverse().map((day, i) => ({
      day: day,
      num: 4950 - i,
      list: map[day].slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    }));
  }
  const wykupOf = (day) => wykups().find((w) => w.day === day);

  function stageAgg(list) {
    const a = { orders: list.length, items: 0, sum: 0, by: {} };
    D.orderStages.forEach((s) => { a.by[s] = { c: 0, i: 0, s: 0 }; });
    list.forEach((o) => {
      const b = a.by[o.stage] || (a.by[o.stage] = { c: 0, i: 0, s: 0 });
      b.c++; b.i += o.items; b.s += o.sum;
      a.items += o.items; a.sum += o.sum;
    });
    a.pctSum = a.sum ? Math.round(BOUGHT.reduce((x, s) => x + a.by[s].s, 0) / a.sum * 100) : 0;
    a.pctQty = a.items ? Math.round(BOUGHT.reduce((x, s) => x + a.by[s].i, 0) / a.items * 100) : 0;
    a.closed = a.orders === a.by['Получено'].c + a.by['Невыкуп'].c + a.by['Отменён'].c;
    return a;
  }

  const orgOf = (o) => Math.round(o.sum * (D.orgPct || 0) / 100);

  // Сколько уже ушло с баланса под заказ: для заказов из seed'а берём настоящее движение,
  // для сгенерированных выкупов считаем по этапу (null — списаний ещё не было).
  function orderCharge(o) {
    const mv = state.balance.movements.filter((m) => m.ref === o.id && m.sum < 0).reduce((x, m) => x + m.sum, 0);
    if (mv) return mv;
    if (CHARGED.includes(o.stage)) return -(o.sum + orgOf(o));
    if (o.stage === 'Заказ' && o.prepay) return -Math.round(o.sum / 2);
    if (o.stage === 'Невыкуп' || o.stage === 'Отменён') return 0;
    return null;
  }

  const stageOn = (f, st) => f.stages[st] !== false;
  const oMatch = (o, q) => !q || (o.id + ' ' + o.sup + ' ' + supBy(o.sup).name + ' ' + o.comment + ' ' +
    o.pos.map((p) => p.art + ' ' + p.name).join(' ')).toLowerCase().includes(q);

  // Тумблеры этапов: на уровне карточек и в «Всех заказах» фильтруют выдачу.
  function stageSwitches(f) {
    return D.orderStages.map((s) => '<label class="sw"><input type="checkbox" data-st="' + esc(s) + '"' +
      (stageOn(f, s) ? ' checked' : '') + '><i></i><span class="tag ' + stageCls(s) + '">' + esc(s) + '</span></label>').join('');
  }

  function bindStageSwitches(root, f, redraw) {
    $all(root, '[data-st]').forEach((i) => i.addEventListener('change', () => {
      f.stages[i.dataset.st] = i.checked;
      redraw();
    }));
  }

  function bindSearch(root, f, redraw) {
    $all(root, '[data-f]').forEach((i) => i.addEventListener('change', () => {
      f[i.dataset.f] = i.value; f.page = 1; redraw();
    }));
    $all(root, 'input[data-f="q"]').forEach((i) => i.addEventListener('input', () => {
      f.q = i.value; f.page = 1;
      const pos = i.selectionStart;
      redraw();
      const ni = root.querySelector('input[data-f="q"]');
      if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); }
    }));
  }

  function viewOrders(api) {
    if (!state.logged) return needLogin(api, 'Заказы');
    const f = state.filters.orders;
    if (f.all) return viewAllOrders(api, f);
    if (f.day && wykupOf(f.day)) return viewDayCards(api, f);
    f.day = '';
    return viewVykupy(api, f);
  }

  /* ----- уровень 1: сводная таблица выкупов ----- */
  // Колонки и их цвета — как в исходном кабинете: № выкупа, даты загрузки и доставки,
  // % выкупленного и четыре столбца по этапам (Заказы / Куплено / Невыкуп / Готово / Получено).
  const SORTS = {
    date: (x, y) => y.w.day.localeCompare(x.w.day),
    num: (x, y) => y.w.num - x.w.num,
    pct: (x, y) => y.a.pctSum - x.a.pctSum,
    sum: (x, y) => y.a.sum - x.a.sum
  };

  function viewVykupy(api, f) {
    const all = wykups();
    const today = nowStamp().slice(0, 10);
    const q = f.q.trim().toLowerCase();
    let rows = all.map((w) => ({ w: w, a: stageAgg(w.list) })).filter((r) => !q ||
      (String(r.w.num) + ' ' + r.w.day + ' ' +
        r.w.list.map((o) => o.id + ' ' + o.sup + ' ' + supBy(o.sup).name + ' ' + o.pos.map((p) => p.art).join(' ')).join(' '))
        .toLowerCase().includes(q));
    rows.sort(SORTS[f.sort] || SORTS.date);
    const pg = pager(rows.length, f.page, f.per);
    const slice = rows.slice((pg.page - 1) * f.per, pg.page * f.per);
    const det = f.detail;
    const aggAll = stageAgg(state.orders);
    // ячейка этапа: крупно число заказов, под ним штуки и сумма — как в исходной таблице
    const cell = (cls, b) => '<td class="ctr ' + cls + '">' +
      (det ? '<span class="kpi">' + b.c + '</span><span class="chip">' + b.i + ' шт · ' + money(b.s) + '</span>' : b.c) + '</td>';
    const dateCell = (v) => '<td class="sub">' + (v || '—') + '</td>';

    api.body.innerHTML =
      '<div class="toolbar">' +
      '<button class="btn def" data-a="new">' + ico('upload', 16) + ' Загрузить товары на выкуп</button>' +
      '<button class="btn blue" data-a="pay">' + ico('wallet', 16) + ' Пополнить или вернуть</button>' +
      '<button class="btn" data-a="scan">' + ico('scan', 16) + ' Скан</button>' +
      '<button class="btn" data-a="zip">' + ico('zip', 16) + ' ZIP</button>' +
      '<button class="btn" data-a="excel">' + ico('excel', 16) + ' Excel</button>' +
      '<button class="btn sm" data-a="detail">' + (det ? 'Скрыть подробности' : 'Показать подробности') + '</button>' +
      '<span class="spacer"></span>' +
      '<input type="search" data-f="q" placeholder="№ заказа или артикул" value="' + esc(f.q) + '" style="width:260px">' +
      '<button class="btn sm" data-a="reset">Сбросить</button></div>' +
      '<div class="toolbar">' +
      '<span class="seg" data-lvl>' +
      '<button class="on">выкупы</button>' +
      '<button data-a="all">все заказы</button></span>' +
      '<span class="mut">Сортировка:</span><select data-f="sort">' +
      [['date', 'по дате'], ['num', 'по номеру выкупа'], ['pct', 'по % выкупа'], ['sum', 'по сумме']]
        .map((s) => '<option value="' + s[0] + '"' + (f.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') +
      '</select><span class="spacer"></span>' +
      '<span class="mut">Записей на страницу</span><select data-f="per">' +
      [10, 25, 50].map((n) => '<option' + (f.per === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div class="grid-wrap in" style="flex:1;margin-bottom:8px"><table class="grid"><thead><tr>' +
      '<th>Выкуп</th><th>Загрузка</th><th>Доставка</th><th class="ctr">Выкуп %</th>' +
      '<th class="ctr' + (det ? ' v-gray' : '') + '">Заказы</th>' +
      (det ? '<th class="ctr v-green">Куплено</th><th class="ctr v-red">Невыкуп</th>' +
        '<th class="ctr v-blue">Готово</th><th class="ctr v-brown">Получено</th>' : '') +
      '</tr></thead><tbody>' +
      (slice.length ? slice.map((r) => {
        const w = r.w, a = r.a, open = w.day === today;
        return '<tr data-day="' + w.day + '">' +
          '<td><span class="link kpi" data-wykup="' + w.day + '">' + w.num + '</span></td>' +
          dateCell(open ? '' : dmy(w.day)) +
          '<td class="sub">' + (open ? '—' : dmy(dayAdd(w.day, 3))) +
          (a.closed ? '<div style="margin-top:4px"><span class="deadline ok">всё получено</span></div>' : '') + '</td>' +
          '<td class="ctr"><span class="kpi">' + a.pctSum + '%</span>' +
          (det ? '<span class="chip">по кол-ву ' + a.pctQty + '%</span>' : '') + '</td>' +
          '<td class="ctr' + (det ? ' v-gray' : '') + '">' +
          (det ? '<span class="kpi">' + a.orders + '</span><span class="chip">' + a.items + ' шт · ' + money(a.sum) + '</span>' : a.orders) + '</td>' +
          (det ? cell('v-green', a.by['Выкуп']) + cell('v-red', a.by['Невыкуп']) +
            cell('v-blue', a.by['Выдача']) + '<td class="ctr v-brown">' +
            (det ? '<span class="kpi">' + a.by['Получено'].c + '</span><span class="chip">' + a.by['Получено'].i + ' шт</span>' : a.by['Получено'].c) + '</td>' : '') +
          '</tr>';
      }).join('') : '<tr><td colspan="' + (det ? 9 : 5) + '" class="empty">Выкупов по этому поиску нет.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="toolbar" style="border-top:1px solid var(--sha)">' + pg.html +
      '<span class="mut">Показано ' + slice.length + ' из ' + rows.length + '</span>' +
      '<span class="spacer"></span><span class="mut">Всего: выкупов ' + all.length + ' · заказов ' + aggAll.orders +
      ' · ' + money(aggAll.sum) + ' · выкуплено ' + aggAll.pctSum + '%</span></div>';

    const redraw = () => mount(api, 'orders');
    bindSearch(api.body, f, redraw);
    bindPager(api.body, f, redraw);
    $all(api.body, '[data-wykup]').forEach((a) => a.addEventListener('click', (e) => {
      e.stopPropagation();
      f.day = a.dataset.wykup; f.page = 1; redraw();
    }));
    $all(api.body, 'tr[data-day]').forEach((tr) => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('dblclick', () => { f.day = tr.dataset.day; f.page = 1; redraw(); });
    });
    api.body.querySelector('[data-a="all"]').addEventListener('click', () => { f.all = true; f.page = 1; redraw(); });
    api.body.querySelector('[data-a="detail"]').addEventListener('click', () => { f.detail = !f.detail; redraw(); });
    api.body.querySelector('[data-a="reset"]').addEventListener('click', () => {
      f.q = ''; f.sort = 'date'; f.page = 1; redraw();
    });
    api.body.querySelector('[data-a="new"]').addEventListener('click', () => newOrderWizard(api));
    api.body.querySelector('[data-a="pay"]').addEventListener('click', () => topUp());
    api.body.querySelector('[data-a="scan"]').addEventListener('click', () => {
      Shell.prompt('Артикул со штрих-кода или QR позиции:', '', 'Скан')
        .then((v) => {
          if (!v) return;
          const art = v.trim();
          state.filters.goods.q = art;
          state.filters.goods.cat = 'Все товары';
          go('goods');
          Shell.alert('Позиция «' + art + '» найдена в разделе «Товары» — добавьте её в заказ нужного выкупа.', 'Скан');
        });
    });
    api.body.querySelector('[data-a="zip"]').addEventListener('click', () => {
      Shell.confirm('Собрать архив выкупов: фото позиций, размерные сетки и ведомости по строкам таблицы?\n' +
        all.length + ' выкупов, ' + aggAll.orders + ' заказов.', 'ZIP')
        .then((yes) => { if (yes) Shell.alert('Архив wykupy-' + today + '.zip готов к скачиванию.', 'ZIP'); });
    });
    api.body.querySelector('[data-a="excel"]').addEventListener('click', () => {
      const csv = ['выкуп;загрузка;доставка;выкуп %;заказы;куплено;невыкуп;готово;получено'].concat(
        rows.map((r) => {
          const a = r.a;
          return [r.w.num, dmy(r.w.day), dmy(dayAdd(r.w.day, 3)), a.pctSum + '%',
            a.orders + ' (' + a.sum + ')', a.by['Выкуп'].c + ' (' + a.by['Выкуп'].s + ')',
            a.by['Невыкуп'].c + ' (' + a.by['Невыкуп'].s + ')', a.by['Выдача'].c + ' (' + a.by['Выдача'].s + ')',
            a.by['Получено'].c].join(';');
        })).join('\n');
      downloadCsv('sadovod-vykupy.csv', csv);
      Shell.alert('Файл sadovod-vykupy.csv сохранён.', 'Excel');
    });
    api.setStatus('Выкупов: ' + rows.length, 'Двойной клик по строке — карточки этого дня');
  }

  function bindPager(root, f, redraw) {
    $all(root, '.pg[data-pg]').forEach((b) => b.addEventListener('click', () => { f.page = +b.dataset.pg; redraw(); }));
  }

  function downloadCsv(name, csv) {
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('' + csv);
    a.download = name;
    a.click();
  }

  /* ----- уровень 2: карточки заказов одного выкупа ----- */
  function viewDayCards(api, f) {
    const w = wykupOf(f.day);
    const q = f.q.trim().toLowerCase();
    const list = w.list.filter((o) => stageOn(f, o.stage) && oMatch(o, q));
    const a = stageAgg(w.list);
    const det = f.detail;
    const mgr = state.role === 'manager';
    const orgAll = w.list.reduce((x, o) => x + orgOf(o), 0);

    api.body.innerHTML =
      '<div class="toolbar">' +
      '<button class="btn" data-a="back">← выкупы</button>' +
      '<b style="font-size:22px;font-weight:600;letter-spacing:-.6px">ВЫКУП ' + w.num + '</b>' +
      '<span class="mut">' + dmy(w.day) + ' · ' + a.orders + ' зак. · ' + money(a.sum) + ' · выкуплено ' + a.pctSum + '%</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn sm" data-a="all">все заказы</button>' +
      '<button class="btn sm" data-a="excel">' + ico('excel', 16) + ' ВЫгрузка</button>' +
      '<button class="btn sm" data-a="detail">' + (det ? 'Скрыть подробности' : 'Показать подробности') + '</button>' +
      '<button class="btn def" data-a="new">' + ico('plus', 16) + ' Создать заказ</button></div>' +
      '<div class="toolbar">' + stageSwitches(f) +
      '<span class="spacer"></span>' +
      '<input type="search" data-f="q" placeholder="№ заказа или артикул" value="' + esc(f.q) + '" style="width:240px">' +
      '<button class="btn sm" data-a="reset">Сбросить</button></div>' +
      (list.length ? '<div class="ocards">' + list.map((o) => ocardHtml(o, det, mgr)).join('') + '</div>' :
        '<div class="empty">Нет заказов этого выкупа под текущие фильтры.</div>') +
      '<div class="toolbar" style="border-top:1px solid var(--sha)">' +
      '<span class="mut">Показано ' + list.length + ' из ' + w.list.length + '</span><span class="spacer"></span>' +
      '<span class="mut">Орг ' + (D.orgPct || 0) + '%: <b>' + money(orgAll) + '</b> · Итог: <b>' + money(a.sum + orgAll) + '</b></span></div>' +
      '<div class="mut" style="margin:4px 0 12px">' + (mgr
        ? 'Режим посредника: кнопка «этап» в шапке карточки ставит ВЫКУП, НЕВЫКУП, ЗАМЕНУ или вечернюю ВЫдачу.'
        : 'Вы смотрите как клиент — цвет карточки задаёт посредник. Включите «Посредник» в шапке, чтобы помечать этапы.') + '</div>';

    const redraw = () => mount(api, 'orders');
    bindSearch(api.body, f, redraw);
    bindStageSwitches(api.body, f, redraw);
    api.body.querySelector('[data-a="back"]').addEventListener('click', () => { f.day = ''; f.page = 1; redraw(); });
    api.body.querySelector('[data-a="all"]').addEventListener('click', () => { f.all = true; f.page = 1; redraw(); });
    api.body.querySelector('[data-a="detail"]').addEventListener('click', () => { f.detail = !f.detail; redraw(); });
    api.body.querySelector('[data-a="reset"]').addEventListener('click', () => { f.q = ''; redraw(); });
    api.body.querySelector('[data-a="new"]').addEventListener('click', () => newOrderWizard(api, w.day));
    api.body.querySelector('[data-a="excel"]').addEventListener('click', () => {
      downloadCsv('vykup-' + w.num + '.csv', ['заказ;поставщик;этап;дата;шт;сумма;орг;итог;отправка;трек;комментарий'].concat(
        w.list.map((o) => [o.id, o.sup, o.stage, dt(o.date), o.items, o.sum, orgOf(o), o.sum + orgOf(o),
          o.send, o.track, String(o.comment).replace(/;/g, ',')].join(';'))).join('\n'));
      Shell.alert('Файл vykup-' + w.num + '.csv сохранён.', 'Excel');
    });
    $all(api.body, '[data-open]').forEach((b) => b.addEventListener('click', () => openOrder(b.dataset.open, api)));
    $all(api.body, '[data-mark]').forEach((b) => b.addEventListener('click', () => {
      const o = state.orders.find((x) => x.id === b.dataset.mark);
      if (o) markStage(o);
    }));
    api.setStatus('Выкуп №' + w.num + ' · ' + dmy(w.day), 'Цвет карточки = этап выкупа');
  }

  // Карточка = один заказ выкупа: шапка с цветом этапа, строки «как в исходном кабинете»
  // (Орг, Отправка, Упаковка, Своё, Розница, Баланс), итог с органическим сбором и позиции.
  function ocardHtml(o, det, mgr) {
    const s = supBy(o.sup);
    const chg = orderCharge(o);
    const org = orgOf(o);
    const kv = (k, v) => '<div class="pl"><span class="mut">' + k + ':</span><span>' + v + '</span></div>';
    const pos = o.pos.map((p) => '<div class="pl"><b>' + esc(p.art) + '</b><span>' + esc(p.name) +
      (p.size ? ' <span class="mut">(' + esc(p.size) + ')</span>' : '') + '</span>' +
      '<span class="pk">' + p.qty + ' × ' + money(p.price) + ' = <b>' + money(p.qty * p.price) + '</b></span></div>').join('');
    return '<div class="ocard ' + stageCls(o.stage) + '">' +
      '<div class="oh"><span class="num">' + esc(STAGE_CAP[o.stage] || o.stage) + ' ' + esc(o.id) + '</span>' +
      (mgr ? '<button class="mark" data-mark="' + esc(o.id) + '">этап</button>' : '') + '</div>' +
      '<div class="ob">' +
      '<div class="ttl">' + esc(o.sup) + ' <span class="cat">| ' + esc(s.cat) + '</span></div>' +
      '<div class="pl"><span class="mut">' + dt(o.date) + '</span><span class="pk">' + o.items + ' шт · ' + money(o.sum) + '</span></div>' +
      (det ? [
        o.comment && kv('Комментарий', esc(o.comment)),
        kv('Орг', money(org) + ' <span class="mut">(' + (D.orgPct || 0) + '%)</span>'),
        kv('Отправка', esc(o.send) + (o.track ? ' · трек <span class="money">' + esc(o.track) + '</span>' : '')),
        o.pack && kv('Упаковка', esc(o.pack)),
        o.own && kv('Своё', esc(o.own)),
        o.retail && o.retail.q ? kv('Розница', o.retail.q + ' × ' + money(o.retail.p)) : '',
        kv('Баланс', chg === null ? '<span class="mut">ещё не тронут</span>'
          : chg === 0 ? '<span class="mut">деньги на балансе</span>'
            : '<span class="minus">' + money(chg) + '</span>')
      ].filter(Boolean).join('') : '<div class="pl"><span class="mut">' + o.pos.length + ' строк · подробности скрыты</span></div>') +
      '<div class="osep"></div>' +
      '<div class="pl"><b>Итог</b><span class="pk"><b class="money">' + money(o.sum + org) + '</b></span></div>' +
      (det ? '<div class="osep"></div>' + pos : '') +
      '<div class="ofoot"><button class="obtn" data-open="' + esc(o.id) + '">Открыть</button>' +
      (o.prepay ? '<span class="pill gray">предоплата</span>' : '') + '</div>' +
      '</div></div>';
  }

  /* ----- уровень 3: все заказы плоским списком ----- */
  function viewAllOrders(api, f) {
    const q = f.q.trim().toLowerCase();
    const nums = {};
    wykups().forEach((w) => { nums[w.day] = w.num; });
    const rows = state.orders.filter((o) => stageOn(f, o.stage) && oMatch(o, q))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const pg = pager(rows.length, f.page, f.per);
    const slice = rows.slice((pg.page - 1) * f.per, pg.page * f.per);

    api.body.innerHTML =
      '<div class="toolbar">' +
      '<button class="btn" data-a="back">← выкупы</button>' +
      '<button class="btn def" data-a="new">' + ico('plus', 16) + ' Создать заказ</button>' +
      '<input type="search" data-f="q" placeholder="№ заказа или артикул" value="' + esc(f.q) + '" style="width:240px">' +
      '<button class="btn sm" data-a="reset">Сбросить</button>' +
      '<span class="spacer"></span><span class="mut">Всего на сумму: <b>' + money(rows.reduce((a, o) => a + o.sum, 0)) + '</b></span></div>' +
      '<div class="toolbar">' + stageSwitches(f) +
      '<span class="spacer"></span><span class="mut">Записей на страницу</span>' +
      '<select data-f="per">' + [10, 25, 50].map((n) => '<option' + (f.per === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div class="grid-wrap in" style="flex:1;margin-bottom:8px"><table class="grid"><thead><tr>' +
      '<th>№ заказа</th><th>Выкуп</th><th>Дата</th><th>Поставщик</th><th class="ctr">Позиций</th><th class="num">Сумма</th>' +
      '<th class="ctr">Предоплата</th><th>Этап</th><th>Доставка</th><th>Трек</th><th>Комментарий</th></tr></thead><tbody>' +
      (slice.length ? slice.map((o) => {
        const day = String(o.date).slice(0, 10);
        return '<tr data-id="' + esc(o.id) + '">' +
          '<td><span class="link">' + esc(o.id) + '</span></td>' +
          '<td class="sub vykp"><span class="link" data-day="' + day + '">№ ' + (nums[day] || '—') + '</span></td>' +
          '<td class="sub">' + dt(o.date) + '</td>' +
          '<td>' + esc(o.sup) + '<div class="sub">' + esc(supBy(o.sup).name) + '</div></td>' +
          '<td class="ctr">' + o.items + '</td><td class="num money">' + money(o.sum) + '</td>' +
          '<td class="ctr">' + (o.prepay ? '✔' : '—') + '</td>' +
          '<td><span class="pill ' + stageCls(o.stage) + '">' + esc(o.stage) + '</span></td>' +
          '<td class="sub">' + esc(o.send) + '</td>' +
          '<td class="sub">' + (o.track ? '<span class="link" data-track="' + esc(o.track) + '">' + esc(o.track) + '</span>' : '—') + '</td>' +
          '<td class="sub">' + esc(o.comment) + '</td></tr>';
      }).join('') : '<tr><td colspan="11" class="empty">Заказов под текущие фильтры нет.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="toolbar" style="border-top:1px solid var(--sha)">' + pg.html +
      '<span class="spacer"></span><span class="mut">Клик по № заказа — карточка, клик по № выкупа — цветные карточки дня</span></div>';

    const redraw = () => mount(api, 'orders');
    bindSearch(api.body, f, redraw);
    bindStageSwitches(api.body, f, redraw);
    bindPager(api.body, f, redraw);
    $all(api.body, 'tr[data-id]').forEach((tr) => {
      tr.addEventListener('dblclick', () => openOrder(tr.dataset.id, api));
      tr.querySelector('.link').addEventListener('click', () => openOrder(tr.dataset.id, api));
    });
    $all(api.body, '[data-day]').forEach((a) => a.addEventListener('click', (e) => {
      e.stopPropagation();
      f.all = false; f.day = a.dataset.day; f.page = 1; redraw();
    }));
    $all(api.body, '[data-track]').forEach((a) => a.addEventListener('click', (e) => {
      e.stopPropagation();
      Shell.alert('Трек-номер ' + a.dataset.track + '\nСтатус: «в пути», последняя сканировка — сортировочный центр «Люблино».', 'Отслеживание');
    }));
    api.body.querySelector('[data-a="back"]').addEventListener('click', () => { f.all = false; f.page = 1; redraw(); });
    api.body.querySelector('[data-a="reset"]').addEventListener('click', () => { f.q = ''; f.page = 1; redraw(); });
    api.body.querySelector('[data-a="new"]').addEventListener('click', () => newOrderWizard(api));
    api.setStatus('Заказов: ' + rows.length, 'Плоский список по всей истории');
  }

  /* ----- пометка этапа (только в роли посредника) ----- */
  function markStage(o) {
    const opts = (NEXT_STAGES[o.stage] || D.orderStages).filter((s) => s !== o.stage);
    Shell.dialog({
      title: 'Этап ' + o.id, icon: 'tag',
      text: STAGE_CAP[o.stage] + ' ' + o.id + ' · ' + supBy(o.sup).name + ' · ' + money(o.sum) +
        '. Сейчас: «' + o.stage + '». Выберите, что с позицией стало.',
      form: '<div class="col" style="gap:8px;padding-top:8px">' + opts.map((s, i) =>
        '<label class="sw"><input type="radio" name="st" value="' + esc(s) + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<i></i><span class="tag ' + stageCls(s) + '">' + esc(STAGE_CAP[s] || s) + '</span>' +
        '<span class="mut">' + esc(STAGE_HINT[s]) + '</span></label>').join('') + '</div>',
      buttons: ['Пометить', 'Отмена']
    }).then((v) => {
      if (v !== 'Пометить') return;
      const next = Shell.formValue('[data-form] input[name="st"]:checked');
      if (next) applyStage(o, next);
    });
  }

  function applyStage(o, next) {
    if (next === 'Выдача' && !o.track) {
      Shell.prompt('Позиция уходит на отправку. Трек-номер (можно оставить пустым — посредник впишет позже):',
        '', 'ВЫдача ' + o.id).then((t) => {
          if (t === null) return;
          o.track = t.trim();
          setStage(o, next);
        });
      return;
    }
    setStage(o, next);
  }

  function setStage(o, next) {
    o.stage = next;
    // с отменённого и невыкупленного трек-номер снимается — отправлять нечего
    if (next === 'Невыкуп' || next === 'Отменён') o.track = '';
    save();
    refreshAll();
  }

  function openOrder(id, api) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    const day = String(o.date).slice(0, 10);
    const w = wykupOf(day);
    Shell.openWindow({
      id: 'order-' + id, title: id + ' — ' + supBy(o.sup).name, icon: 'doc', w: 620, h: 440,
      menu: [
        { label: '&Файл', items: [{ label: 'Обновить', action: () => openOrder(id, api) }, '-', { label: 'Закрыть', action: () => Shell.close('order-' + id) }] },
        { label: '&Заказ', items: [
          { label: 'Добавить замену', icon: 'refresh', action: () => Shell.prompt('Артикул позиции, которую нужно заменить', '', 'Замена позиции').then((v) => { if (v) Shell.alert('Замена на ' + v + ' запрошена у посредника. Ответ — в группе.', 'Замена'); }) },
          { label: 'Сменить этап', icon: 'tag', action: () => editOrderStage(o, api) },
          { label: 'Отменить заказ', icon: 'stop', dis: ['Отменён', 'Получено'].includes(o.stage), action: () => cancelOrder(o, api) }
        ] }
      ],
      render(w2) {
        const chg = orderCharge(o);
        w2.body.innerHTML =
          '<div class="pad">' +
          '<div class="row wrap"><span class="pill ' + stageCls(o.stage) + '">' + esc(o.stage) + '</span>' +
          '<b>' + esc(o.id) + '</b><span class="mut">от ' + dt(o.date) + '</span>' +
          (w ? '<span class="link" data-a="day">выкуп №' + w.num + '</span>' : '') +
          '<span class="spacer"></span><b class="money">' + money(o.sum) + '</b></div>' +
          '<div class="hr"></div>' +
          '<div class="row wrap"><span class="mut">Поставщик:</span><b>' + esc(o.sup) + ' · ' + esc(supBy(o.sup).name) + '</b>' +
          '<span class="mut">ТЦ:</span>' + esc(D.tc[supBy(o.sup).tc]) +
          '<span class="mut">Доставка:</span>' + esc(o.send) + (o.track ? ' · трек ' + esc(o.track) : '') +
          '<span class="mut">Предоплата:</span>' + (o.prepay ? 'да' : 'нет') + '</div>' +
          '<div class="row wrap" style="margin-top:6px"><span class="mut">Сбор посредника ' + (D.orgPct || 0) + '%:</span>' +
          '<b>' + money(orgOf(o)) + '</b><span class="mut">ушло с баланса:</span>' +
          '<b class="minus">' + (chg ? money(chg) : '—') + '</b></div>' +
          (o.comment ? '<div class="mut" style="margin-top:6px">Комментарий: ' + esc(o.comment) + '</div>' : '') +
          (o.own ? '<div class="mut" style="margin-top:2px">Особая отметка: ' + esc(o.own) + '</div>' : '') +
          '<fieldset class="group"><legend>Состав заказа</legend>' +
          '<div class="grid-wrap in" style="max-height:180px"><table class="grid"><thead><tr>' +
          '<th>Артикул</th><th>Наименование</th><th>Размер</th><th class="ctr">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th></tr></thead><tbody>' +
          o.pos.map((p) => '<tr><td><b>' + esc(p.art) + '</b></td><td>' + esc(p.name) + '</td><td class="sub">' + esc(p.size || '—') + '</td>' +
            '<td class="ctr">' + p.qty + '</td><td class="num">' + money(p.price) + '</td><td class="num">' + money(p.qty * p.price) + '</td></tr>').join('') +
          '</tbody></table></div></fieldset>' +
          '<div class="row wrap" data-btnrow style="margin-top:8px">' +
          (state.role === 'manager' ? '<button class="btn def" data-a="mark">Пометить этап</button>' : '') +
          '<button class="btn blue" data-a="status">Сменить этап</button>' +
          '<button class="btn" data-a="print">' + ico('notepad', 16) + ' Распечатать накладную</button></div>' +
          '</div>';
        const mk = w2.body.querySelector('[data-a="mark"]');
        if (mk) mk.addEventListener('click', () => markStage(o));
        w2.body.querySelector('[data-a="status"]').addEventListener('click', () => editOrderStage(o, api));
        w2.body.querySelector('[data-a="print"]').addEventListener('click', () => Shell.alert('Накладная ' + o.id + ' отправлена на печать.\nПринтер: HP LaserJet 1100', 'Печать'));
        const dl = w2.body.querySelector('[data-a="day"]');
        if (dl) dl.addEventListener('click', () => {
          Shell.close('order-' + o.id);
          state.filters.orders.day = day; state.filters.orders.all = false; refreshAll();
        });
        w2.setStatus('Готово', 'Итог по позициям: ' + money(o.pos.reduce((a, p) => a + p.qty * p.price, 0)));
      }
    });
  }

  function editOrderStage(o, api) {
    Shell.dialog({
      title: 'Этап ' + o.id, icon: 'gear',
      text: 'Выберите этап выкупа. Пометка «ВЫдача» означает, что позиция ушла на отправку.',
      form: '<select id="st" style="width:100%">' + D.orderStages.map((s) =>
        '<option' + (s === o.stage ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select>',
      buttons: ['Сохранить', 'Отмена']
    }).then((v) => {
      if (v !== 'Сохранить') return;
      const val = Shell.formValue('#st');
      if (!val || val === o.stage) return;
      applyStage(o, val);
      Shell.close('order-' + o.id);
    });
  }

  function cancelOrder(o, api) {
    Shell.confirm('Отменить заказ ' + o.id + ' на сумму ' + money(o.sum) + '?\nПредоплата вернётся на баланс.', 'Отмена заказа')
      .then((yes) => {
        if (!yes) return;
        if (o.prepay && !['Невыкуп', 'Отменён'].includes(o.stage)) moveBalance(o.sum, 'Возврат', o.id, 'Отменён заказ ' + o.id);
        o.stage = 'Отменён';
        save();
        refreshAll();
        Shell.close('order-' + o.id);
        Shell.alert('Заказ отменён, этап «ОТМЕНЁН».', 'Готово');
      });
  }

  function topUp() {
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
  }

  function newOrderWizard(api, day) {
    const lines = [{ art: '', name: '', qty: 1, price: 0 }];
    // Дата выкупа, на которую навешиваются позиции: по умолчанию сегодня,
    // из карточек дня она приходит уже выбранной.
    let chosen = day || nowStamp().slice(0, 10);
    Shell.openWindow({
      id: 'neworder', title: 'Позиции на выкуп', icon: 'cart', w: 560, h: 460,
      render(w) {
        const draw = () => {
          const dayList = wykups();
          const onDay = dayList.find((x) => x.day === chosen);
          w.body.innerHTML =
            '<div class="pad col">' +
            '<div class="row"><span class="mut" style="width:110px">Выкуп (дата):</span>' +
            '<input type="date" data-k="day" value="' + esc(chosen) + '" list="vykup-days" style="flex:1">' +
            '<datalist id="vykup-days">' + dayList.slice(0, 14).map((x) => '<option value="' + x.day + '">выкуп №' + x.num + '</option>').join('') + '</datalist></div>' +
            '<div class="mut" style="margin-left:110px">Этот номер уже существует — позиции встанут в него.' +
            (onDay ? ' Сейчас в выкупе №' + onDay.num + ' — ' + onDay.list.length + ' зак. на ' + money(onDay.list.reduce((a, o) => a + o.sum, 0)) + '.'
                   : ' Для этой даты выкуп будет создан новый.') + '</div>' +
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
          w.body.querySelector('[data-k="day"]').addEventListener('change', (e) => {
            if (e.target.value) { chosen = e.target.value; draw(); }
          });
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
            // номер = следующий за максимальным использованным: на 130+ заказах
            // прежняя формула «2419 + число заказов серии З-24xx» выдавала дубли
            const numMax = state.orders.reduce((a, o) => Math.max(a, parseInt(String(o.id).replace(/\D/g, ''), 10) || 0), 0);
            const id = 'З-' + (numMax + 1);
            const o = { id, date: chosen + ' ' + nowStamp().slice(11), sup, stage: 'Заказ', items: pos.reduce((a, l) => a + l.qty, 0), sum, prepay, send, track: '', comment, pos: pos.map((l) => ({ art: l.art, name: l.name || l.art, qty: l.qty, price: l.price, size: '' })) };
            state.orders.unshift(o);
            state.filters.orders.day = chosen;
            state.filters.orders.all = false;
            if (prepay) moveBalance(-sum, 'Списание', id, 'Предоплата заказа ' + id);
            else save();
            refreshAll();
            Shell.close('neworder');
            Shell.alert('Заказ ' + id + ' на сумму ' + money(sum) + ' добавлен в выкуп ' + dmy(chosen) + '.\nЭтап «ЗАКАЗ»: карточка белая, зелёной она станет, когда посредник отметит выкуп.', 'Заказ оформлен');
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
      '<b style="font-size:17px">' + esc(state.collTab) + '</b><span class="spacer"></span>' +
      '<button class="btn sm" data-a="join">' + ico('users', 16) + ' Вступить в сбор</button>' +
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
        '<li><div class="node' + (f.cat === c ? ' sel' : '') + '" data-cat="' + esc(c) + '">' + ico('folder', 16) + esc(c) + '</div></li>').join('') + '</ul></div>' +
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
      '<div class="card" style="min-width:200px"><div class="mut">Баланс</div><div style="font-size:22px;font-weight:600;letter-spacing:-.6px">' + money(state.balance.current) + '</div></div>' +
      '<div class="card" style="min-width:200px"><div class="mut">Заморожено (резерв)</div><div style="font-size:22px;font-weight:600;letter-spacing:-.6px">' + money(state.balance.frozen) + '</div></div>' +
      '<div class="card" style="min-width:200px"><div class="mut">Доступно</div><div style="font-size:22px;font-weight:600;letter-spacing:-.6px" class="pos">' + money(state.balance.current - state.balance.frozen) + '</div></div>' +
      '<span class="spacer"></span>' +
      '<button class="btn def" data-a="top">' + ico('wallet', 16) + ' Пополнить</button>' +
      '<button class="btn" data-a="export">' + ico('save', 16) + ' Выгрузить CSV</button></div>' +
      '<div class="toolbar"><span class="mut">Тип операции:</span><select data-k="type"><option value="">все</option>' +
      types.map((t) => '<option' + (f.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
      '<span class="spacer"></span><span class="mut">Записей: <b>' + mv.length + '</b></span></div>' +
      '<div class="grid-wrap in" style="flex:1;margin-bottom:8px"><table class="grid"><thead><tr>' +
      '<th>Дата</th><th>Тип</th><th>Номер</th><th class="num">Сумма</th><th class="num">Остаток</th><th>Комментарий</th></tr></thead><tbody>' +
      mv.map((m) => '<tr>' +
        '<td class="sub">' + dt(m.date) + '</td><td>' + pill(m.type) + '</td><td class="sub">' + (m.ref ? esc(m.ref) : '—') + '</td>' +
        '<td class="num money ' + (m.sum >= 0 ? 'pos' : 'neg') + '">' + (m.sum >= 0 ? '+' : '') + money(m.sum) + '</td>' +
        '<td class="num sub">' + money(m.after) + '</td><td class="sub">' + esc(m.comment) + '</td></tr>').join('') +
      '</tbody></table></div>';

    api.body.querySelector('[data-k="type"]').addEventListener('change', (e) => { f.type = e.target.value; mount(api, 'balance'); });
    api.body.querySelector('[data-a="top"]').addEventListener('click', () => topUp());
    api.body.querySelector('[data-a="export"]').addEventListener('click', () => {
      const csv = ['дата;тип;номер;сумма;комментарий'].concat(
        state.balance.movements.map((m) => [m.date, m.type, m.ref, m.sum, m.comment.replace(/;/g, ',')].join(';'))).join('\n');
      downloadCsv('sadovod-balance.csv', csv);
      Shell.alert('Файл sadovod-balance.csv сохранён.', 'Выгрузка');
    });
    api.setStatus('Движений: ' + mv.length, 'Доступно: ' + money(state.balance.current - state.balance.frozen));
  }

  /* ---------------- view: Помощь ---------------- */
  function viewHelp(api) {
    api.body.innerHTML =
      '<div class="pad"><b style="font-size:17px">Справка по работе с сервисом</b>' +
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
          '\n\nРаздел доступен из меню «Заказы». Если что-то не сходится — напишите посреднику в группе, ' +
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
      '<div class="cab" style="flex:1;min-height:0;overflow:auto;margin-bottom:16px">' +
      '<div class="pad">' +
      '<div class="row wrap" style="align-items:flex-start;gap:10px">' +
      '<div style="flex:none">' + avatarHtml(64) + '</div>' +
      '<div class="col" style="gap:2px">' +
      '<div style="font-size:20px;font-weight:600;letter-spacing:-.4px">' + esc(D.user.name) + '</div>' +
      '<div class="mut">Код клиента <b style="color:var(--green-text)">№' + D.user.code + '</b> · в кабинете с ' + dt(D.user.since) + '</div>' +
      '<div class="mut">Группа: <b>' + esc(D.user.group) + '</b> · посредник: ' + esc(D.user.manager) + '</div>' +
      '<div class="row" style="gap:10px;margin-top:4px">' +
      '<span class="link" data-soc="vk">' + ico('vk', 16) + ' Группа ВКонтакте</span>' +
      '<span class="link" data-soc="tg">' + ico('tg', 16) + ' Товары группы в Telegram</span></div>' +
      '</div>' +
      '<span class="spacer"></span>' +
      '<div class="card" style="min-width:200px"><div class="mut">Баланс</div>' +
      '<div style="font-size:22px;font-weight:600;letter-spacing:-.6px">' + money(state.balance.current) + '</div>' +
      '<div class="mut" style="margin-top:2px">Доступно: ' + money(state.balance.current - state.balance.frozen) + '</div>' +
      '<span class="link" data-a="tobal">Пополнить и история &raquo;</span></div>' +
      '</div>' +
      '<div class="hr"></div>' +
      '<div class="row wrap" style="align-items:flex-start;gap:8px">' +

      '<div class="col cab-col">' +
      fs('Данные пользователя',
        '<div class="col">' +
        '<div class="row">' + lbl('Имя пользователя:') + '<input data-k="login" value="' + esc(D.user.login) + '" readonly style="flex:1 1 140px" title="Логин задаёт посредник">' +
        '<button class="btn sm" data-a="phone">' + ico('info', 16) + ' Телефон</button></div>' +
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
        '<button class="btn def" data-a="save">' + ico('save', 16) + ' Сохранить</button>' +
        '<button class="btn" data-a="newpass">' + ico('key', 16) + ' Задать новый пароль</button></div>' +
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
      // flex + margin:auto, а не place-items:center: при grid-центровке карточка
      // выше контейнера обрезается снизу и до неё нельзя доскроллить.
      '<div style="flex:1;min-height:0;overflow:auto;display:flex;padding:24px 0">' +
      '<fieldset class="group" style="margin:auto;width:420px;max-width:100%;padding:24px 26px 22px">' +
      '<legend style="font-size:20px;font-weight:600;letter-spacing:-.4px">Авторизация</legend>' +
      '<div class="col" style="gap:14px;margin-top:10px">' +
      '<div class="col" style="gap:6px"><span class="mut" style="font-size:13px">Логин</span>' +
      '<input data-k="l" value="denis.k"></div>' +
      '<div class="col" style="gap:6px"><span class="mut" style="font-size:13px">Пароль</span>' +
      '<input data-k="p" type="password" value="12345"></div>' +
      '<label class="chk"><input type="checkbox" checked><span class="box"></span>Запомнить на этом компьютере</label>' +
      '<div class="row" style="gap:10px"><button class="btn def" data-a="in" style="flex:1">Войти</button>' +
      '<button class="btn" data-a="vk">' + ico('vk', 16) + ' Через ВКонтакте</button></div>' +
      '<div><span class="link" data-a="forgot">Забыли пароль?</span></div>' +
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
  // icon — знак пункта меню: тонкая линия, цвет берёт у текста пункта.
  const VIEWS = {
    sellers: { title: 'Поставщики', icon: 'store', render: viewSellers },
    orders: { title: 'Заказы', icon: 'cart', render: viewOrders },
    collections: { title: 'Сборы', icon: 'layers', render: viewCollections },
    goods: { title: 'Товары', icon: 'box', render: viewGoods },
    balance: { title: 'Баланс', icon: 'chart', render: viewBalance },
    help: { title: 'Помощь', icon: 'help', render: viewHelp },
    account: { title: 'Личный кабинет', icon: 'user', render: viewAccount },
    login: { title: 'Вход', icon: 'key', render: viewLogin }
  };

  const MAIN = 'main';

  // Единственное меню кабинета: ровная строка текстовых кнопок.
  // Вложенные команды («Избранные», «Чёрный список», вкладки сборов, «Создать заказ») живут
  // в самих разделах, отдельное выпадающее меню для них не нужно.
  // Разделы «Поставщики» и «Сборы» пока скрыты из меню: сам код и данные на месте,
  // чтобы вернуть плашку, достаточно убрать ключ из списка.
  const NAV_HIDDEN = ['sellers', 'collections'];
  const navViews = () => ['sellers', 'orders', 'collections', 'goods', 'balance', 'help'].filter((k) => !NAV_HIDDEN.includes(k));

  function toolbarFor() {
    // Пункты меню — обычные ссылки на свои пути: их можно скопировать, открыть в
    // новой вкладке и отправить коллеге, как на asya.sadpos.ru/orders.
    const href = (k) => ' href="' + rootPath() + k + '"';
    const item = (k) => '<a class="btn nav' + (state.view === k ? ' on' : '') + '"' + href(k) + ' data-v="' + k + '">' +
      ico(VIEWS[k].icon, 16) + esc(VIEWS[k].title) + '</a>';
    // Кнопка с именем клиента ведёт в личный кабинет; форма входа нужна только гостю.
    const me = state.logged ? 'account' : 'login';
    // Переключатель роли: «Посредник» включает пометку этапов в заказах.
    const role = '<span class="seg" data-role title="Кто работает в кабинете">' +
      [['client', 'Клиент'], ['manager', 'Посредник']].map((r) =>
        '<button data-r="' + r[0] + '"' + (state.role === r[0] ? ' class="on"' : '') + '>' + r[1] + '</button>').join('') + '</span>';
    return navViews().map(item).join('') +
      '<span class="msep"></span>' +
      '<a class="btn nav me' + (state.view === me ? ' on' : '') + '"' + href(me) + ' data-v="' + me + '">' +
      (state.logged ? avatarHtml(16) + esc(D.user.name) : ico('key', 16) + 'Вход') + '</a>' +
      '<button class="btn nav" data-a="about">' + ico('globe', 16) + 'О программе</button>' +
      (state.logged ? '<button class="btn nav" data-a="exit">' + ico('logout', 16) + 'Выход</button>' : '') +
      '<span class="spacer"></span>' + role +
      '<span class="mut">Баланс: <b>' + money(state.balance.current) + '</b></span>';
  }

  function mount(api, view) {
    state.view = view;
    api.toolbar(toolbarFor());
    $all(api.el, '[data-v]').forEach((b) => b.onclick = (e) => {
      e.preventDefault(); // ссылка нужна для «открыть в новой вкладке», а не для перезагрузки
      go(b.dataset.v);
    });
    $all(api.el, '[data-role] [data-r]').forEach((b) => b.onclick = () => {
      if (state.role === b.dataset.r) return;
      state.role = b.dataset.r;
      save();
      go(state.view);
    });
    const ab = api.el.querySelector('[data-a="about"]');
    if (ab) ab.onclick = openAbout;
    const ex = api.el.querySelector('[data-a="exit"]');
    if (ex) ex.onclick = () => {
      state.logged = false; save(); go('login');
      Shell.alert('Вы вышли из кабинета.', 'Выход');
    };
    VIEWS[view].render(api);
  }

  /* ---------------- адреса разделов ---------------- */
  // У каждого раздела свой путь — /orders, /goods, /balance, как в настоящем
  // кабинете. Статический хостинг отдаёт файл, а не обработчик, поэтому рядом с
  // index.html лежат папки <раздел>/index.html: та же разметка с <base href="../">.
  // Генерирует их node .dev/gen-sections.mjs (вызывается из .dev/push.sh).
  const seg = () => location.pathname.split('/').filter(Boolean);

  // Корень кабинета: из пути убираем имя раздела и index.html — остаётся «/»
  // (или «/podkatalog/», если сайт лежит не в корне домена).
  const rootPath = () => {
    const s = seg();
    if (s.length && (VIEWS[s[s.length - 1]] || s[s.length - 1] === 'index.html')) s.pop();
    return '/' + s.join('/') + (s.length ? '/' : '');
  };

  const viewFromUrl = () => {
    const s = seg();
    const last = (s[s.length - 1] || '').replace(/index\.html$/, '');
    if (VIEWS[last]) return last;
    const q = new URLSearchParams(location.search).get('view');
    return VIEWS[q] ? q : '';
  };

  let booted = false;

  function syncUrl(view, replace) {
    const url = rootPath() + view + location.search;
    if (url === location.pathname + location.search) return;
    try {
      history[replace ? 'replaceState' : 'pushState']({ view }, '', url);
    } catch (e) {
      // file:// pushState запрещён: разделы остаются в памяти, ссылки — рабочими
    }
  }

  function go(view, fromHistory) {
    let api = Shell.getWin(MAIN);
    if (!VIEWS[view]) view = 'orders';
    if (!api) {
      api = Shell.openWindow({
        id: MAIN, title: VIEWS[view].title,
        chrome: false, toolbar: toolbarFor(), status: 'Готово'
      });
      mount(api, view);
    } else {
      api.setTitle(VIEWS[view].title);
      mount(api, view);
    }
    if (!fromHistory) syncUrl(view, !booted);
    booted = true;
    document.title = VIEWS[view].title + ' — Садовод-посредник';
  }

  // «Назад»/«вперёд» браузера должны перематывать разделы, а не только страницу.
  window.addEventListener('popstate', () => {
    const v = viewFromUrl();
    if (v) go(v, true);
  });

  function refreshAll() {
    const api = Shell.getWin(MAIN);
    if (api) { api.setTitle(VIEWS[state.view].title); mount(api, state.view); }
  }

  /* ---------------- about ---------------- */
  function openAbout() {
    Shell.openWindow({
      id: 'about', title: 'О программе', icon: 'globe', w: 460, closeBtn: false, render(w) {
        w.body.innerHTML = '<div class="pad row" style="align-items:flex-start">' +
          '<span class="pill green" style="flex:none;font-size:16px;padding:10px 14px;border-radius:9999px">' + ico('globe', 20) + '</span>' +
          '<div style="flex:1"><b style="font-size:17px">Садовод-посредник</b><br>' +
          'Демонстрация кабинета посредника: база поставщиков рынков «Садовод», «Люблино», «Южные ворота», ' +
          'заказы, сборы и баланс.<br><br>Данные локальные, ничего не отправляется в сеть.' +
          '<div class="hr"></div><span class="mut">Оформление — по дизайн-системе Wise</span></div></div>' +
          '<div class="toolbar mid" data-btnrow style="padding-bottom:18px"><button class="btn def" data-x>Понятно</button></div>';
        w.body.querySelector('[data-x]').addEventListener('click', () => Shell.close('about'));
      }
    });
  }

  /* ---------------- boot ---------------- */
  window.addEventListener('DOMContentLoaded', () => {
    load();
    Shell.boot({ onBoot: () => go(viewFromUrl() || (state.logged ? 'orders' : 'login')) });
  });

  function openSupplier(code) {
    const s = supBy(code);
    if (!s || !s.code) return;
    const paint = (w) => {
      const r = ratingOf(code), mine = state.rates[code];
      const goods = state.goods.filter((g) => g.sup === code);
      w.body.innerHTML = '<div class="pad row" style="align-items:flex-start">' +
        supImgHtml(s, 64) +
        '<div style="flex:1"><div class="row" style="gap:10px"><span style="font-size:18px;font-weight:600;letter-spacing:-.3px">' + esc(s.name) + '</span>' + pill(s.status) + '</div>' +
        '<div class="mut">' + esc(s.pav) + ' · ' + esc(D.tc[s.tc]) + '</div>' +
        '<div class="mut">Чем торгует: <b>' + esc(s.cat) + '</b></div>' +
        '<div class="row" style="align-items:center;margin-top:3px">' + starsBar(r.avg, code, true) +
        '<b>' + fmtAvg(r.avg) + '</b><span class="link" data-reviews="' + esc(code) + '">' + revCount(r.count) + '</span>' +
        (mine ? '<span class="pill blue">моя ' + mine.stars + '</span>' : '') + '</div></div>' +
        '<div class="col" style="gap:4px">' +
        (s.tg ? '<span class="link">' + ico('tg', 16) + ' ' + esc(s.tg) + '</span>' : '') +
        (s.wa ? '<span class="link">' + ico('wa', 16) + ' ' + esc(s.wa) + '</span>' : '') +
        (s.vk ? '<span class="link">' + ico('vk', 16) + ' ' + esc(s.vk) + '</span>' : '') + '</div></div>' +
        '<div class="pad" style="padding-top:0"><div class="card">' + esc(s.note) + '</div>' +
        '<div class="row wrap" style="margin-top:8px">' +
        '<span class="pill">Минималка: ' + s.min + ' шт</span>' +
        '<span class="pill">Отправка: ' + (s.send ? 'есть' : 'нет') + '</span>' +
        '<span class="pill">Самовывоз: ' + (s.pickup ? 'есть' : 'нет') + '</span>' +
        '<span class="pill">Обновлён: ' + dt(s.upd) + '</span></div></div>' +
        '<div class="toolbar"><b>Товары точки (' + goods.length + ')</b></div>' +
        '<div class="grid-wrap in" style="flex:1;margin-bottom:8px"><table class="grid"><thead><tr><th>Артикул</th><th>Наименование</th><th>Размеры</th><th class="ctr">Остаток</th><th class="num">Цена</th></tr></thead><tbody>' +
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
