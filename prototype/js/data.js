/* MRAK8 prototype — seed data. Everything marked todo:true is a placeholder to fill in CONTROL ROOM. */
(function () {
  'use strict';
  const P = window.M8_PHOTOS || {};
  const DAY = 864e5;

  /* technical flats for items that have no photos yet (drawn like a tech pack, not faked as photos) */
  const FLAT = {
    tee: `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
      <path d="M150 58C165 86 235 86 250 58L318 78 386 150 342 188 306 154V352H94V154L58 188 14 150 82 78Z" fill="#101010"/>
      <path d="M160 63C174 92 226 92 240 63" />
      <path d="M94 340H306M318 92 372 150M82 92 28 150" stroke-dasharray="3 4" stroke-opacity=".5"/>
      <path d="M200 92V352" stroke-dasharray="10 4 2 4" stroke-opacity=".25"/>
      <rect x="128" y="124" width="144" height="66" stroke="#E0241B" stroke-dasharray="4 4" stroke-opacity=".7"/>
      <text x="200" y="152" text-anchor="middle" fill="#E0241B" stroke="none" font-family="Roboto Condensed" font-weight="800" font-size="21" letter-spacing="1">NO EMOTIONAL</text>
      <text x="200" y="176" text-anchor="middle" fill="#E0241B" stroke="none" font-family="Roboto Condensed" font-weight="800" font-size="21" letter-spacing="1">CONTRABAND.</text>
      <path d="M94 376H306M94 370V382M306 370V382" stroke-opacity=".6"/>
      <text x="200" y="394" text-anchor="middle" fill="currentColor" stroke="none" font-family="JetBrains Mono" font-size="10" opacity=".7">ШИРИНА 61 · TODO</text>
      <path d="M362 58V352M356 58H368M356 352H368" stroke-opacity=".6"/>
      <text x="376" y="210" fill="currentColor" stroke="none" font-family="JetBrains Mono" font-size="10" opacity=".7" transform="rotate(90 376 210)" text-anchor="middle">ДЛИНА 72</text>
    </svg>`,
    beanie: `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
      <path d="M104 244C98 146 150 94 200 94S302 146 296 244Z" fill="#101010"/>
      <path d="M200 94V244M152 110C134 150 128 200 130 244M248 110C266 150 272 200 270 244M118 160C150 150 250 150 282 160" stroke-opacity=".3"/>
      <rect x="92" y="244" width="216" height="76" fill="#101010"/>
      <path d="M100 252V312M110 252V312M120 252V312M130 252V312M140 252V312M150 252V312M160 252V312M240 252V312M250 252V312M260 252V312M270 252V312M280 252V312M290 252V312M300 252V312" stroke-opacity=".35"/>
      <rect x="170" y="266" width="60" height="30" fill="#E0241B" stroke="none"/>
      <text x="200" y="286" text-anchor="middle" fill="#F1ECE1" stroke="none" font-family="Roboto Condensed" font-weight="800" font-size="14" letter-spacing="1">MRAK8</text>
      <path d="M92 346H308M92 340V352M308 340V352" stroke-opacity=".6"/>
      <text x="200" y="368" text-anchor="middle" fill="currentColor" stroke="none" font-family="JetBrains Mono" font-size="10" opacity=".7">ОБХВАТ 56 · ONE SIZE</text>
    </svg>`,
  };

  const SIZES_001 = [
    // h: height band (cm) for the height ruler; m: [length, chest width, sleeve] cm. ALL TODO
    { s: 'XS', stock: 2, h: [155, 163], m: [66, 56, 58] },
    { s: 'S', stock: 6, h: [163, 171], m: [68, 58, 59] },
    { s: 'M', stock: 9, h: [171, 179], m: [70, 61, 60] },
    { s: 'L', stock: 3, h: [179, 187], m: [72, 64, 61] },
    { s: 'XL', stock: 0, h: [187, 195], m: [74, 67, 62] },
  ];

  M8.products = [
    {
      id: '001', no: '001', slug: 'zip-hoodie-ne-dizainer', sig: 'SIG.001',
      title: 'ZIP-HOODIE «НЕ ДИЗАЙНЕР»', name: 'ZIP-HOODIE', sub: '«НЕ ДИЗАЙНЕР»',
      cat: 'hoodie', catLabel: 'ХУДИ', price: 6900, old: null, status: 'live', batch: '1/50', color: 'КРЕМ',
      todo: { price: true, sizes: true },
      photo: { front: 'assets/products/001/front', back: 'assets/products/001/back' },
      lqip: { front: P['001'] && P['001'].front.lqip, back: P['001'] && P['001'].back.lqip },
      bbox: { front: (P['001'] && P['001'].front.bbox) || [2, 4, 98, 95], back: (P['001'] && P['001'].back.bbox) || [1, 4, 99, 95] },
      sizes: SIZES_001,
      proto: [
        ['МАТЕРИАЛ', 'футер 3-нитка, 100% хлопок', true],
        ['ПЛОТНОСТЬ', '420 г/м²', true],
        ['ПОСАДКА', 'оверсайз, спущенное плечо'],
        ['ЦВЕТ', 'крем (молочный)'],
        ['ПРИНТ', '«НЕ ДИЗАЙНЕР» — грудь; CENTRAL BOOKING — спина', true],
        ['ВЫШИВКА', '«Mrak8» — капюшон'],
        ['ФУРНИТУРА', 'металлическая молния'],
        ['ПАРТИЯ', '1/50'],
        ['УХОД', '30°, наизнанку, без отжима', true],
      ],
      hot: {
        front: [
          { x: 48.3, y: 24.4, t: 'ВЫШИВКА «Mrak8»', s: 'КАПЮШОН · КРАСНАЯ НИТЬ' },
          { x: 63, y: 47.6, fx: 57.6, fy: 42.2, t: 'ПРИНТ «НЕ ДИЗАЙНЕР»', s: 'ГРУДЬ · ПЕРЕД' },
          { x: 78.5, y: 33.5, t: 'ВСТАВКА НА ПЛЕЧЕ', s: 'КОНТРАСТНАЯ ПАНЕЛЬ' },
        ],
        back: [
          { x: 50.5, y: 46.6, fx: 50.5, fy: 40.6, t: 'CENTRAL BOOKING & INTAKE', s: 'СПИНА · ТРИ СТРОКИ' },
          { x: 48.5, y: 14, t: 'КАПЮШОН', s: 'ВИД СЗАДИ' },
          { x: 76, y: 30, t: 'ВСТАВКА НА ПЛЕЧЕ', s: 'ВИД СЗАДИ' },
        ],
      },
    },
    {
      id: '002', no: '002', slug: 'tee-no-emotional-contraband', sig: 'SIG.002', demo: true,
      title: 'ФУТБОЛКА «NO EMOTIONAL CONTRABAND»', name: 'ФУТБОЛКА', sub: '«NO EMOTIONAL CONTRABAND»',
      cat: 'tee', catLabel: 'ФУТБОЛКИ', price: 3900, old: null, status: 'drop', batch: '1/80', color: 'ЧЁРНЫЙ',
      dropAt: Date.now() + 3 * DAY + 5.2 * 36e5, flat: 'tee', todo: { price: true, sizes: true, photo: true },
      sizes: SIZES_001.map((x) => ({ ...x, stock: 10 })),
      proto: [['СТАТУС', 'засекречено до дропа'], ['ПАРТИЯ', '1/80']],
    },
    {
      id: '003', no: '003', slug: 'beanie-all-subjects-monitored', sig: 'SIG.003', demo: true,
      title: 'ШАПКА «ALL SUBJECTS ARE MONITORED»', name: 'ШАПКА', sub: '«ALL SUBJECTS ARE MONITORED»',
      cat: 'acc', catLabel: 'АКСЕССУАРЫ', price: 2900, old: 3400, status: 'soldout', batch: '30/30', color: 'ЧЁРНЫЙ',
      flat: 'beanie', todo: { photo: true },
      sizes: [{ s: 'OS', stock: 0, h: [150, 200], m: [24, 56, 0] }],
      proto: [['СТАТУС', 'партия изъята полностью'], ['ПАРТИЯ', '30/30']],
    },
  ];
  M8.flat = (k) => `<div class="flat">${FLAT[k] || ''}</div>`;
  M8.product = (id) => M8.products.find((p) => p.id === id);
  M8.stockOf = (p) => p.sizes.reduce((a, s) => a + s.stock, 0);
  M8.img = (p, side = 'front', w = 1200) => `${p.photo[side]}-${w}.webp`;
  M8.srcset = (p, side = 'front') => [360, 720, 1200].map((w) => `${p.photo[side]}-${w}.webp ${w}w`).join(', ');

  M8.CATS = [
    { k: 'all', t: 'ВСЕ' }, { k: 'hoodie', t: 'ХУДИ' }, { k: 'tee', t: 'ФУТБОЛКИ' }, { k: 'acc', t: 'АКСЕССУАРЫ' }, { k: 'archive', t: 'АРХИВ' },
  ];
  M8.DELIVERY = [
    { k: 'cdek', t: 'СДЭК', s: 'ПВЗ или курьер · 2–5 дней', p: 390 },
    { k: 'post', t: 'Почта России', s: 'Отделение · 5–14 дней', p: 290 },
    { k: 'pickup', t: 'Самовывоз', s: 'Москва · по договорённости', p: 0 },
  ];
  M8.STEPS = ['ПРИНЯТ', 'СОБРАН', 'ЭТАПИРОВАН', 'ДОСТАВЛЕН'];

  /* admin demo data */
  M8.admin = {
    revenueToday: 48300,
    revenueWeek: [21000, 34500, 18200, 41000, 52800, 39100, 48300],
    hours: [0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1, 3, 2, 1, 4, 2, 3, 5, 4, 6, 3, 2, 1, 0],
    newOrders: 7, waiting: 3, avg: 6900,
    orders: [
      { no: 'MRK-000121', subject: '08-1182', name: 'Алексей К.', sum: 7290, status: 'ЭТАПИРОВАН', track: '10045522871', items: 'ZIP-HOODIE / M ×1', at: '19.10 21:04' },
      { no: 'MRK-000122', subject: '08-5530', name: 'Дарья Л.', sum: 14190, status: 'СОБРАН', track: '', items: 'ZIP-HOODIE / S ×2', at: '20.10 00:12' },
      { no: 'MRK-000120', subject: '08-0071', name: 'Илья В.', sum: 7190, status: 'ПРИНЯТ', track: '', items: 'ZIP-HOODIE / L ×1', at: '19.10 18:40' },
      { no: 'MRK-000119', subject: '08-9014', name: 'Мария С.', sum: 6900, status: 'ДОСТАВЛЕН', track: '80086431129', items: 'ZIP-HOODIE / XS ×1', at: '18.10 13:22' },
      { no: 'MRK-000118', subject: '08-3320', name: '—', sum: 7290, status: 'ОЖИДАЕТ ОПЛАТЫ', track: '', items: 'ZIP-HOODIE / M ×1', at: '18.10 11:05' },
    ],
  };
})();
