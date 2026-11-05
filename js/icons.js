/* Пиксельные иконки 16x16 в духе Win98 (inline SVG, без внешних файлов). */
window.ico = (function () {
  const P = {
    computer: '<rect x="1" y="2" width="14" height="9" fill="#c0c0c0" stroke="#000"/><rect x="2" y="3" width="12" height="7" fill="#008080"/><rect x="4" y="12" width="8" height="2" fill="#c0c0c0" stroke="#000"/><rect x="2" y="14" width="12" height="1" fill="#808080"/>',
    folder: '<path d="M1 4h5l1 1h8v9H1z" fill="#ffd873" stroke="#8a6d1f"/><path d="M1 4h5l1 1h8" fill="none" stroke="#fff6d0"/>',
    folderOpen: '<path d="M1 4h5l1 1h7v2H3z" fill="#ffd873" stroke="#8a6d1f"/><path d="M2 7h13l-2 7H1z" fill="#ffe9a8" stroke="#8a6d1f"/>',
    doc: '<path d="M3 1h7l3 3v11H3z" fill="#fff" stroke="#000"/><path d="M10 1v3h3" fill="#c0c0c0" stroke="#000"/><path d="M5 7h6M5 9h6M5 11h4" stroke="#4a6f9a"/>',
    notepad: '<rect x="2" y="1" width="12" height="14" fill="#fff" stroke="#000"/><path d="M2 4h12" stroke="#000"/><path d="M4 7h8M4 9h8M4 11h6" stroke="#7a7a7a"/>',
    globe: '<circle cx="8" cy="8" r="6.5" fill="#4f9fd8" stroke="#003c66"/><path d="M1.5 8h13M8 1.5v13M3 4c3 2 7 2 10 0M3 12c3-2 7-2 10 0" fill="none" stroke="#dff0ff"/>',
    user: '<circle cx="8" cy="5" r="3" fill="#ffd8a8" stroke="#7a4a1f"/><path d="M2 15c1-4 3-5 6-5s5 1 6 5z" fill="#4a6f9a" stroke="#1f3a5c"/>',
    users: '<circle cx="5" cy="5" r="2.6" fill="#ffd8a8" stroke="#7a4a1f"/><circle cx="11" cy="5" r="2.6" fill="#ffd8a8" stroke="#7a4a1f"/><path d="M1 15c.6-4 2-5 4-5s3.4 1 4 5z" fill="#4a6f9a" stroke="#1f3a5c"/><path d="M8 15c.6-4 2-5 4-5s3.4 1 4 5z" fill="#6f9ac4" stroke="#1f3a5c"/>',
    cart: '<path d="M1 2h2l2 8h8l2-6H5" fill="none" stroke="#000"/><circle cx="6" cy="13" r="1.6" fill="#000"/><circle cx="12" cy="13" r="1.6" fill="#000"/>',
    box: '<path d="M1 5l7-4 7 4v7l-7 4-7-4z" fill="#d9b779" stroke="#6b4a1f"/><path d="M1 5l7 4 7-4M8 9v7" fill="none" stroke="#6b4a1f"/>',
    wallet: '<rect x="1" y="4" width="14" height="9" fill="#8b6b3f" stroke="#3d2c14"/><rect x="9" y="7" width="5" height="3" fill="#ffd873" stroke="#3d2c14"/><path d="M1 6h14" stroke="#3d2c14"/>',
    help: '<rect x="2" y="1" width="12" height="14" fill="#fff" stroke="#000"/><path d="M6 5a2 2 0 1 1 3 2c-.8.6-1 1-1 2" fill="none" stroke="#000080" stroke-width="1.4"/><rect x="7.2" y="10.5" width="1.6" height="1.6" fill="#000080"/>',
    key: '<circle cx="5" cy="6" r="3" fill="#ffd873" stroke="#7a5a10"/><path d="M7 8l7 7M11 12l2-2M13 14l2-2" stroke="#7a5a10" stroke-width="1.6" fill="none"/>',
    search: '<circle cx="6.5" cy="6.5" r="4" fill="#dff0ff" stroke="#003c66" stroke-width="1.6"/><path d="M10 10l5 5" stroke="#003c66" stroke-width="2"/>',
    gear: '<circle cx="8" cy="8" r="3" fill="#c0c0c0" stroke="#000"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2" stroke="#000" stroke-width="1.6"/>',
    clock: '<circle cx="8" cy="8" r="6.5" fill="#fff" stroke="#000"/><path d="M8 4v4l3 2" fill="none" stroke="#000080" stroke-width="1.4"/>',
    save: '<rect x="2" y="2" width="12" height="12" fill="#4a6f9a" stroke="#000"/><rect x="5" y="2" width="6" height="4" fill="#c0c0c0" stroke="#000"/><rect x="4" y="9" width="8" height="5" fill="#fff"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-2-4" fill="none" stroke="#000080" stroke-width="2"/><path d="M11 1l2 3-4 1z" fill="#000080"/>',
    home: '<path d="M1 8L8 2l7 6" fill="none" stroke="#000" stroke-width="1.6"/><path d="M3 8v7h10V8z" fill="#d9b779" stroke="#000"/><rect x="6.5" y="10" width="3" height="5" fill="#7a4a1f"/>',
    stop: '<circle cx="8" cy="8" r="6.5" fill="#d00" stroke="#600"/><path d="M3 13l10-10" stroke="#fff" stroke-width="2"/>',
    info: '<circle cx="8" cy="8" r="6.5" fill="#000080" stroke="#003"/><rect x="7.2" y="4" width="1.6" height="1.6" fill="#fff"/><rect x="7.2" y="7" width="1.6" height="5" fill="#fff"/>',
    warn: '<path d="M8 1l7 13H1z" fill="#ffd873" stroke="#7a5a10"/><rect x="7.2" y="6" width="1.6" height="4" fill="#000"/><rect x="7.2" y="11" width="1.6" height="1.6" fill="#000"/>',
    vk: '<rect x="1" y="2" width="14" height="12" rx="2" fill="#45688e"/><text x="8" y="11" font-family="Tahoma" font-size="7" font-weight="bold" fill="#fff" text-anchor="middle">BK</text>',
    tg: '<circle cx="8" cy="8" r="7" fill="#36a5d6"/><path d="M3.5 8.2l8-3-1.4 6.6-2.2-2.4-1.6 1.4z" fill="#fff"/>',
    wa: '<circle cx="8" cy="8" r="7" fill="#4fc455"/><path d="M5.4 4.6l1.8 3-1 1c.8 1.6 2 2.8 3.6 3.6l1-1 3 1.8c-.4 1.4-2 2-3.4 1.6C7 13.6 3 9.6 2.4 6.6c-.2-1.4.6-2 3-2z" fill="#fff"/>',
    star: '<path d="M8 1l2 4.4 4.8.5-3.6 3.2 1 4.7L8 11.3 3.8 13.8l1-4.7L1.2 5.9 6 5.4z" fill="#ffd873" stroke="#7a5a10"/>',
    trash: '<path d="M3 5h10l-1 10H4z" fill="#c0c0c0" stroke="#000"/><path d="M2 4h12" stroke="#000" stroke-width="1.6"/><path d="M6 2h4v2H6z" fill="#c0c0c0" stroke="#000"/><path d="M6.5 7v6M9.5 7v6" stroke="#808080"/>',
    network: '<rect x="1" y="2" width="6" height="5" fill="#c0c0c0" stroke="#000"/><rect x="9" y="9" width="6" height="5" fill="#c0c0c0" stroke="#000"/><path d="M4 7v4h8" fill="none" stroke="#000080" stroke-width="1.4"/>',
    chart: '<rect x="1" y="1" width="14" height="14" fill="#fff" stroke="#000"/><rect x="3" y="9" width="2.5" height="4" fill="#000080"/><rect x="7" y="5" width="2.5" height="8" fill="#1084d0"/><rect x="11" y="7" width="2.5" height="6" fill="#4fc455"/>',
    tag: '<path d="M1 1h7l7 7-7 7-7-7z" fill="#d5f0d5" stroke="#006400"/><circle cx="4.5" cy="4.5" r="1.4" fill="#fff" stroke="#006400"/>',
    lock: '<rect x="3" y="7" width="10" height="8" fill="#ffd873" stroke="#7a5a10"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#7a5a10" stroke-width="1.6"/>'
  };

  return function ico(name, size) {
    const s = size || 16;
    const body = P[name] || P.doc;
    return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 16 16" ' +
      'shape-rendering="crispEdges" focusable="false" aria-hidden="true">' + body + '</svg>';
  };
})();
