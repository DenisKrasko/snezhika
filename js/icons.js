/* Иконки 16x16 (inline SVG, без внешних файлов).
   Стиль — тонкая линия цветом текста (currentColor), поэтому иконка сама становится
   тёмной в шапке и серой во вторичном тексте. Цвет держат только смысловые знаки:
   звезда, предупреждение, стоп, мессенджеры. */
window.ico = (function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  // Тонкие внутренние линии: отдельный набор атрибутов, а не второй stroke-width в том
  // же теге — браузер оставляет первое значение.
  const T = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    folder: '<path d="M2 13.2V4.2h4.2L7.6 6H14v7.2z" ' + S + '/>',
    folderOpen: '<path d="M2 13.2V4.2h4.2L7.6 6H14v2H2" ' + S + '/><path d="M2 8.2h12l-1.6 5H3z" ' + S + '/>',
    doc: '<path d="M4 2.2h6l3 3v9.6H4z" ' + S + '/><path d="M10 2.2v3h3" ' + S + '/><path d="M6.2 8.4h4.6M6.2 11h4.6" ' + T + '/>',
    notepad: '<rect x="3" y="2" width="10" height="12.4" rx="2" ' + S + '/><path d="M5.4 5.6h5.2M5.4 8.6h5.2M5.4 11.4h3.2" ' + T + '/>',
    globe: '<circle cx="8" cy="8" r="6.2" ' + S + '/><path d="M1.8 8h12.4M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4" ' + T + '/>',
    user: '<circle cx="8" cy="5.4" r="2.8" ' + S + '/><path d="M3 14c.9-3.2 2.7-4.4 5-4.4s4.1 1.2 5 4.4" ' + S + '/>',
    users: '<circle cx="5.4" cy="5.6" r="2.4" ' + S + '/><path d="M1.6 13.6c.7-2.7 2.1-3.8 3.8-3.8 1.2 0 2.2.5 3 1.4" ' + S + '/><circle cx="11" cy="6.6" r="2.2" ' + S + '/><path d="M7.6 14c.6-2.4 1.8-3.4 3.4-3.4s2.8 1 3.4 3.4" ' + S + '/>',
    cart: '<path d="M1.8 2.6h2.1l1.7 7.2h6.4l1.8-5.4H5.1" ' + S + '/><circle cx="6.4" cy="13" r="1.3" ' + S + '/><circle cx="11.8" cy="13" r="1.3" ' + S + '/>',
    box: '<path d="M8 2.2 14 5.4v5.6L8 14.2 2 11V5.4z" ' + S + '/><path d="M2 5.4 8 8.6l6-3.2M8 8.6v5.6" ' + S + '/>',
    wallet: '<rect x="2" y="4" width="12" height="8.6" rx="2.4" ' + S + '/><path d="M11.6 8.3h2.4" ' + S + '/>',
    help: '<circle cx="8" cy="8" r="6.2" ' + S + '/><path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 2c-.6.4-.8.8-.8 1.5v.4" ' + S + '/><circle cx="8" cy="12" r=".95" fill="currentColor"/>',
    key: '<circle cx="5.6" cy="6" r="3" ' + S + '/><path d="M7.8 8.2 13.8 14.2M11.4 11.2l1.8-1.8" ' + S + '/>',
    search: '<circle cx="6.8" cy="6.8" r="4.2" ' + S + '/><path d="M10 10l4.2 4.2" ' + S + '/>',
    gear: '<circle cx="8" cy="8" r="2.6" ' + S + '/><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4" ' + S + '/>',
    clock: '<circle cx="8" cy="8" r="6.2" ' + S + '/><path d="M8 4.4V8l2.7 1.7" ' + S + '/>',
    save: '<path d="M3 2.6h8l2.6 2.6v8.8H3z" ' + S + '/><path d="M5.6 2.6v3.2h4.8V2.6M5.6 9.6h4.8v4.4H5.6z" ' + S + '/>',
    refresh: '<path d="M13.2 8a5.2 5.2 0 1 1-1.9-4" ' + S + '/><path d="M11.2 1.6 12.3 5.7 8.2 4.6z" fill="currentColor"/>',
    home: '<path d="M2.4 7.6 8 2.8l5.6 4.8M4.3 8.6v5.2h7.4V8.6" ' + S + '/>',
    stop: '<circle cx="8" cy="8" r="6.2" fill="#e0525a"/><path d="M5 5l6 6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    info: '<circle cx="8" cy="8" r="6.6" fill="#2f6fd0"/><path d="M8 7v4.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="4.9" r=".95" fill="#fff"/>',
    warn: '<path d="M8 1.8 15 14H1z" fill="#ffd11a"/><path d="M8 6v4" stroke="#0e0f0c" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="#0e0f0c"/>',
    vk: '<rect x="1" y="2" width="14" height="12" rx="3.5" fill="#4a6f9a"/><path d="M4.6 5.4c.3 2.5 1.8 4.6 3.7 5.3V8.2c-.7-.4-1.2-1.1-1.4-1.8h1.4v3.9c1.8-.7 3-2.5 3.2-4.4H9.6" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    tg: '<circle cx="8" cy="8" r="6.6" fill="#2aabee"/><path d="M3.6 8.1 12.4 4.6l-1.4 6.7-2.2-2.4-1.6 1.5z" fill="#fff"/>',
    wa: '<circle cx="8" cy="8" r="6.6" fill="#4fc455"/><path d="M5.5 4.7 7.2 7.5l-1 .9c.8 1.6 2 2.7 3.5 3.4l.9-1 2.8 1.7c-.4 1.3-1.8 1.9-3.1 1.5C6.7 13.3 3.2 9.8 2.6 6.4c-.2-1.3.5-1.9 2.9-1.7z" fill="#fff"/>',
    star: '<path d="M8 2.2 9.8 6l4.2.6-3.1 2.9.8 4.1L8 11.7l-3.7 1.9.8-4.1L2 6.6 6.2 6z" fill="#ffd11a"/>',
    trash: '<path d="M3.2 5.2h9.6l-.8 9.2H4z" ' + S + '/><path d="M2 5.2h12M6.2 5.2V3.4h3.6v1.8" ' + S + '/><path d="M6.4 7.6v4.6M9.6 7.6v4.6" ' + T + '/>',
    network: '<rect x="1.8" y="2" width="5" height="4" rx="1.2" ' + S + '/><rect x="9.2" y="10" width="5" height="4" rx="1.2" ' + S + '/><path d="M4.3 6v3h7.4" ' + S + '/>',
    chart: '<path d="M2.4 2.4v11.2h11.2" ' + S + '/><path d="M5.4 13.4V8.6M8.4 13.4V5.4M11.4 13.4v-3.4" stroke="#50bf39" stroke-width="2.2" stroke-linecap="round"/>',
    tag: '<path d="M2.2 2.2h5.4L14 8.6 8.6 14 2.2 8z" ' + S + '/><circle cx="5.1" cy="5.1" r="1.1" fill="currentColor"/>',
    lock: '<rect x="3" y="6.8" width="10" height="7.4" rx="2" ' + S + '/><path d="M5.6 6.8V5.2a2.4 2.4 0 0 1 4.8 0v1.6" ' + S + '/>',
    eye: '<path d="M1.7 8S4.1 3.6 8 3.6 14.3 8 14.3 8 11.9 12.4 8 12.4 1.7 8 1.7 8z" ' + S + '/><circle cx="8" cy="8" r="2.1" ' + S + '/>',
    scan: '<path d="M2.4 5.4V2.4h3M10.6 2.4h3v3M13.6 10.6v3h-3M5.4 13.6h-3v-3" ' + S + '/><path d="M2.4 8h11.2" ' + T + '/>',
    pencil: '<path d="M2.8 13.2l.7-2.8 7.5-7.5 2.1 2.1-7.5 7.5z" ' + S + '/><path d="M10.2 4 12.3 6.1" ' + T + '/>',
    plus: '<path d="M8 3.2v9.6M3.2 8h9.6" ' + S + '/>',
    upload: '<path d="M8 11.4V3.2M4.9 6.3 8 3.2l3.1 3.1" ' + S + '/><path d="M2.6 13h10.8" ' + S + '/>',
    check: '<path d="M3 8.4 6.3 11.8l6.7-8" ' + S + '/>',
    zip: '<path d="M2.6 2.6h10.8v2.8H2.6z" ' + S + '/><path d="M3.8 5.4h8.4v8.2H3.8z" ' + S + '/><path d="M7.2 2.6v2.2M8.8 4v2M7.2 6.2v2.2M8.8 7.6v2" ' + T + '/>',
    excel: '<path d="M3 2.4h10v11.2H3z" ' + S + '/><path d="M3 6.2h10M6.6 6.2v7.4M9.8 6.2v7.4" ' + T + '/>',
    // Знаки меню разделов: витрина, стопка лотов и выход из кабинета.
    store: '<path d="M2.6 5.4 3.8 2.4h8.4l1.2 3z" ' + S + '/><path d="M3.6 5.4v8.2h8.8V5.4" ' + S + '/><path d="M6.4 13.6V9.2h3.2v4.4" ' + T + '/>',
    layers: '<path d="M8 2.2 14 5.2 8 8.2 2 5.2z" ' + S + '/><path d="M2.6 8.4 8 11l5.4-2.6M2.6 11.4 8 14l5.4-2.6" ' + T + '/>',
    logout: '<path d="M6.6 2.6H2.8v10.8h3.8" ' + S + '/><path d="M10.4 5.4 13.2 8l-2.8 2.6M6.4 8h6.6" ' + S + '/>'
  };

  return function ico(name, size) {
    const s = size || 16;
    const body = P[name] || P.doc;
    return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 16 16" ' +
      'focusable="false" aria-hidden="true">' + body + '</svg>';
  };
})();
