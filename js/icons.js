// Íconos de línea fina (SVG en línea, sin dependencias).
const wrap = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;

export const ICONS = {
  today: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  calendar: wrap('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  chart: wrap('<path d="M4 19.5h16"/><path d="M5 15l4.5-5 3.5 3.5L19.5 6"/>'),
  summary: wrap('<path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2z"/><path d="M9 9h6M9 13h4"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  run: wrap('<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 20l3-5.5 3 2.5v4M6.5 11.5l3-3.5 3.5 1.5 2.5 3 3 .5"/><path d="M11 14.5l1.5-5"/>'),
  gym: wrap('<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
  rest: wrap('<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/>'),
  race: wrap('<path d="M5 21V4M5 4.5c4-2 7 2 11 0v9c-4 2-7-2-11 0"/>'),
  other: wrap('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.4"'),
  back: wrap('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2.2"'),
  left: wrap('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2"'),
  right: wrap('<path d="M9 5l7 7-7 7"/>', 'stroke-width="2"'),
  chev: wrap('<path d="M9 5l7 7-7 7"/>', 'stroke-width="2" class="chev"'),
  more: wrap('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2"'),
  minus: wrap('<path d="M5 12h14"/>', 'stroke-width="2"'),
  up: wrap('<path d="M12 19V5M6 11l6-6 6 6"/>', 'stroke-width="2"'),
  down: wrap('<path d="M12 5v14M6 13l6 6 6-6"/>', 'stroke-width="2"'),
  x: wrap('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2"'),
  copy: wrap('<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>'),
  trophy: wrap('<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z"/>'),
};

export const icon = (name) => ICONS[name] || '';
export const typeIcon = (type) => ICONS[type] || ICONS.other;
