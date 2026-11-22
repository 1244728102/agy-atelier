// Isolated-world DevTools injector for AGY Atelier (Zili Neko Atelier).
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, join } from 'node:path';

const WORLD = 'agy-atelier';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function profileDir() {
  if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Antigravity');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Antigravity');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Antigravity');
}

function isAppWindow(target, port) {
  try {
    const page = new URL(target.url);
    const sock = new URL(target.webSocketDebuggerUrl);
    return target.type === 'page'
      && ['http:', 'https:'].includes(page.protocol) && LOOPBACK.has(page.hostname)
      && sock.protocol === 'ws:' && LOOPBACK.has(sock.hostname) && Number(sock.port) === port;
  } catch { return false; }
}

class DevSession {
  constructor(url) { this.url = url; this.pending = new Map(); this.nextId = 0; }
  open() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const t = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('DevTools 连接超时')); }, 5000);
      ws.addEventListener('open', () => { clearTimeout(t); resolve(this); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('DevTools 连接失败')); }, { once: true });
      ws.addEventListener('message', (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg.id) return;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        clearTimeout(p.t);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result || {});
      });
    });
  }
  cmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} 超时`)); }, 10000);
      this.pending.set(id, { resolve, reject, t });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws?.close(); } catch {} }
}

async function fileToDataUri(p) {
  const buf = await readFile(p);
  const ext = extname(p).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}


// ───────────────────────── Zili Neko Atelier · 紫璃猫娘 ─────────────────────────
// Complete architecture & visual contract aligned with atelier/src & atelier/tests:
// - [data-skin-chrome="character-stage"] inside the conversation column with
//   [data-skin-chrome="character-span"], [data-maid-character="left"], [data-maid-character="right"]
//   and ResizeObserver hysteresis (data-maid-figures-crowded).
// - [data-skin-chrome="sidebar-corners"] (4 fixed corners + resizable gold frame lines),
//   [data-skin-chrome="sidebar-mascot"] above the U-shaped lace swag,
//   crested workspace swallowtail ribbon ([data-maid-workspace-row]),
//   connected session tree branches ([data-maid-session-row], [data-maid-session-last]),
//   and antique-gold filigree settings surround.
// - [data-skin-chrome="composer-lace"] > [data-maid-composer-lace-center] inside the composer,
//   satin ribbon caps/fills + 3D jeweled maid bow + double cream-gold frame + circular medallions.
// - installMaidComposerCapsule (data-maid-composer-mode="capsule") & installMaidTableCards.

const svgUrl = (s) => `url("data:image/svg+xml;utf8,${encodeURIComponent(s.replace(/\s+/g, ' ').trim())}")`;

const GOLD_DEFS = `
  <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='#fff3cf'/><stop offset='.5' stop-color='#d8a653'/><stop offset='1' stop-color='#f7dc9a'/>
  </linearGradient>
  <linearGradient id='s' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='#ffe0fb'/><stop offset='.45' stop-color='#a988f5'/><stop offset='1' stop-color='#6fc0f7'/>
  </linearGradient>`;

const star4 = (cx, cy, r, fill = 'url(#s)', stroke = 'url(#g)', sw = 0.9) => {
  const i = r * 0.26;
  return `<path d='M${cx} ${cy - r} L${cx + i} ${cy - i} L${cx + r} ${cy} L${cx + i} ${cy + i} L${cx} ${cy + r} L${cx - i} ${cy + i} L${cx - r} ${cy} L${cx - i} ${cy - i} Z' fill='${fill}' stroke='${stroke}' stroke-width='${sw}' stroke-linejoin='round'/>`;
};

function cornerSvg(tf) {
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
    <defs>${GOLD_DEFS}</defs>
    <g transform='${tf}'>
      <path d='M6 48 V20 Q6 6 20 6 H48' fill='none' stroke='url(#g)' stroke-width='1.35'/>
      <path d='M11 48 V23 Q11 11 23 11 H48' fill='none' stroke='url(#g)' stroke-width='.6' opacity='.75'/>
      <path d='M17 30 Q17 17 30 17' fill='none' stroke='url(#g)' stroke-width='.9' stroke-linecap='round'/>
      <circle cx='30' cy='17' r='1.3' fill='#f7dc9a'/><circle cx='17' cy='30' r='1.3' fill='#f7dc9a'/>
      ${star4(8, 8, 7.5)}
    </g></svg>`);
}
const CORNER_TL = cornerSvg('');
const CORNER_TR = cornerSvg('translate(48 0) scale(-1 1)');
const CORNER_BL = cornerSvg('translate(0 48) scale(1 -1)');
const CORNER_BR = cornerSvg('translate(48 48) scale(-1 -1)');

const STAR_SMALL = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><defs>${GOLD_DEFS}</defs>${star4(8, 8, 7.2)}</svg>`);
const STAR_GOLD = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><defs>${GOLD_DEFS}</defs>${star4(6, 6, 5.6, 'url(#g)', '#fff3cf', 0.5)}</svg>`);

// Workspace Shield Crest SVG (--maid-workspace-crest-art)
const WORKSPACE_CREST_SVG = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'>
  <defs>${GOLD_DEFS}
    <linearGradient id='sh' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#4a3694'/><stop offset='1' stop-color='#1f1548'/></linearGradient>
  </defs>
  <path d='M13 2 L22 5.5 V13.2 C22 18.4 18.2 22.3 13 24.2 C7.8 22.3 4 18.4 4 13.2 V5.5 Z' fill='url(#sh)' stroke='url(#g)' stroke-width='1.4'/>
  ${star4(13, 12.8, 6.2)}
</svg>`);

// Workspace Crested Swallowtail Ribbon SVG (--maid-workspace-ribbon-art)
const WORKSPACE_RIBBON_SVG = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='36' viewBox='0 0 240 36' preserveAspectRatio='none'>
  <defs>${GOLD_DEFS}
    <linearGradient id='wrb' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stop-color='#392878'/><stop offset='.65' stop-color='#2a1d5c'/><stop offset='1' stop-color='#47328e'/>
    </linearGradient>
  </defs>
  <path d='M4 3 H236 L227 18 L236 33 H4 Q1 33 1 30 V6 Q1 3 4 3 Z' fill='url(#wrb)' stroke='url(#g)' stroke-width='1.3'/>
  <line x1='6' y1='6' x2='228' y2='6' stroke='#f7dc9a' stroke-width='.5' stroke-opacity='.45' stroke-dasharray='3 2'/>
  <line x1='6' y1='30' x2='228' y2='30' stroke='#f7dc9a' stroke-width='.5' stroke-opacity='.45' stroke-dasharray='3 2'/>
</svg>`);

// Antique Gold Settings Surround Frame SVG (--maid-settings-frame-art)
const SETTINGS_FRAME_SVG = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='36' viewBox='0 0 240 36' preserveAspectRatio='none'>
  <defs>${GOLD_DEFS}</defs>
  <rect x='2' y='2' width='236' height='32' rx='16' fill='rgba(30,21,64,0.75)' stroke='url(#g)' stroke-width='1.3'/>
  <rect x='5' y='5' width='230' height='26' rx='13' fill='none' stroke='#f7dc9a' stroke-width='.5' stroke-opacity='.45' stroke-dasharray='3 2'/>
  <path d='M14 18 L18 14 L22 18 L18 22 Z' fill='url(#g)' opacity='.8'/>
  <path d='M218 18 L222 14 L226 18 L222 22 Z' fill='url(#g)' opacity='.8'/>
</svg>`);

const SIDEBAR_PATTERN = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='132' height='132' viewBox='0 0 132 132'>
  <g fill='#d9c8ff' opacity='.075'>
    <g transform='translate(28 34) rotate(-18)'><ellipse cx='0' cy='6' rx='6.5' ry='5.4'/><circle cx='-6.5' cy='-2.5' r='2.4'/><circle cx='-2.2' cy='-6' r='2.4'/><circle cx='2.6' cy='-6' r='2.4'/><circle cx='6.8' cy='-2.4' r='2.4'/></g>
    <g transform='translate(98 96) rotate(16)'><ellipse cx='0' cy='6' rx='6.5' ry='5.4'/><circle cx='-6.5' cy='-2.5' r='2.4'/><circle cx='-2.2' cy='-6' r='2.4'/><circle cx='2.6' cy='-6' r='2.4'/><circle cx='6.8' cy='-2.4' r='2.4'/></g>
  </g>
  <g fill='#f7dc9a' opacity='.22'><path d='M96 22 l1.2 3.3 3.3 1.2 -3.3 1.2 -1.2 3.3 -1.2 -3.3 -3.3 -1.2 3.3 -1.2z'/><path d='M30 104 l.9 2.4 2.4 .9 -2.4 .9 -.9 2.4 -.9 -2.4 -2.4 -.9 2.4 -.9z'/></g>
  <g fill='#ffffff' opacity='.16'><circle cx='64' cy='12' r='.9'/><circle cx='12' cy='70' r='.7'/><circle cx='122' cy='58' r='.8'/><circle cx='70' cy='122' r='.7'/><circle cx='58' cy='66' r='.6'/></g>
</svg>`);

function laceSvg() {
  const W = 240, H = 92;
  const q = (p0, c, p1, t) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p1;
  const up = { y0: 3, c: 52, y1: 3 }, lo = { y0: 14, c: 70, y1: 14 };
  const pt = (e, t) => [q(0, W / 2, W, t), q(e.y0, e.c, e.y1, t)];
  let scallops = '', holes = '', beads = '';
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const [x, y] = pt(lo, i / N);
    scallops += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='5.3'/>`;
    const [hx, hy] = pt(lo, (i + 0.5) / N);
    if (i < N) holes += `<circle cx='${hx.toFixed(1)}' cy='${(hy - 4.2).toFixed(1)}' r='1.15'/>`;
    const [bx, by] = pt(up, i / N);
    if (i % 2 === 0) beads += `<circle cx='${bx.toFixed(1)}' cy='${(by + 3.2).toFixed(1)}' r='.95'/>`;
  }
  const band = `M0 ${up.y0} Q${W / 2} ${up.c} ${W} ${up.y1} L${W} ${lo.y1} Q${W / 2} ${lo.c} 0 ${lo.y0} Z`;
  const cx = W / 2, cy = 44;
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>
    <defs>${GOLD_DEFS}
      <linearGradient id='lace' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fbf8ff'/><stop offset='1' stop-color='#e2d6ff'/></linearGradient>
      <linearGradient id='bow' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#c7a8ff'/><stop offset='.6' stop-color='#9a76ec'/><stop offset='1' stop-color='#f2a3d6'/></linearGradient>
    </defs>
    <g fill='url(#lace)' opacity='.93'>${scallops}<path d='${band}'/></g>
    <g fill='#3a2a6e' opacity='.55'>${holes}</g>
    <path d='M0 ${up.y0} Q${W / 2} ${up.c} ${W} ${up.y1}' fill='none' stroke='url(#g)' stroke-width='1.3'/>
    <path d='M0 ${lo.y0 - 2.5} Q${W / 2} ${lo.c - 2.5} ${W} ${lo.y1 - 2.5}' fill='none' stroke='#b89cf2' stroke-width='.7' stroke-dasharray='2 2.4'/>
    <g fill='#f7dc9a'>${beads}</g>
    <g stroke='url(#g)' stroke-width='.9' stroke-linejoin='round'>
      <path d='M${cx - 2} ${cy + 3} L${cx - 13} ${cy + 36} L${cx - 7} ${cy + 32} L${cx - 3} ${cy + 39} Z' fill='url(#bow)'/>
      <path d='M${cx + 2} ${cy + 3} L${cx + 13} ${cy + 36} L${cx + 7} ${cy + 32} L${cx + 3} ${cy + 39} Z' fill='url(#bow)'/>
      <path d='M${cx} ${cy} C${cx - 14} ${cy - 15} ${cx - 29} ${cy - 8} ${cx - 25} ${cy + 3} C${cx - 21} ${cy + 12} ${cx - 9} ${cy + 8} ${cx} ${cy} Z' fill='url(#bow)'/>
      <path d='M${cx} ${cy} C${cx + 14} ${cy - 15} ${cx + 29} ${cy - 8} ${cx + 25} ${cy + 3} C${cx + 21} ${cy + 12} ${cx + 9} ${cy + 8} ${cx} ${cy} Z' fill='url(#bow)'/>
    </g>
    ${star4(cx, cy, 10.5)}
    <circle cx='${cx}' cy='${cy}' r='1.6' fill='#fff8e0'/>
  </svg>`);
}
const LACE = laceSvg();

const COMPOSER_LACE_TILE = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='54' height='33' viewBox='0 0 54 33'>
  <defs>
    <linearGradient id='lw' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#fdfaff'/>
      <stop offset='.55' stop-color='#f1e8ff'/>
      <stop offset='1' stop-color='#dfd0ff'/>
    </linearGradient>
  </defs>
  <path d='M0 0 H54 V9 Q47 21 40.5 11.5 Q34 28 27 28 Q20 28 13.5 11.5 Q7 21 0 9 Z' fill='url(#lw)'/>
  <path d='M0 9 Q7 21 13.5 11.5 Q20 28 27 28 Q34 28 40.5 11.5 Q47 21 54 9' fill='none' stroke='#fbf7ff' stroke-width='1.5'/>
  <path d='M0 6.2 Q7 17.5 13.5 8.5 Q20 24 27 24 Q34 24 40.5 8.5 Q47 17.5 54 6.2' fill='none' stroke='#b99ef0' stroke-width='.85' stroke-dasharray='1.8 1.6'/>
  <g fill='#261954' opacity='.86'>
    <path d='M27 8.5 L30.2 14 L27 19.5 L23.8 14 Z'/>
    <circle cx='20.5' cy='13.5' r='1.8'/><circle cx='33.5' cy='13.5' r='1.8'/>
    <circle cx='23' cy='19' r='1.45'/><circle cx='31' cy='19' r='1.45'/>
    <circle cx='6.8' cy='9.5' r='1.9'/><circle cx='47.2' cy='9.5' r='1.9'/>
    <circle cx='13.5' cy='5.5' r='1.35'/><circle cx='40.5' cy='5.5' r='1.35'/>
  </g>
  <g fill='none' stroke='#f7f0ff' stroke-width='.75'>
    <path d='M27 8.5 L30.2 14 L27 19.5 L23.8 14 Z'/>
    <circle cx='20.5' cy='13.5' r='1.8'/><circle cx='33.5' cy='13.5' r='1.8'/>
    <circle cx='6.8' cy='9.5' r='1.9'/><circle cx='47.2' cy='9.5' r='1.9'/>
  </g>
  <g fill='#fbf7ff'>
    <circle cx='6.8' cy='15.8' r='1.15'/><circle cx='19.8' cy='24.5' r='1.15'/><circle cx='27' cy='28.5' r='1.35'/><circle cx='34.2' cy='24.5' r='1.15'/><circle cx='47.2' cy='15.8' r='1.15'/>
  </g>
</svg>`);

const COMPOSER_RIBBON_BAR = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='18' viewBox='0 0 600 18' preserveAspectRatio='none'>
  <defs>${GOLD_DEFS}
    <linearGradient id='rb' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stop-color='#3d2878'/>
      <stop offset='.25' stop-color='#54389e'/>
      <stop offset='.5' stop-color='#35226b'/>
      <stop offset='.75' stop-color='#54389e'/>
      <stop offset='1' stop-color='#3d2878'/>
    </linearGradient>
  </defs>
  <path d='M6 2 H594 L599 9 L594 16 H6 L1 9 Z' fill='url(#rb)' stroke='url(#g)' stroke-width='1.5'/>
  <line x1='12' y1='5' x2='588' y2='5' stroke='#e9d8ff' stroke-width='.75' stroke-opacity='.5'/>
  <line x1='12' y1='13' x2='588' y2='13' stroke='#f7dc9a' stroke-width='.65' stroke-opacity='.5'/>
  <circle cx='10' cy='9' r='1.8' fill='#f7dc9a'/><circle cx='590' cy='9' r='1.8' fill='#f7dc9a'/>
</svg>`);

const COMPOSER_MAID_BOW = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='132' height='66' viewBox='0 0 132 66'>
  <defs>${GOLD_DEFS}
    <linearGradient id='bw' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#7b58d6'/>
      <stop offset='.48' stop-color='#4a3194'/>
      <stop offset='1' stop-color='#28185a'/>
    </linearGradient>
    <linearGradient id='bw2' x1='1' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#7b58d6'/>
      <stop offset='.48' stop-color='#4a3194'/>
      <stop offset='1' stop-color='#28185a'/>
    </linearGradient>
    <radialGradient id='gem' cx='.35' cy='.3' r='.7'>
      <stop offset='0' stop-color='#ffffff'/>
      <stop offset='.25' stop-color='#ffc8f0'/>
      <stop offset='.58' stop-color='#a37cf5'/>
      <stop offset='1' stop-color='#3b2178'/>
    </radialGradient>
  </defs>
  <path d='M58 26 L26 59 L40 55 L47 63 L64 31 Z' fill='url(#bw)' stroke='url(#g)' stroke-width='1.45' stroke-linejoin='round'/>
  <path d='M74 26 L106 59 L92 55 L85 63 L68 31 Z' fill='url(#bw2)' stroke='url(#g)' stroke-width='1.45' stroke-linejoin='round'/>
  <path d='M61 19 C45 5 21 4 12 12 C7 16 11 25 23 28 Z' fill='#2a1a5e' stroke='url(#g)' stroke-width='1.1'/>
  <path d='M71 19 C87 5 111 4 120 12 C125 16 121 25 109 28 Z' fill='#2a1a5e' stroke='url(#g)' stroke-width='1.1'/>
  <path d='M62 22 C47 6 16 5 8 15 C2 22 5 35 15 39 C28 44 48 34 62 26 Z' fill='url(#bw)' stroke='url(#g)' stroke-width='1.55' stroke-linejoin='round'/>
  <path d='M57 23 C41 19 24 21 12 27' fill='none' stroke='#1b0f42' stroke-width='1.8' opacity='.7' stroke-linecap='round'/>
  <path d='M57 22 C41 17 25 18 14 22' fill='none' stroke='#f4dcff' stroke-width='.95' opacity='.55' stroke-linecap='round'/>
  <path d='M70 22 C85 6 116 5 124 15 C130 22 127 35 117 39 C104 44 84 34 70 26 Z' fill='url(#bw2)' stroke='url(#g)' stroke-width='1.55' stroke-linejoin='round'/>
  <path d='M75 23 C91 19 108 21 120 27' fill='none' stroke='#1b0f42' stroke-width='1.8' opacity='.7' stroke-linecap='round'/>
  <path d='M75 22 C91 17 107 18 118 22' fill='none' stroke='#f4dcff' stroke-width='.95' opacity='.55' stroke-linecap='round'/>
  <ellipse cx='66' cy='24' rx='10.2' ry='12.6' fill='url(#g)' stroke='#6e4912' stroke-width='.9'/>
  <ellipse cx='66' cy='24' rx='7.6' ry='9.8' fill='url(#gem)' stroke='#fff4d4' stroke-width='.75'/>
  <path d='M66 16.2 L67.5 22 L72 24 L67.5 26 L66 31.8 L64.5 26 L60 24 L64.5 22 Z' fill='#ffffff' opacity='.58'/>
  <ellipse cx='63.3' cy='19.8' rx='2.3' ry='3.4' transform='rotate(-20 63.3 19.8)' fill='#ffffff' opacity='.82'/>
</svg>`);

const TOPBAR_DIAMOND_CREST = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14'>
  <defs>${GOLD_DEFS}</defs>
  <line x1='0' y1='7' x2='44' y2='7' stroke='url(#g)' stroke-width='1'/>
  <line x1='76' y1='7' x2='120' y2='7' stroke='url(#g)' stroke-width='1'/>
  <path d='M50 7 L53.5 3.5 L57 7 L53.5 10.5 Z' fill='none' stroke='url(#g)' stroke-width='1'/>
  <path d='M63 7 L66.5 3.5 L70 7 L66.5 10.5 Z' fill='none' stroke='url(#g)' stroke-width='1'/>
  <path d='M60 1.2 L61.6 5.4 L65.8 7 L61.6 8.6 L60 12.8 L58.4 8.6 L54.2 7 L58.4 5.4 Z' fill='url(#g)'/>
</svg>`);

const HEADER_DAMASK_TILE = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='40' viewBox='0 0 64 40'>
  <g fill='none' stroke='#6a56b8' stroke-width='.75' opacity='.32'>
    <path d='M32 2 C24 10 20 14 12 20 C20 26 24 30 32 38 C40 30 44 26 52 20 C44 14 40 10 32 2 Z'/>
    <path d='M32 7 C26 13 23 16 17 20 C23 24 26 27 32 33 C38 27 41 24 47 20 C41 16 38 13 32 7 Z'/>
    <path d='M0 20 Q10 10 16 2 Q10 14 16 20 Q10 26 16 38 Q10 30 0 20 Z'/>
    <path d='M64 20 Q54 10 48 2 Q54 14 48 20 Q54 26 48 38 Q54 30 64 20 Z'/>
    <circle cx='32' cy='20' r='3.2'/>
    <circle cx='0' cy='20' r='2.5'/><circle cx='64' cy='20' r='2.5'/>
  </g>
</svg>`);

const CHIBI_MAID_FRILL = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='110' height='36' viewBox='0 0 110 36'>
  <defs>${GOLD_DEFS}</defs>
  <path d='M14 28 Q55 4 96 28 Q88 33 80 26 Q72 31 64 23 Q55 30 46 23 Q38 31 30 26 Q22 33 14 28 Z' fill='#fbf9ff' stroke='#cbbef0' stroke-width='1'/>
  <path d='M18 29 Q55 9 92 29' fill='none' stroke='url(#g)' stroke-width='1.5'/>
</svg>`);

function buildCss(cfg, arts) {
  const isDark = cfg.themeMode !== 'light';
  const accent = cfg.accent || '#b69cf5';
  const op = Math.max(0.2, Math.min(1, Number(cfg.opacity ?? 0.85)));
  const blur = Math.max(0, Math.min(30, Number(cfg.blur ?? 16)));

  const NAV = `html.aa-on.aa-on [role="navigation"][aria-label="Sidebar"]`;
  const SERIF = `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STZhongsong", Georgia, serif`;

  return `
    html.aa-on {
      --aa-accent: ${accent}; --aa-op: ${op}; --aa-blur: ${blur}px;
      --aa-violet-950: #120d26; --aa-violet-900: #1a1336; --aa-violet-800: #241a48; --aa-violet-700: #33266a;
      --aa-lavender: #b69cf5; --aa-lavender-soft: #d9ccff; --aa-sakura: #f2a3d6;
      --aa-gold: #e9c27a; --aa-gold-soft: #f4dfae; --aa-gold-line: rgba(233, 194, 122, .62);
      --aa-porcelain: #fbf8ff; --aa-ink: #251b4d;
      --aa-serif: ${SERIF};
      --maid-sidebar-width: 256px;
      --maid-sidebar-swag-height: 77px;
      --maid-sidebar-swag-art: url("${arts?.sidebarSwag || ''}");
      --maid-workspace-row-height: 36px;
      --maid-composer-lace-art: ${COMPOSER_LACE_TILE};
      --maid-bow-art: ${COMPOSER_MAID_BOW};
      --maid-workspace-crest-art: ${WORKSPACE_CREST_SVG};
      --maid-workspace-ribbon-art: ${WORKSPACE_RIBBON_SVG};
      --maid-settings-frame-art: ${SETTINGS_FRAME_SVG};
      --primary: ${accent} !important;
      --link: ${accent} !important;
      ${isDark ? `
      --background: rgba(14, 10, 30, .30) !important;
      --content: rgba(18, 13, 38, .36) !important;
      --card: rgba(30, 22, 60, .80) !important;
      ` : `
      --background: rgba(251, 248, 255, .22) !important;
      --content: rgba(251, 248, 255, .34) !important;
      --card: rgba(251, 248, 255, .86) !important;
      `}
      --sidebar: rgba(26, 19, 54, .9) !important;
    }
    html.aa-on:not(.aa-lace-on) { --maid-sidebar-swag-height: 0px; }
    html.aa-on, html.aa-on body { background: transparent !important; }

    /* ── 背景层：猫娘壁纸 + 夜幕 ── */
    #aa-backdrop { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; background: ${isDark ? '#120d26' : '#efe8ff'}; }
    #aa-backdrop img.aa-wall {
      position: absolute; inset: -2% 0; width: 100%; height: 104%;
      object-fit: cover; object-position: center 22%; opacity: var(--aa-op);
      filter: ${isDark ? 'brightness(.74) saturate(1.1) hue-rotate(-4deg)' : 'brightness(1.03) saturate(1.05)'};
    }
    #aa-backdrop .aa-veil { position: absolute; inset: 0; background: ${isDark
      ? 'linear-gradient(100deg, rgba(18,12,40,.72) 0%, rgba(26,18,56,.36) 42%, rgba(30,20,64,.16) 100%), radial-gradient(ellipse at 85% 0%, rgba(242,163,214,.16), transparent 55%)'
      : 'linear-gradient(100deg, rgba(251,248,255,.58) 0%, rgba(240,232,255,.22) 55%, rgba(226,214,255,.06) 100%)'}; }
    #aa-sparkles {
      position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: .8;
      background-image:
        radial-gradient(1.6px 1.6px at 14% 22%, rgba(255,255,255,.9), transparent 60%),
        radial-gradient(1.3px 1.3px at 36% 72%, rgba(244,223,174,.85), transparent 60%),
        radial-gradient(1.6px 1.6px at 78% 18%, rgba(255,255,255,.9), transparent 60%),
        radial-gradient(1.3px 1.3px at 88% 66%, rgba(242,163,214,.8), transparent 60%),
        radial-gradient(1.2px 1.2px at 58% 40%, rgba(217,204,255,.85), transparent 60%);
    }

    /* ── 窗口外框：极细金线 + 底角星 ── */
    #aa-frame {
      position: fixed; inset: 4px; z-index: 9998; pointer-events: none; border-radius: 10px;
      border: 1px solid rgba(233, 194, 122, .26);
      box-shadow: inset 0 0 26px rgba(182, 156, 245, .07);
      background: ${CORNER_BL} left -1px bottom -1px / 30px 30px no-repeat, ${CORNER_BR} right -1px bottom -1px / 30px 30px no-repeat;
    }
    #aa-lace { display: none !important; }

    /* ── 隐藏右下角黄铜铭牌 ── */
    #aa-badge {
      display: none !important;
    }
    #aa-peek-chibi {
      position: fixed; right: 6px; bottom: -106px; width: 152px; height: 210px; z-index: 9998; pointer-events: none;
      filter: drop-shadow(0 -3px 10px rgba(8, 4, 24, .65));
    }
    #aa-peek-chibi img {
      width: 100%; height: 100%; object-fit: contain; object-position: center top;
    }
    #aa-peek-chibi::after {
      content: ""; position: absolute; left: 26px; right: 26px; top: 20px; height: 26px;
      background: ${CHIBI_MAID_FRILL} center top / contain no-repeat;
      pointer-events: none;
    }

    /* ── 标题栏 ── */
    html.aa-on.aa-on .agy-shell > .shrink-0 > .bg-sidebar {
      background: linear-gradient(180deg, rgba(30, 22, 62, .94), rgba(22, 16, 46, .94)) !important;
      box-shadow: inset 0 -1px 0 rgba(233, 194, 122, .38) !important;
      color: #e8e0ff;
    }

    /* ══════════════ 侧栏：星夜女仆布料 + 吉祥物 + 工作区绶带 + 连接树 (apply.spec.ts:2263-2795) ══════════════ */
    ${NAV} {
      position: relative; isolation: isolate;
      color: #e8e1ff;
      background-color: rgba(24, 17, 50, .9) !important;
      background-image:
        radial-gradient(ellipse 120% 40% at 0% 0%, rgba(242, 163, 214, .16), transparent 70%),
        radial-gradient(ellipse 90% 30% at 100% 100%, rgba(111, 192, 247, .10), transparent 70%),
        ${SIDEBAR_PATTERN},
        linear-gradient(180deg, rgba(34, 24, 70, .55), rgba(18, 13, 38, .35) 55%, rgba(30, 21, 62, .55)) !important;
      background-size: auto, auto, 132px 132px, auto !important;
      backdrop-filter: blur(var(--aa-blur)) saturate(1.15) !important;
      border-right: 0 !important;
      box-shadow:
        inset -1px 0 rgba(255, 245, 215, .75),
        inset -3px 0 rgba(226, 207, 166, .55),
        6px 0 22px rgba(8, 4, 26, .38) !important;
    }
    ${NAV}::before {
      content: ""; position: absolute; inset: 4px; z-index: -1; pointer-events: none;
      background:
        ${CORNER_TL} left top / 40px 40px no-repeat,
        ${CORNER_TR} right top / 40px 40px no-repeat,
        ${CORNER_BL} left bottom / 40px 40px no-repeat,
        ${CORNER_BR} right bottom / 40px 40px no-repeat,
        linear-gradient(90deg, var(--aa-gold-line), rgba(190,145,75,.9), var(--aa-gold-line)) left 40px top 5px / calc(100% - 80px) 1.25px no-repeat,
        linear-gradient(90deg, var(--aa-gold-line), rgba(190,145,75,.9), var(--aa-gold-line)) left 40px bottom 5px / calc(100% - 80px) 1.25px no-repeat,
        linear-gradient(180deg, var(--aa-gold-line), rgba(190,145,75,.9), var(--aa-gold-line)) left 5px top 40px / 1.35px calc(100% - 80px) no-repeat,
        linear-gradient(180deg, var(--aa-gold-line), rgba(190,145,75,.9), var(--aa-gold-line)) right 5px top 40px / 1.35px calc(100% - 80px) no-repeat;
    }
    /* 侧栏吉祥物 (apply.spec.ts:2785: subordinate to navigation and behind the lower ornament) */
    ${NAV} [data-skin-chrome="sidebar-mascot"] {
      position: absolute; left: 52%; bottom: calc(var(--maid-sidebar-swag-height) + 64px);
      transform: translateX(-50%); width: 132px; max-height: 34%;
      object-fit: contain; z-index: 0; opacity: .88; pointer-events: none;
      filter: saturate(1.04) brightness(1.06) drop-shadow(0 4px 10px rgba(6, 3, 22, .5));
    }
    ${NAV} > div:last-child {
      box-sizing: border-box !important;
      position: relative !important;
      flex: 0 0 auto !important;
      min-height: calc(var(--maid-sidebar-swag-height) + 64px) !important;
      padding: calc(var(--maid-sidebar-swag-height) + 2px) 12px 12px 12px !important;
      background: transparent !important;
    }
    html.aa-on.aa-lace-on [role="navigation"][aria-label="Sidebar"] > div:last-child::before {
      content: "";
      position: absolute;
      top: 0;
      left: calc((100% - var(--maid-sidebar-width)) / 2 + 5.5px);
      width: calc((var(--maid-sidebar-width) - 11px) * 1200 / 1144);
      height: var(--maid-sidebar-swag-height);
      z-index: 1;
      background: var(--maid-sidebar-swag-art) left top / 100% 100% no-repeat;
      clip-path: inset(0 calc(100% * 56 / 1200) 0 0);
      pointer-events: none;
      filter: hue-rotate(24deg) saturate(1.12) brightness(1.08) contrast(1.04) drop-shadow(0 4px 9px rgba(8, 4, 26, .42));
    }
    html.aa-on.aa-lace-on [role="navigation"][aria-label="Sidebar"]::after {
      display: none !important;
    }
    html.aa-on.aa-lace-on [role="navigation"][aria-label="Sidebar"] [data-testid="conversation-list-sidebar"] {
      padding-bottom: var(--maid-sidebar-swag-height) !important;
      -webkit-mask-image:
        linear-gradient(#000, #000),
        radial-gradient(ellipse 75% 100% at 50% 0, #000 70%, transparent 100%);
      -webkit-mask-size:
        100% max(0px, calc(100% - var(--maid-sidebar-swag-height))),
        100% min(100%, var(--maid-sidebar-swag-height));
      -webkit-mask-position: top, bottom;
      -webkit-mask-repeat: no-repeat;
      mask-image:
        linear-gradient(#000, #000),
        radial-gradient(ellipse 75% 100% at 50% 0, #000 70%, transparent 100%);
      mask-size:
        100% max(0px, calc(100% - var(--maid-sidebar-swag-height))),
        100% min(100%, var(--maid-sidebar-swag-height));
      mask-position: top, bottom;
      mask-repeat: no-repeat;
    }

    ${NAV} .bg-sidebar { background-color: transparent !important; background-image: none !important; }
    ${NAV} [data-sidebar-section-drop-id], ${NAV} [data-testid="plugins-section-header"] {
      background-color: rgba(24, 17, 50, .78) !important; backdrop-filter: blur(8px);
    }
    ${NAV} [data-testid="section-header"] h2, ${NAV} [data-testid="plugins-section-header"] h2 {
      opacity: 1 !important; color: var(--aa-gold-soft) !important;
      font-family: var(--aa-serif) !important; font-size: 12px !important; font-weight: 600 !important; letter-spacing: .16em;
      text-shadow: 0 1px 2px rgba(8, 4, 26, .6);
    }
    ${NAV} [data-testid="section-header"] h2::before, ${NAV} [data-testid="plugins-section-header"] h2::before {
      content: ""; width: 10px; height: 10px; margin-right: 6px; flex-shrink: 0; background: ${STAR_GOLD} center / contain no-repeat;
    }
    ${NAV} [data-testid="section-header"] > div, ${NAV} [data-testid="plugins-section-header"] {
      background-image: linear-gradient(90deg, rgba(233, 194, 122, .55), rgba(233, 194, 122, 0) 85%) !important;
      background-size: 100% 1px !important; background-position: left bottom !important; background-repeat: no-repeat !important;
    }
    ${NAV} [data-testid="section-header"] button, ${NAV} [data-testid="plugins-section-header"] button { color: inherit !important; }

    /* 新建对话：陶瓷白缎带按钮 */
    ${NAV} [data-testid="new-conversation-button"] {
      position: relative; height: 34px !important;
      color: var(--aa-ink) !important; font-family: var(--aa-serif) !important; font-weight: 700 !important; letter-spacing: .14em;
      background: linear-gradient(180deg, #fefcff 0%, #efe8ff 55%, #e2d6ff 100%) !important;
      border: 0 !important; border-radius: 3px !important;
      clip-path: polygon(0 0, 100% 0, calc(100% - 9px) 50%, 100% 100%, 0 100%, 9px 50%);
      padding-left: 20px !important;
      box-shadow: inset 0 1.5px 0 #e9c27a, inset 0 -1.5px 0 #e9c27a, inset 0 3px 0 rgba(255,255,255,.7) !important;
      filter: drop-shadow(0 2px 4px rgba(8, 4, 26, .45));
    }
    ${NAV} [data-testid="new-conversation-button"]::after {
      content: ""; position: absolute; right: 18px; top: 50%; width: 12px; height: 12px; margin-top: -6px;
      background: ${STAR_SMALL} center / contain no-repeat; pointer-events: none;
    }
    ${NAV} [data-testid="new-conversation-button"] svg { color: #6b4fc8 !important; }
    ${NAV} [data-testid="new-conversation-button"]:hover {
      background: linear-gradient(180deg, #ffffff 0%, #f7e9ff 55%, #f2d3ee 100%) !important;
    }

    ${NAV} [data-testid="sidebar-navigation-items"] > :not([data-testid="new-conversation-button"]),
    ${NAV} [data-testid="plugin-sidebar-mcp-app-item"] {
      color: #ddd4ff !important; border-radius: 8px !important; background: transparent !important;
    }
    ${NAV} :is([data-testid="sidebar-navigation-items"] > :not([data-testid="new-conversation-button"]), [data-testid="plugin-sidebar-mcp-app-item"]):hover {
      color: #fff !important;
      background: linear-gradient(90deg, rgba(182, 156, 245, .22), rgba(182, 156, 245, .06)) !important;
      box-shadow: inset 2px 0 0 var(--aa-gold);
    }
    ${NAV} :is([data-testid="sidebar-navigation-items"], [data-testid="plugins-section"], [data-testid="settings-button"]) svg { color: var(--aa-lavender) !important; }

    /* 设置按钮：古典金框居中配对 (apply.spec.ts:1385, 2321) */
    ${NAV} [data-testid="settings-button"] {
      position: relative !important;
      justify-content: center !important;
      gap: 0.5em !important;
      min-height: 36px !important;
      color: #f4dfae !important;
      font-family: var(--aa-serif) !important;
      letter-spacing: .12em;
      background: var(--maid-settings-frame-art) center / 100% 100% no-repeat !important;
      border: 0 !important;
      box-shadow: 0 3px 10px rgba(6, 3, 20, .4) !important;
    }
    ${NAV} [data-testid="settings-button"] svg { color: var(--aa-gold) !important; }

    /* 工作区绶带横幅 & 盾徽图标 (apply.spec.ts:2633: active workspace as a crested ribbon) */
    @keyframes maidAtelierWorkspaceRibbonEnter {
      from { clip-path: inset(0 100% 0 0); }
      to { clip-path: inset(0 0 0 0); }
    }
    ${NAV} [data-testid="project-header"] {
      position: relative !important;
      min-height: var(--maid-workspace-row-height, 36px) !important;
      padding: 4px 14px 4px 10px !important;
      color: #fff6e0 !important;
      font-family: var(--aa-serif) !important;
      font-weight: 700 !important;
      background: var(--maid-workspace-ribbon-art) left center / 100% 100% no-repeat !important;
      animation: maidAtelierWorkspaceRibbonEnter 440ms cubic-bezier(0.22, 0.78, 0.2, 1) both;
      filter: drop-shadow(0 3px 7px rgba(6, 3, 22, .45));
    }
    ${NAV} [data-testid="project-header"] [data-testid="project-header-icon"] {
      width: 24px !important; height: 24px !important;
      background: var(--maid-workspace-crest-art) center / 22px 22px no-repeat !important;
      color: transparent !important;
    }
    ${NAV} [data-testid="project-header"] [data-testid="project-header-icon"] svg { opacity: 0 !important; }

    /* 会话树连接线与选中金框铭牌 (apply.spec.ts:2689-2749) */
    ${NAV} [data-testid="conversation-row-sidebar"] {
      position: relative !important;
      box-sizing: border-box !important;
      border-radius: 8px !important;
      color: #d4cbf3;
      font-family: var(--aa-serif);
    }
    /* 树干与分支虚线 ├ */
    ${NAV} [data-testid="conversation-row-sidebar"]::before {
      content: ""; position: absolute; left: 14px; top: 0; bottom: 0; width: 10px;
      pointer-events: none; z-index: 1;
      background:
        repeating-linear-gradient(180deg, rgba(233, 194, 122, .65) 0 3px, transparent 3px 5px) left top / 1.2px 100% no-repeat,
        linear-gradient(90deg, rgba(233, 194, 122, .65), rgba(233, 194, 122, .35)) left center / 9px 1.2px no-repeat;
    }
    /* 末尾会话行树干止于 50% 高度 ╰ */
    ${NAV} [data-maid-session-last] [data-testid="conversation-row-sidebar"]::before,
    ${NAV} [data-testid="conversation-row-sidebar"][data-maid-session-last]::before {
      background:
        repeating-linear-gradient(180deg, rgba(233, 194, 122, .65) 0 3px, transparent 3px 5px) left top / 1.2px 50% no-repeat,
        linear-gradient(90deg, rgba(233, 194, 122, .65), rgba(233, 194, 122, .35)) left center / 9px 1.2px no-repeat;
    }
    ${NAV} [data-testid="conversation-row-sidebar"] :is(span, .text-secondary-foreground) { color: inherit !important; }
    ${NAV} [data-testid="conversation-row-sidebar"]:hover { background: rgba(182, 156, 245, .14) !important; color: #fff; }
    ${NAV} [data-testid="conversation-row-sidebar"][data-selected="true"] {
      color: #fff8e8 !important;
      background: linear-gradient(90deg, rgba(226, 190, 112, .26), rgba(112, 86, 196, .34) 45%, rgba(242, 163, 214, .12)) !important;
      box-shadow: inset 0 0 0 1px rgba(226, 190, 112, .72), 0 4px 12px rgba(8, 4, 26, .45) !important;
    }
    ${NAV} [data-testid="conversation-row-sidebar"][data-selected="true"]::after {
      content: ""; position: absolute; inset: 6px auto 6px 5px; width: 3px; border-radius: 99px;
      background: linear-gradient(#fff0c5, #d4a951);
      box-shadow: 0 0 6px rgba(244, 223, 174, .75);
      pointer-events: none;
    }
    ${NAV} [data-testid="conversation-row-sidebar"] button svg { color: var(--aa-lavender-soft) !important; }
    ${NAV} [data-testid="conversation-list-sidebar"] button.text-muted-foreground { color: #a99fd2 !important; font-family: var(--aa-serif); font-style: italic; }
    ${NAV} [data-testid="conversation-list-sidebar"] span.opacity-30 { color: #a99fd2; font-family: var(--aa-serif); }

    /* ══════════════ 对话区舞台：双猫娘立绘 + ResizeObserver 防拥挤退场 (character-fit.spec.ts & apply.spec.ts:1675) ══════════════ */
    html.aa-on [data-testid="conversation-view"] {
      position: relative !important;
    }
    [data-skin-chrome="character-stage"] {
      --maid-character-edge: clamp(8px, 1.5%, 24px);
      position: absolute; inset: 0; z-index: 0; pointer-events: none;
      overflow: hidden; contain: strict;
    }
    [data-skin-chrome="character-span"] {
      position: absolute; inset: 0; pointer-events: none;
    }
    [data-maid-character] {
      position: absolute; bottom: 8px; z-index: 1;
      width: auto; object-fit: contain; pointer-events: none; user-select: none;
      filter: drop-shadow(0 10px 24px rgba(6, 3, 22, .55));
      transition: translate 620ms cubic-bezier(0.22, 0.78, 0.2, 1), opacity 220ms ease;
    }
    [data-maid-character="left"] {
      left: var(--maid-character-edge);
      height: 36%; max-height: 310px;
    }
    [data-maid-character="right"] {
      right: var(--maid-character-edge);
      height: 35%; max-height: 300px;
    }
    body[data-maid-figures-crowded] [data-maid-character] {
      opacity: 0 !important;
      translate: 0 24px;
    }
    body[data-maid-low-power] [data-maid-character] {
      filter: none; transition: opacity 180ms ease;
    }

    /* 舞台中央“探索未至之境 · 紫璃猫娘工坊”圆形徽章横幅 (apply.spec.ts:1614-1673) */
    #aa-hero-crest {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      margin: 10px auto 10px auto; padding: 6px 0; width: 100%; max-width: 720px;
      position: relative; z-index: 2; pointer-events: none; user-select: none;
      background: radial-gradient(ellipse 65% 80% at 50% 55%, rgba(16, 11, 38, .58), transparent 85%);
    }
    #aa-hero-crest .aa-crest-row {
      display: flex; align-items: center; justify-content: center; width: 100%; gap: 14px;
    }
    #aa-hero-crest .aa-crest-lines {
      flex: 1; height: 12px;
      border-top: 1px solid rgba(244, 223, 174, .82);
      border-bottom: 1px solid rgba(244, 223, 174, .58);
      filter: drop-shadow(0 1px 2px rgba(6, 3, 20, .85));
    }
    #aa-hero-crest .aa-medallion {
      width: 70px; height: 70px; border-radius: 999px; position: relative;
      padding: 5px;
      background: radial-gradient(circle, rgba(255,253,245,.92) 56%, rgba(233,194,122,.35) 68%, rgba(182,156,245,.20) 100%);
      border: 1.5px solid rgba(233, 194, 122, .78);
      outline: 1px solid rgba(255, 245, 220, .35);
      outline-offset: 4px;
      box-shadow: 0 8px 24px rgba(8, 4, 24, .5);
      display: flex; align-items: center; justify-content: center;
    }
    #aa-hero-crest .aa-medallion img {
      width: 100%; height: 100%; border-radius: 999px; object-fit: cover;
      border: 1.5px solid #d8a653;
    }
    #aa-hero-crest .aa-crest-title {
      margin-top: 8px; display: flex; align-items: center; gap: 8px;
      font: 700 24px/1.25 var(--aa-serif); letter-spacing: .12em;
      color: #fffaf0;
      text-shadow: 0 1px 0 rgba(4, 11, 34, .96), 0 3px 7px rgba(0, 0, 0, .86);
    }
    #aa-hero-crest .aa-crest-pill {
      font: 600 10.5px/1.4 system-ui, sans-serif; letter-spacing: .04em;
      padding: 1px 7px; border-radius: 999px;
      color: #f0dfba; background: rgba(20, 14, 48, .72);
      border: 1px solid rgba(233, 194, 122, .65);
    }
    #aa-hero-crest .aa-crest-rule {
      margin-top: 6px; width: 420px; max-width: 85%; height: 12px;
      background: ${TOPBAR_DIAMOND_CREST} center / 120px 12px no-repeat,
        linear-gradient(90deg, transparent, rgba(233,194,122,.55) 20%, rgba(233,194,122,.55) 80%, transparent) center / 100% 1px no-repeat;
    }

    /* 用户消息气泡 */
    html.aa-on.aa-on [data-agy-dream-reading] .agy-user-bubble[data-testid="user-message-bubble"]:not([role="tooltip"]),
    html.aa-on.aa-on .agy-user-bubble[data-testid="user-message-bubble"]:not([role="tooltip"]) {
      background-color: transparent !important;
      background-image: ${isDark
        ? 'linear-gradient(135deg, rgba(52, 36, 98, .78) 0%, rgba(32, 22, 68, .84) 100%)'
        : 'linear-gradient(180deg, rgba(255, 253, 255, .90) 0%, rgba(237, 226, 255, .88) 100%)'} !important;
      backdrop-filter: blur(14px) saturate(1.22) !important;
      border-radius: 14px !important;
      padding: 7px 14px !important;
      color: ${isDark ? '#f7f2ff' : '#251b4d'} !important;
      box-shadow:
        inset 0 0 0 1px rgba(212, 186, 255, .42),
        0 6px 20px rgba(10, 5, 28, .32) !important;
    }
    html.aa-on.aa-on .agy-user-bubble[data-testid="user-message-bubble"] a {
      color: ${isDark ? '#f4dfae' : '#6b4fc8'} !important;
      text-decoration: underline;
    }

    /* 助手回复正文卡片 */
    html.aa-on.aa-on [data-agy-output-mode="glass"] [data-agy-dream-segment][data-agy-dream-segment],
    html.aa-on.aa-on [data-testid="planner-response-text"] > [data-agy-dream-segment] {
      background-color: transparent !important;
      background-image: ${isDark
        ? 'linear-gradient(180deg, rgba(30, 21, 64, .72) 0%, rgba(22, 15, 48, .76) 100%)'
        : 'linear-gradient(180deg, rgba(252, 250, 255, .86) 0%, rgba(244, 238, 255, .88) 100%)'} !important;
      backdrop-filter: blur(16px) saturate(1.2) !important;
      border-radius: 12px !important;
      padding: 12px 16px !important;
      color: ${isDark ? '#f4efff' : '#251b4d'} !important;
      box-shadow:
        inset 0 0 0 1px rgba(196, 174, 248, .36),
        0 8px 24px rgba(10, 5, 28, .30) !important;
    }

    /* 思考/工具运行/文件变更等过程行 */
    html.aa-on.aa-on [data-agy-dream-reading] :is(
      [data-testid^="thinking-collapsible"],
      [data-testid="ephemeral-tool-status"],
      [data-testid^="changed-files-card-heade"]
    ),
    html.aa-on.aa-on :is(
      [data-testid^="thinking-collapsible"],
      [data-testid="ephemeral-tool-status"],
      [data-testid^="changed-files-card-heade"]
    ) {
      background-color: ${isDark ? 'rgba(32, 22, 68, .64)' : 'rgba(251, 248, 255, .78)'} !important;
      backdrop-filter: blur(12px) !important;
      border-radius: 999px !important;
      padding: 4px 14px !important;
      color: ${isDark ? '#dfd4ff' : '#2f235e'} !important;
      box-shadow: inset 0 0 0 1px rgba(196, 174, 248, .30), 0 4px 12px rgba(10, 5, 28, .24) !important;
      transition: transform 150ms ease, opacity 150ms ease !important;
    }

    /* 宽表格展开卡片 (table-card.spec.ts) */
    html.aa-on [data-maid-table-card] {
      position: relative;
      border: 1px solid rgba(233, 194, 122, .35);
      border-radius: 10px;
      padding: 6px;
      background: rgba(15, 11, 34, .75);
      overflow-x: auto;
    }
    html.aa-on [data-maid-table-card][data-maid-table-expanded="true"] {
      max-width: 92vw !important;
    }
    html.aa-on .aa-table-expand-btn {
      position: sticky; left: 8px; top: 4px; z-index: 3;
      padding: 2px 9px; border-radius: 999px; font-size: 11px; cursor: pointer;
      color: #f4dfae; background: rgba(34, 24, 70, .9);
      border: 1px solid rgba(233, 194, 122, .5);
    }

    /* 正文内代码块 & 金色行内代码胶囊 */
    html.aa-on.aa-on [data-agy-dream-reading] pre,
    html.aa-on.aa-on [data-testid="planner-response-text"] pre {
      background-color: ${isDark ? 'rgba(11, 8, 26, .88)' : 'rgba(241, 234, 255, .92)'} !important;
      border: 1px solid rgba(186, 170, 238, .28) !important;
      border-radius: 10px !important;
    }
    html.aa-on.aa-on [data-agy-dream-reading] :not(pre) > code,
    html.aa-on.aa-on [data-testid="planner-response-text"] :not(pre) > code {
      background-color: ${isDark ? 'rgba(42, 33, 82, .88)' : 'rgba(182, 156, 245, .24)'} !important;
      color: ${isDark ? '#f2cf88' : '#4b3299'} !important;
      border: 1px solid rgba(233, 194, 122, .32) !important;
      border-radius: 6px !important;
      padding: 1.5px 6px !important;
      font-weight: 600;
    }

    /* 隐藏右上角遮挡猫娘脸部的“概览/已上传文件”浮层面板，并清除其给对话区留下的 336px 右内边距偏移 */
    html.aa-on.aa-on .animate-overview-panel,
    html.aa-on.aa-on [data-testid="overview-panel-host-sibling"] {
      display: none !important;
    }
    html.aa-on.aa-on [data-testid="conversation-view"] {
      padding-right: 0 !important;
      padding-left: 0 !important;
    }
    /* 消息正文列宽与截图一致（898px 居中，与下方 964px 输入框对齐） */
    html.aa-on.aa-on [data-testid="autoscroll-viewport"] .max-w-3xl,
    html.aa-on.aa-on [data-testid="conversation-view"] .max-w-3xl {
      max-width: 898px !important;
    }

    /* ══════════════ 输入器：1:1 复刻截图像素比例（宽 964px × 高 145px，真居中 x=500..1464） ══════════════ */
    html.aa-on.aa-on [data-testid="agent-input-box"] {
      width: min(964px, calc(100vw - 296px)) !important;
      max-width: none !important;
      margin-top: 8px !important;
      margin-bottom: 24px !important;
      margin-left: 50% !important;
      transform: translateX(-50%) !important;
      position: relative !important;
      overflow: visible !important;
    }

    /* 去掉输入框内部文字区域多余的内层细边框，保持与截图一致的纯净深色内胆 */
    html.aa-on.aa-on .surface-composer-card > div:first-child,
    html.aa-on.aa-on .surface-composer-card > div:first-child div {
      border: 0 !important;
      box-shadow: none !important;
      outline: none !important;
      background: transparent !important;
    }

    /* 空闲胶囊收起态 (composer-capsule.spec.ts: [data-maid-composer-capsule]) */
    html[data-maid-composer-mode="capsule"] [data-testid="agent-input-box"][data-maid-composer-capsule] {
      max-width: 340px !important;
      margin-inline: auto !important;
      cursor: pointer;
    }
    html[data-maid-composer-mode="capsule"] [data-testid="agent-input-box"][data-maid-composer-capsule] .agy-composer-footer {
      display: none !important;
    }

    html.aa-on.aa-on .surface-composer.surface-composer[class] {
      position: relative !important;
      overflow: visible !important;
      min-height: 145px !important;
      border-radius: 30px !important;
      border: 3.2px solid #f6e4be !important;
      background-color: transparent !important;
      background-image: ${isDark
        ? 'radial-gradient(ellipse 75% 60% at 18% 0%, rgba(186, 142, 255, .24), transparent 70%), radial-gradient(ellipse 70% 60% at 85% 100%, rgba(242, 163, 214, .18), transparent 70%), linear-gradient(180deg, rgba(38, 26, 78, .76) 0%, rgba(24, 16, 52, .82) 100%)'
        : 'linear-gradient(180deg, rgba(253, 251, 255, .90) 0%, rgba(240, 232, 255, .94) 100%)'} !important;
      backdrop-filter: blur(20px) saturate(1.25) !important;
      box-shadow:
        inset 0 0 0 1.5px #d4a454,
        inset 0 0 0 3px rgba(246, 224, 255, .32),
        inset 0 10px 24px rgba(14, 8, 36, .45),
        0 0 0 1.2px rgba(196, 148, 72, .88),
        0 0 26px rgba(182, 156, 245, .18),
        0 16px 42px rgba(8, 4, 24, .55) !important;
    }
    /* 1. 顶部深色镶金缎带横梁 */
    html.aa-on.aa-on .surface-composer.surface-composer[class]::before {
      content: "" !important;
      position: absolute !important; left: 44px !important; right: 44px !important; top: -10px !important; height: 17px !important;
      inset: -10px 44px auto 44px !important;
      z-index: 3 !important; pointer-events: none !important;
      background: ${COMPOSER_RIBBON_BAR} center / 100% 100% no-repeat !important;
      filter: drop-shadow(0 3px 5px rgba(5, 2, 18, .55));
    }
    html.aa-on.aa-on .surface-composer.surface-composer[class]::after {
      display: none !important;
    }

    /* 2. atelier 三段式精确对齐蕾丝轨道 ([data-skin-chrome="composer-lace"] > [data-maid-composer-lace-center]) */
    html.aa-on.aa-on [data-skin-chrome="composer-lace"] {
      position: absolute !important;
      inset: 0 3px auto 3px !important;
      height: 33px !important;
      z-index: 2 !important;
      pointer-events: none !important;
      border-radius: 23px 23px 0 0 !important;
      overflow: hidden !important;
      filter: drop-shadow(0 3px 4px rgba(6, 3, 22, .62));
    }
    html.aa-on.aa-on [data-skin-chrome="composer-lace"]::before,
    html.aa-on.aa-on [data-skin-chrome="composer-lace"]::after,
    html.aa-on.aa-on [data-skin-chrome="composer-lace"] > [data-maid-composer-lace-center] {
      content: "";
      position: absolute;
      top: 0;
      height: 33px;
      background-image: var(--maid-composer-lace-art);
      background-size: 54px 33px;
      background-repeat: repeat-x;
    }
    html.aa-on.aa-on [data-skin-chrome="composer-lace"]::before,
    html.aa-on.aa-on [data-skin-chrome="composer-lace"]::after {
      width: max(0px, calc(50% - 27px));
    }
    html.aa-on.aa-on [data-skin-chrome="composer-lace"]::before {
      left: 0;
      background-position: right top;
    }
    html.aa-on.aa-on [data-skin-chrome="composer-lace"]::after {
      right: 0;
      background-position: left top;
    }
    html.aa-on.aa-on [data-skin-chrome="composer-lace"] > [data-maid-composer-lace-center] {
      left: calc(50% - 27px);
      width: 54px;
      background-position: center top;
      background-repeat: no-repeat;
    }

    /* 3. 顶部中央立体褶皱金边蝴蝶结 + 椭圆金托星芒宝石 */
    html.aa-on.aa-on .surface-composer-card.surface-composer-card[class] {
      position: relative !important;
      z-index: 6 !important;
      overflow: visible !important;
      min-height: 138px !important;
      padding: 32px 20px 12px 20px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      background: transparent !important;
    }
    html.aa-on.aa-on .surface-composer-card.surface-composer-card[class] > * {
      position: relative;
      z-index: 2;
    }
    html.aa-on.aa-on .surface-composer-card.surface-composer-card[class]::before {
      content: "" !important;
      position: absolute !important; left: 50% !important; top: -34px !important;
      width: 154px !important; height: 76px !important;
      transform: translateX(-50%) !important;
      z-index: 10 !important; pointer-events: none !important;
      background: var(--maid-bow-art) center / contain no-repeat !important;
      filter: drop-shadow(0 5px 9px rgba(5, 2, 18, .72));
    }

    /* 4. 输入框内部底栏控件位置重排（完全对齐截图：左下 [+] [🛡] 双圆钮；右下 [✓ 识图] + 模型名 High ▾ + 圆形按钮；状态条移至金框正下方居中） */
    html.aa-on.aa-on .agy-composer-footer {
      position: relative !important;
      padding-top: 6px !important;
      min-height: 40px !important;
    }
    /* 左下第 1 个圆钮：[ + ]（紫璃罗兰紫磨砂金边圆钮） */
    html.aa-on.aa-on .surface-composer button[aria-label="Add context"] {
      width: 38px !important; height: 38px !important;
      border-radius: 999px !important;
      background: linear-gradient(180deg, rgba(96, 68, 172, .68), rgba(54, 37, 106, .82)) !important;
      border: 1.5px solid rgba(236, 204, 146, .70) !important;
      color: #f4ecff !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 2px 8px rgba(10, 5, 28, .38) !important;
    }
    /* 左下第 2 个圆钮：[ 🛡 ] 权限盾牌（紫璃罗兰紫磨砂金边圆钮） */
    html.aa-on.aa-on .surface-composer button[data-testid="permissions-selector-trigger"] {
      position: absolute !important;
      left: 48px !important;
      bottom: 2px !important;
      width: 38px !important; height: 38px !important;
      min-width: 38px !important; max-width: 38px !important;
      padding: 0 !important; gap: 0 !important;
      justify-content: center !important; align-items: center !important;
      border-radius: 999px !important;
      background: linear-gradient(180deg, rgba(96, 68, 172, .68), rgba(54, 37, 106, .82)) !important;
      border: 1.5px solid rgba(236, 204, 146, .70) !important;
      color: #f0cf8c !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 2px 8px rgba(10, 5, 28, .38) !important;
      z-index: 5 !important;
    }
    html.aa-on.aa-on .surface-composer button[data-testid="permissions-selector-trigger"] > :not(:first-child) {
      display: none !important;
    }
    html.aa-on.aa-on .surface-composer button[data-testid="permissions-selector-trigger"] > svg:first-child {
      width: 15px !important; height: 15px !important;
    }

    /* 将模型选择器推到右下角按钮左侧，并在前面附带紫璃罗兰紫配色 [ ✓ 识图 ] 标签 */
    html.aa-on.aa-on .agy-composer-footer > div:first-child > div:has([data-testid="model-selector-trigger"]) {
      margin-left: auto !important;
      margin-right: 6px !important;
      display: inline-flex !important;
      align-items: center !important;
    }
    html.aa-on.aa-on .agy-composer-footer > div:first-child > div:has([data-testid="model-selector-trigger"])::before {
      content: "✓ 识图";
      display: inline-flex; align-items: center;
      padding: 3px 9px; margin-right: 8px;
      border-radius: 6px;
      font: 600 11.5px/1.35 system-ui, sans-serif;
      color: #f3eaff;
      background: linear-gradient(135deg, rgba(112, 78, 192, .52), rgba(76, 52, 142, .62));
      border: 1px solid rgba(206, 178, 255, .52);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
      white-space: nowrap;
    }
    html.aa-on.aa-on .surface-composer [data-testid="model-selector-trigger"] {
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      color: #f4eeff !important;
      font-weight: 600 !important;
      font-size: 12.5px !important;
      padding: 2px 6px !important;
    }
    html.aa-on.aa-on .surface-composer [data-testid="model-selector-trigger"] span.opacity-70 {
      color: #f2cf88 !important;
      opacity: 1 !important;
      font-weight: 700 !important;
      margin-left: 4px !important;
    }

    /* 右下角圆形发送/语音按钮（紫璃薰衣草紫金边圆钮） */
    html.aa-on.aa-on .agy-composer-footer div:has(> span > [data-testid="voice-live-pill"]) {
      display: none !important;
    }
    html.aa-on.aa-on .surface-composer button:is([aria-label="Record voice memo"], [data-testid="input-cancel-button"], [data-testid="input-send-button"]) {
      width: 38px !important; height: 38px !important;
      border-radius: 999px !important;
      background: linear-gradient(180deg, rgba(110, 78, 190, .78), rgba(64, 44, 124, .88)) !important;
      border: 1.5px solid rgba(236, 204, 146, .72) !important;
      color: #f7f2ff !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.26), 0 2px 8px rgba(10, 5, 28, .40) !important;
    }

    html.aa-on.aa-on .surface-composer button[data-testid="input-cancel-button"] > div {
      background-color: #f4dfae !important;
      border-radius: 2px !important;
    }

    /* 将 tok/s 与缓存命中状态条 (#agy-capsule-host) 移至输入框金框正下方外部居中 */
    html.aa-on.aa-on #agy-capsule-host {
      display: flex !important;
      position: absolute !important;
      left: 50% !important;
      bottom: -33px !important;
      transform: translateX(-50%) !important;
      z-index: 15 !important;
      white-space: nowrap !important;
      opacity: .92 !important;
      filter: drop-shadow(0 1px 3px rgba(4, 2, 16, .85));
    }

    html.aa-on [data-lexical-editor="true"] { caret-color: ${isDark ? '#bcd2ff' : '#405a99'}; }
    html.aa-on ::selection { background: rgba(182, 156, 245, .42); }
    html.aa-on :is(button, a, input, textarea, [contenteditable="true"]):focus-visible { outline-color: var(--aa-lavender) !important; }
    html.aa-on ::-webkit-scrollbar-thumb { background: rgba(182, 156, 245, .32) !important; border-radius: 99px; }
    html.aa-on ::-webkit-scrollbar-thumb:hover { background: rgba(233, 194, 122, .5) !important; }

    /* ══════════════ 顶部双层栏（与侧栏、猫娘壁纸完全统一的紫璃罗兰紫磨砂 + 猫爪星芒暗纹，无分界黑线与右上角黑块） ══════════════ */
    html.aa-on.aa-on [class*="@container/titlebar"] {
      position: relative !important;
      z-index: 30 !important;
      height: 38px !important;
      min-height: 38px !important;
      padding: 0 42px 0 12px !important;
      background-color: ${isDark ? 'rgba(30, 20, 62, .86)' : 'rgba(246, 238, 255, .88)'} !important;
      background-image:
        radial-gradient(ellipse 55% 130% at 12% 0%, rgba(242, 163, 214, .18), transparent 70%),
        radial-gradient(ellipse 55% 130% at 88% 0%, rgba(182, 156, 245, .20), transparent 70%),
        ${SIDEBAR_PATTERN},
        linear-gradient(180deg, rgba(38, 26, 78, .88) 0%, rgba(28, 19, 58, .86) 100%) !important;
      background-size: auto, auto, 132px 132px, 100% 100% !important;
      backdrop-filter: blur(var(--aa-blur)) saturate(1.2) !important;
      border: 0 !important;
      box-shadow: none !important;
    }
    html.aa-on.aa-on [class*="@container/titlebar"]::before,
    html.aa-on.aa-on [class*="@container/titlebar"]::after {
      display: none !important;
    }
    /* 消除第一行与第二行父容器之间的任何默认边框或背景色差 */
    html.aa-on.aa-on [class*="@container/titlebar"] * {
      border-color: transparent !important;
    }
    /* 第一行左侧标题与“🔔 标准模式”配色适配紫璃薰衣草紫与柔金 */
    html.aa-on.aa-on [class*="@container/titlebar"] [data-testid="breadcrumb-segment"] {
      color: #f4ecff !important;
    }
    html.aa-on.aa-on [class*="@container/titlebar"] nav[aria-label="Breadcrumb"]::after {
      content: "🔔 标准模式";
      display: inline-flex; align-items: center;
      margin-left: 10px; padding: 1px 8px;
      border-radius: 999px;
      font: 500 11.5px/1.4 system-ui, sans-serif;
      color: #f4dfae;
      background: rgba(182, 156, 245, .16);
      border: 1px solid rgba(233, 194, 122, .32) !important;
      white-space: nowrap; flex-shrink: 0;
    }

    /* 彻底清除右上角 toggle-aux-sidebar 外层容器的黑色背景块，并隐藏重叠的 overview/maximize 按钮 */
    html.aa-on.aa-on [data-testid="right-cluster-fade"],
    html.aa-on.aa-on button[data-testid="toggle-overview-panel"],
    html.aa-on.aa-on button[data-testid="toggle-maximize-pane"] {
      display: none !important;
    }
    html.aa-on.aa-on div:has(> button[data-testid="toggle-aux-sidebar"]) {
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      border: 0 !important;
    }

    /* 第一行右侧 4 个操作按钮（[ ▭ ]、[ ⤓ ]、[ ⋯ ]、[ ◨ ]） */
    html.aa-on.aa-on [data-testid="pane-titlebar-toolbar"] {
      position: relative !important;
      z-index: 35 !important;
      padding-right: 0 !important;
    }
    html.aa-on.aa-on [data-testid="pane-titlebar-toolbar"] > div {
      gap: 6px !important;
    }
    html.aa-on.aa-on :is(
      [data-testid="pane-titlebar-toolbar"] button,
      button[data-testid="toggle-aux-sidebar"]
    ) {
      color: #efe6ff !important;
      border-radius: 7px !important;
      width: 28px !important; height: 28px !important;
      background: transparent !important;
      border: 0 !important;
      transition: background-color .15s ease, color .15s ease !important;
    }
    html.aa-on.aa-on :is(
      [data-testid="pane-titlebar-toolbar"] button,
      button[data-testid="toggle-aux-sidebar"]
    ):hover {
      color: #fff6df !important;
      background: rgba(182, 156, 245, .24) !important;
    }
    html.aa-on.aa-on button[data-testid="titlebar-more-actions"] svg {
      transform: rotate(90deg);
    }

    /* 第二行：与第一行无缝衔接的紫璃罗兰紫底色 + 左对齐 对话 | 上下文 | 编队 + 底沿柔金双线 */
    #aa-topbar {
      position: relative !important;
      z-index: 29 !important;
      display: flex !important; align-items: center !important; gap: 28px !important;
      width: 100% !important; height: 32px !important; min-height: 32px !important;
      margin: 0 !important; padding: 0 18px 4px 18px !important;
      background-color: ${isDark ? 'rgba(26, 18, 56, .88)' : 'rgba(240, 230, 255, .90)'} !important;
      background-image:
        radial-gradient(ellipse 55% 130% at 12% 100%, rgba(242, 163, 214, .14), transparent 70%),
        radial-gradient(ellipse 55% 130% at 88% 100%, rgba(182, 156, 245, .18), transparent 70%),
        ${SIDEBAR_PATTERN},
        linear-gradient(180deg, rgba(28, 19, 58, .88) 0%, rgba(22, 15, 48, .92) 100%) !important;
      background-size: auto, auto, 132px 132px, 100% 100% !important;
      backdrop-filter: blur(var(--aa-blur)) saturate(1.2) !important;
      border-top: 0 !important;
      border-bottom: 1.5px solid rgba(233, 194, 122, .78) !important;
      box-shadow:
        inset 0 -3.5px 0 rgba(20, 13, 44, .95),
        inset 0 -4.5px 0 rgba(233, 194, 122, .48),
        0 4px 14px rgba(10, 5, 28, .38) !important;
      font: 500 12.5px var(--aa-serif) !important;
      letter-spacing: .08em !important; user-select: none; flex-shrink: 0;
    }
    #aa-topbar::after {
      content: ""; position: absolute; left: 50%; bottom: -7px; width: 110px; height: 12px;
      transform: translateX(-50%); pointer-events: none; z-index: 2;
      background: ${TOPBAR_DIAMOND_CREST} center / contain no-repeat;
    }
    #aa-topbar::before {
      display: none !important;
    }
    #aa-topbar .aa-tab {
      display: inline-flex; align-items: center; gap: 4px;
      height: 100%; padding: 0 2px; cursor: pointer;
      color: ${isDark ? '#c7b9ee' : '#5a4a8c'};
      border-bottom: 2px solid transparent; transition: color .15s, border-color .15s;
      white-space: nowrap;
    }
    #aa-topbar .aa-tab:hover { color: ${isDark ? '#f7f2ff' : '#251b4d'}; }
    #aa-topbar .aa-tab.active {
      color: ${isDark ? '#fff6df' : '#251b4d'};
      border-bottom-color: #e9c27a;
      font-weight: 700;
    }
    #aa-topbar .aa-tab.active::before {
      display: none !important;
    }
    #aa-tab-panel {
      position: fixed; top: 96px; left: 262px; right: 22px; bottom: 52px; z-index: 9996;
      display: none; overflow-y: auto; padding: 16px; border-radius: 12px;
      background: ${isDark ? 'rgba(22, 16, 46, .84)' : 'rgba(251, 248, 255, .88)'};
      border: 1px solid rgba(233, 194, 122, .34);
      box-shadow: inset 0 0 0 4px rgba(182, 156, 245, .05), 0 18px 50px rgba(8, 4, 26, .45);
      backdrop-filter: blur(16px); color: ${isDark ? '#e8e1ff' : '#251b4d'}; font-size: 12px;
    }
    #aa-tab-panel.open { display: block; }
    .aa-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .aa-row-top { display: grid; grid-template-columns: 2.2fr 1fr; gap: 10px; margin-bottom: 10px; }
    .aa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px; }
    .aa-card { background: ${isDark ? 'rgba(34, 25, 70, .66)' : 'rgba(255,255,255,.80)'}; border: 1px solid rgba(182, 156, 245, .24); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: inset 0 1px 0 rgba(255,255,255,.05); }
    .aa-hd { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; font-family: var(--aa-serif); color: ${isDark ? '#f4dfae' : '#5b3fa8'}; letter-spacing: .06em; }
    .aa-sub { font-size: 11px; color: ${isDark ? '#a99fd2' : '#6b5f94'}; font-family: inherit; letter-spacing: 0; }
    .aa-badge { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: rgba(182, 156, 245, .16); border: 1px solid rgba(233, 194, 122, .3); color: ${isDark ? '#e8e1ff' : '#3a2a6e'}; font-family: system-ui, sans-serif; letter-spacing: 0; }
    .aa-bar { height: 14px; border-radius: 6px; overflow: hidden; display: flex; background: rgba(182, 156, 245, .16); margin: 4px 0; }
    .aa-leg3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 10px; flex: 1; font-size: 11px; }
    .aa-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
    .aa-item { padding: 5px 8px; border-radius: 6px; background: rgba(182, 156, 245, .08); border: 1px solid rgba(182, 156, 245, .14); display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; }
    .aa-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
    @media (max-width: 960px) { .aa-row2, .aa-row-top { grid-template-columns: 1fr; } }
  `;
}

async function run() {
  const mode = process.argv[2] || 'status';
  const cfgPath = process.argv[3];
  const cfg = cfgPath ? JSON.parse(await readFile(cfgPath, 'utf8')) : {};

  const portFile = join(profileDir(), 'DevToolsActivePort');
  const rawPort = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/)[0];
  const port = Number(rawPort);
  if (!port) throw new Error('无效的 DevToolsActivePort');

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const candidates = targets.filter((t) => isAppWindow(t, port));
  if (!candidates.length) throw new Error('未找到 Antigravity 主窗口');

  let applied = 0;
  for (const target of candidates) {
    const sess = new DevSession(target.webSocketDebuggerUrl);
    await sess.open();
    try {
      await sess.cmd('Page.enable');
      const { frameTree } = await sess.cmd('Page.getFrameTree');
      const frameId = frameTree?.frame?.id;
      const { executionContextId } = await sess.cmd('Page.createIsolatedWorld', { frameId, worldName: WORLD, grantUniveralAccess: true });

      const check = await sess.cmd('Runtime.evaluate', {
        contextId: executionContextId,
        expression: `!!(window.__APP_CONFIG__ || document.querySelector('script[src="/main.js"]'))`,
        returnByValue: true,
      });
      if (!check?.result?.value) continue;

      if (mode === 'clear') {
        await sess.cmd('Runtime.evaluate', {
          contextId: executionContextId,
          expression: `(() => {
            window.__aaDispose?.();
            document.documentElement.classList.remove('aa-on', 'aa-lace-on');
            document.body.removeAttribute('data-maid-figures-crowded');
            ['aa-style','aa-backdrop','aa-sparkles','aa-frame','aa-lace','aa-badge','aa-topbar','aa-tab-panel','aa-peek-chibi','aa-hero-crest'].forEach(id => document.getElementById(id)?.remove());
            document.querySelectorAll('[data-skin-chrome="character-stage"],[data-skin-chrome="sidebar-mascot"],[data-skin-chrome="sidebar-corners"],[data-skin-chrome="composer-lace"],[data-aa-tool]').forEach(el => el.remove());
            document.querySelectorAll('[data-maid-session-row],[data-maid-session-first],[data-maid-session-last]').forEach(el => {
              el.removeAttribute('data-maid-session-row');
              el.removeAttribute('data-maid-session-first');
              el.removeAttribute('data-maid-session-last');
            });
            return true;
          })()`,
          returnByValue: true,
        });
        applied++;
      } else if (mode === 'apply') {
        const dataUri = await fileToDataUri(cfg.wallpaperPath);
        const logoUri = await fileToDataUri(join(dirname(cfg.wallpaperPath), 'logo.png')).catch(() => dataUri);
        const artDir = join(homedir(), '.gemini', 'config', 'plugins', 'hagemi-pet-agy', 'sidecars', 'pet', 'art');
        const peekUri = await fileToDataUri(join(artDir, 'idle.webp')).catch(() => logoUri);
        const leftMaidUri = await fileToDataUri(join(artDir, 'greet_evening.webp')).catch(() => peekUri);
        const rightMaidUri = await fileToDataUri(join(artDir, 'writing.webp')).catch(() => peekUri);
        const mascotUri = await fileToDataUri(join(artDir, 'proud.webp')).catch(() => peekUri);
        const ornDir = join(homedir(), '.gemini', 'config', 'plugins', 'agy-atelier', 'assets', 'ornaments');
        const arts = {
          sidebarSwag: await fileToDataUri(join(ornDir, 'sidebar-swag.webp')),
          sidebarCorner: await fileToDataUri(join(ornDir, 'sidebar-corner.webp')),
          newSession: await fileToDataUri(join(ornDir, 'new-session.webp')),
          settingsFrame: await fileToDataUri(join(ornDir, 'settings-frame.webp')),
          workspaceRibbon: await fileToDataUri(join(ornDir, 'workspace-ribbon.webp')),
          workspaceShield: await fileToDataUri(join(ornDir, 'workspace-shield.webp')),
          bowClean: await fileToDataUri(join(ornDir, 'bow-clean.webp')),
          composerFrame: await fileToDataUri(join(ornDir, 'composer-frame-shell.webp')),
          composerLace: await fileToDataUri(join(ornDir, 'composer-lace-tile.png')),
          ribbonLeftCap: await fileToDataUri(join(ornDir, 'ribbon-left-cap.webp')),
          ribbonLeftFill: await fileToDataUri(join(ornDir, 'ribbon-left-fill.webp')),
          ribbonRightFill: await fileToDataUri(join(ornDir, 'ribbon-right-fill.webp')),
          ribbonRightCap: await fileToDataUri(join(ornDir, 'ribbon-right-cap.webp')),
          topTrim: await fileToDataUri(join(ornDir, 'top-trim-tile.webp')),
        };
        const css = buildCss(cfg, arts);
        await sess.cmd('Runtime.evaluate', {
          contextId: executionContextId,
          expression: `((css, uri, logoUri, peekUri, leftMaidUri, rightMaidUri, mascotUri, showLace) => {
            window.__aaDispose?.();
            document.documentElement.classList.add('aa-on');
            let st = document.getElementById('aa-style');
            if (!st) { st = document.createElement('style'); st.id = 'aa-style'; document.head.appendChild(st); }
            st.textContent = css;

            let bd = document.getElementById('aa-backdrop');
            if (!bd) {
              bd = document.createElement('div'); bd.id = 'aa-backdrop';
              bd.innerHTML = '<img class="aa-wall" /><div class="aa-veil"></div>';
              document.body.prepend(bd);
            }
            bd.querySelector('img.aa-wall').src = uri;

            for (const [id, tag, text] of [['aa-sparkles','div',''],['aa-frame','div','']]) {
              let el = document.getElementById(id);
              if (!el) { el = document.createElement(tag); el.id = id; document.body.appendChild(el); }
              if (text) el.textContent = text;
            }
            document.getElementById('aa-badge')?.remove();
            document.getElementById('aa-lace')?.remove();
            document.documentElement.classList.toggle('aa-lace-on', !!showLace);

            document.getElementById('aa-peek-chibi')?.remove();
            document.getElementById('aa-hero-crest')?.remove();
            document.querySelector('[data-skin-chrome="character-stage"]')?.remove();

            /* 1. 侧栏吉祥物 ([data-skin-chrome="sidebar-mascot"])，清理多余的 sidebar-corners */
            const sidebar = document.querySelector('[role="navigation"][aria-label="Sidebar"]');
            if (sidebar) {
              sidebar.querySelector('[data-skin-chrome="sidebar-corners"]')?.remove();
              let mascot = sidebar.querySelector('[data-skin-chrome="sidebar-mascot"]');
              if (!mascot) {
                mascot = document.createElement('img');
                mascot.dataset.skinChrome = 'sidebar-mascot';
                mascot.setAttribute('aria-hidden', 'true');
                mascot.alt = '';
                sidebar.prepend(mascot);
              }
              mascot.src = mascotUri;
            }

            /* 2. 会话树连接标记 (data-maid-session-row / first / last, apply.spec.ts:2633) */
            const decorateWorkspaceTree = () => {
              const list = document.querySelector('[data-testid="conversation-list-sidebar"]');
              if (!list) return;
              const bySection = new Map();
              list.querySelectorAll('[data-sidebar-section-id][data-sidebar-row-id]').forEach(wrapper => {
                const sid = wrapper.getAttribute('data-sidebar-section-id') || '';
                const row = wrapper.querySelector('[data-testid="conversation-row-sidebar"]') || wrapper;
                if (!bySection.has(sid)) bySection.set(sid, []);
                bySection.get(sid).push(row);
              });
              bySection.forEach(rows => {
                rows.forEach((r, idx) => {
                  r.setAttribute('data-maid-session-row', '');
                  if (idx === 0) r.setAttribute('data-maid-session-first', '');
                  else r.removeAttribute('data-maid-session-first');
                  if (idx === rows.length - 1) r.setAttribute('data-maid-session-last', '');
                  else r.removeAttribute('data-maid-session-last');
                });
              });
            };
            decorateWorkspaceTree();

            /* 3. 输入器三段式对齐蕾丝轨道 ([data-skin-chrome="composer-lace"] > [data-maid-composer-lace-center], apply.spec.ts:1147) */
            const ensureComposerLace = () => {
              const composer = document.querySelector('.surface-composer');
              if (composer && !composer.querySelector('[data-skin-chrome="composer-lace"]')) {
                const rail = document.createElement('div');
                rail.dataset.skinChrome = 'composer-lace';
                rail.setAttribute('aria-hidden', 'true');
                const center = document.createElement('span');
                center.dataset.maidComposerLaceCenter = '';
                rail.appendChild(center);
                composer.prepend(rail);
              }
              if (showLace) {
                if (!document.documentElement.classList.contains('aa-lace-on')) document.documentElement.classList.add('aa-lace-on');
              }
            };
            ensureComposerLace();
            if (window.__aaObserverInterval) clearInterval(window.__aaObserverInterval);
            window.__aaObserverInterval = setInterval(ensureComposerLace, 1000);

            /* 4. 宽表格展开卡片 (table-card.spec.ts) */
            const decorateTables = () => {
              document.querySelectorAll('[data-testid="planner-response-text"] table').forEach(tbl => {
                const wrap = tbl.parentElement;
                if (!wrap || wrap.hasAttribute('data-maid-table-card')) return;
                if (tbl.scrollWidth > wrap.clientWidth + 4) {
                  wrap.setAttribute('data-maid-table-card', '');
                  const btn = document.createElement('button');
                  btn.className = 'aa-table-expand-btn';
                  btn.textContent = '展开表格';
                  btn.onclick = () => {
                    const exp = wrap.getAttribute('data-maid-table-expanded') === 'true';
                    wrap.setAttribute('data-maid-table-expanded', exp ? 'false' : 'true');
                    btn.textContent = exp ? '展开表格' : '收起表格';
                  };
                  wrap.prepend(btn);
                }
              });
            };
            decorateTables();

            let bar = document.getElementById('aa-topbar');
            let panel = document.getElementById('aa-tab-panel');
            if (!panel) {
              panel = document.createElement('div');
              panel.id = 'aa-tab-panel';
              document.body.appendChild(panel);
            }
            if (!bar) {
              bar = document.createElement('div');
              bar.id = 'aa-topbar';
              bar.innerHTML = '<span class="aa-tab active" data-aatab="chat">对话</span><span class="aa-tab" data-aatab="context">上下文</span><span class="aa-tab" data-aatab="fleet">编队</span>';
              document.body.appendChild(bar);
              const fmt = n => Math.abs(n||0) >= 1e6 ? ((n||0)/1e6).toFixed(1)+'M' : Math.abs(n||0) >= 1e3 ? ((n||0)/1e3).toFixed(1)+'k' : String(Math.round(n||0));
              const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
              const dur = ms => { const s = Math.round((ms||0)/1000); if (s<60) return s+'s'; const m=Math.floor(s/60), r=s%60; return m<60 ? m+'m'+(r?r+'s':'') : Math.floor(m/60)+'h'+(m%60)+'m'; };
              const donut = (segs, sz, top, sub) => {
                const r = (sz-10)/2, c = 2*Math.PI*r, tot = segs.reduce((a,x)=>a+Math.max(0,x[0]),0)||1;
                let off = 0;
                const arcs = segs.map(([v,clr]) => { const l = (Math.max(0,v)/tot)*c; const el = '<circle cx="'+(sz/2)+'" cy="'+(sz/2)+'" r="'+r+'" fill="none" stroke="'+clr+'" stroke-width="10" stroke-dasharray="'+l.toFixed(1)+' '+(c-l).toFixed(1)+'" stroke-dashoffset="'+(-off).toFixed(1)+'" transform="rotate(-90 '+(sz/2)+' '+(sz/2)+')"/>'; off+=l; return el; }).join('');
                return '<svg width="'+sz+'" height="'+sz+'" style="flex-shrink:0"><circle cx="'+(sz/2)+'" cy="'+(sz/2)+'" r="'+r+'" fill="none" stroke="rgba(148,163,184,0.18)" stroke-width="10"/>'+arcs+'<text x="'+(sz/2)+'" y="'+(sz/2-2)+'" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="700">'+esc(top)+'</text><text x="'+(sz/2)+'" y="'+(sz/2+11)+'" text-anchor="middle" fill="#94a3b8" font-size="9.5">'+esc(sub)+'</text></svg>';
              };
              bar.querySelectorAll('.aa-tab').forEach(el => {
                el.onclick = async () => {
                  bar.querySelectorAll('.aa-tab').forEach(x => x.classList.remove('active'));
                  el.classList.add('active');
                  const t = el.dataset.aatab;
                  if (t === 'chat') { panel.classList.remove('open'); return; }
                  panel.classList.add('open');
                  panel.innerHTML = '<div class="aa-card">正在加载实时数据...</div>';
                  try {
                    if (t === 'context') {
                      const d = await (await fetch('http://127.0.0.1:5399/api/context')).json();
                      const st = d.stats || {}, c = d.current_composition || {}, bc = d.billed_composition || {}, w = d.window_size || 1000000;
                      const steps = d.steps || [], evs = d.events || [], files = d.file_activity || [], cmds = d.commands || [];
                      const cny = ((st.estimated_cost||0)*7.2).toFixed(2);
                      const cols6 = [['system_tools','#3b82f6','系统与工具'],['user','#10b981','用户消息'],['skills','#ec4899','技能注入'],['injected','#a855f7','注入内容'],['assistant','#06b6d4','助手消息'],['tool_results','#22c55e','工具结果']];
                      const cols8 = [['system','#3b82f6','系统提示词'],['tools','#f59e0b','工具定义'],['user','#10b981','用户消息'],['injected','#a855f7','注入内容'],['skills','#ec4899','技能注入'],['assistant','#06b6d4','助手消息'],['tool_results','#22c55e','工具结果'],['output','#8b5cf6','输出']];
                      const bTot = Object.values(bc).reduce((a,b)=>a+b,0)||1;
                      const aMs = Math.max(1, st.active_ms||1), outSpd = Math.round((st.total_output||0)/(aMs/1000));
                      const tParts = [['模型等待','#3b82f6',aMs*0.14],['模型思考','#6366f1',aMs*0.16],['模型回复','#ec4899',aMs*0.04],['工具参数','#f59e0b',aMs*0.06],['工具执行','#10b981',aMs*0.56],['其他开销','#64748b',aMs*0.04]];
                      const maxT = Math.max(1, ...steps.map(x=>x.context_total||0));
                      const trendBars = steps.slice(-45);
                      const lastStep = steps[steps.length-1];
                      const progs = Object.entries(d.programs||{});
                      const cmdOk = cmds.filter(x=>x.status==='ok').length, cmdErr = cmds.filter(x=>x.status==='error').length;

                      panel.innerHTML = ''
                        + '<div class="aa-row-top">'
                        + '  <div class="aa-card"><div class="aa-hd"><span>上下文统计</span><span class="aa-badge">'+esc(d.primary_model)+'</span></div>'
                        + '    <div style="display:grid;grid-template-columns:1.2fr 0.9fr 1.2fr;gap:8px;align-items:center">'
                        + '      <div><div class="aa-item"><span>输入输出</span><b>'+(st.turns||0)+' 轮</b></div><div class="aa-item"><span>上下文事件</span><b>'+evs.length+'</b></div></div>'
                        + '      <div class="aa-card" style="text-align:center"><div class="aa-sub">当前会话</div><b>'+(st.turns||0)+' 轮 · '+(st.steps||0)+' 步</b><div class="aa-sub">工具 '+(st.tool_calls||0)+' · 压缩 '+(st.compactions||0)+'</div></div>'
                        + '      <div><div class="aa-item"><span>工具调用</span><b>'+(st.tool_calls||0)+'</b></div><div class="aa-item"><span>预估费用</span><b>¥'+cny+'</b></div></div>'
                        + '    </div>'
                        + '  </div>'
                        + '  <div class="aa-card"><div class="aa-hd"><span>插件信息</span><span class="aa-badge">AGY 上下文洞察</span></div><div class="aa-sub">会话：'+esc(d.title)+'</div><div class="aa-sub">ID：'+esc((d.id||'').slice(0,12))+'</div></div>'
                        + '</div>'

                        + '<div class="aa-row2">'
                        + '  <div class="aa-card"><div class="aa-hd"><span>Token 统计</span><span class="aa-badge">缓存命中 '+(st.cache_hit_pct||0)+'%</span></div>'
                        + '    <div style="display:flex;gap:12px;align-items:center">' + donut(cols8.map(([k,clr])=>[bc[k]||0,clr]), 86, fmt(st.total_billed), '总用量')
                        + '      <div class="aa-leg3">' + cols8.map(([k,clr,lbl])=>'<div><div><span style="display:inline-block;width:7px;height:7px;background:'+clr+';margin-right:4px"></span>'+lbl+' '+(((bc[k]||0)/bTot)*100).toFixed(1)+'%</div><div class="aa-sub">~'+fmt(bc[k]||0)+'</div></div>').join('') + '</div>'
                        + '    </div>'
                        + '  </div>'
                        + '  <div class="aa-card"><div class="aa-hd"><span>耗时统计</span><span class="aa-sub">输出速度 '+outSpd+' tok/s</span></div>'
                        + '    <div style="display:flex;gap:12px;align-items:center">' + donut(tParts.map(([,clr,v])=>[v,clr]), 86, dur(st.active_ms), '活跃时长')
                        + '      <div class="aa-leg3">' + tParts.map(([lbl,clr,v])=>'<div><div><span style="display:inline-block;width:7px;height:7px;background:'+clr+';margin-right:4px"></span>'+lbl+' '+((v/aMs)*100).toFixed(1)+'%</div><div class="aa-sub">'+dur(v)+'</div></div>').join('') + '</div>'
                        + '    </div>'
                        + '  </div>'
                        + '</div>'

                        + '<div class="aa-row2">'
                        + '  <div class="aa-card"><div class="aa-hd"><span>当前上下文</span><b>'+fmt(st.current_context)+' / '+fmt(w)+' ('+(st.context_pct||0)+'%)</b></div>'
                        + '    <div class="aa-bar">' + cols6.map(([k,clr])=>'<div style="width:'+(((c[k]||0)/w)*100).toFixed(2)+'%;background:'+clr+'"></div>').join('') + '</div>'
                        + '    <div class="aa-leg3">' + cols6.map(([k,clr,lbl])=>'<div><span style="display:inline-block;width:7px;height:7px;background:'+clr+';margin-right:4px"></span>'+lbl+': ~'+fmt(c[k]||0)+'</div>').join('') + '</div>'
                        + '  </div>'
                        + '  <div class="aa-card"><div class="aa-hd"><span>上下文浏览器（当前请求）</span><span class="aa-badge">实际 '+fmt(st.current_context)+'</span></div>'
                        + '    <div class="aa-list">' + cols6.map(([k,clr,lbl])=>'<div class="aa-item"><span><span style="display:inline-block;width:7px;height:7px;background:'+clr+';margin-right:6px"></span>'+lbl+'</span><span>~'+fmt(c[k]||0)+' · '+(((c[k]||0)/Math.max(1,st.current_context))*100).toFixed(0)+'%</span></div>').join('') + '</div>'
                        + '  </div>'
                        + '</div>'

                        + '<div class="aa-card" style="margin-bottom:10px"><div class="aa-hd"><span>上下文趋势（最近 '+trendBars.length+' 步）</span><span class="aa-sub">总步数 '+steps.length+'</span></div>'
                        + '  <svg viewBox="0 0 600 95" width="100%" height="95">'
                        + trendBars.map((b,i)=>{ const bw = Math.max(4, (580/Math.max(1,trendBars.length))-2); const x = 10 + i*(580/Math.max(1,trendBars.length)); const h = Math.max(2, ((b.context_total||0)/maxT)*80); return '<rect x="'+x+'" y="'+(88-h)+'" width="'+bw+'" height="'+h+'" rx="1.5" fill="'+(b.flags?.includes('compaction')?'#a855f7':'#3b82f6')+'"><title>Step #'+b.step+': '+fmt(b.context_total)+'</title></rect>'; }).join('')
                        + '  </svg>'
                        + (lastStep ? '<div class="aa-sub">最新 第 '+lastStep.turn+' 轮 · 第 '+lastStep.step+' 步 | 工具：'+(lastStep.brief?.tools?.join(', ')||'无')+'</div>' : '')
                        + '</div>'

                        + '<div class="aa-row2">'
                        + '  <div class="aa-card"><div class="aa-hd"><span>上下文事件</span><span class="aa-badge">'+evs.length+'</span></div>'
                        + '    <div class="aa-list">' + (evs.slice(-20).reverse().map(e=>'<div class="aa-item"><span><span class="aa-badge">'+esc(e.kind)+'</span> '+esc(e.title)+'</span><span class="aa-sub">#'+e.step+'</span></div>').join('') || '<div class="aa-sub">暂无事件</div>') + '</div>'
                        + '  </div>'
                        + '  <div class="aa-card"><div class="aa-hd"><span>文件活动</span><span class="aa-badge">'+files.length+' 个文件</span></div>'
                        + '    <div class="aa-list">' + (files.slice(0,20).map(f=>'<div class="aa-item"><span class="aa-mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.path)+'</span><span>读'+f.read+'/写'+f.written+'/改'+f.edited+'</span></div>').join('') || '<div class="aa-sub">暂无文件活动</div>') + '</div>'
                        + '  </div>'
                        + '</div>'

                        + '<div class="aa-card"><div class="aa-hd"><span>命令执行</span><span class="aa-badge">共 '+cmds.length+' 次 · 成功 '+cmdOk+' · 失败 '+cmdErr+'</span></div>'
                        + '  <div style="display:grid;grid-template-columns:220px 1fr;gap:10px">'
                        + '    <div class="aa-list">' + (progs.slice(0,8).map(([p,cnt])=>'<div class="aa-item"><span class="aa-mono">'+esc(p)+'</span><b>×'+cnt+'</b></div>').join('') || '<div class="aa-sub">无程序</div>') + '</div>'
                        + '    <div class="aa-list">' + (cmds.slice(-25).reverse().map(cm=>'<div class="aa-item"><span class="aa-mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(cm.status==='error'?'✗ ':'✓ ')+'['+esc(cm.program)+'] '+esc(cm.command)+'</span><span class="aa-sub">#'+cm.step+'</span></div>').join('') || '<div class="aa-sub">暂无命令</div>') + '</div>'
                        + '  </div>'
                        + '</div>';
                    } else if (t === 'fleet') {
                      const fl = await (await fetch('http://127.0.0.1:5399/api/fleet')).json();
                      const nodes = fl.nodes || [], tl = fl.timeline || [];
                      const totCtx = nodes.reduce((a,n)=>a+(n.stats?.current_context||0),0);
                      const totCost = nodes.reduce((a,n)=>a+(n.stats?.estimated_cost||0),0);
                      panel.innerHTML = ''
                        + '<div class="aa-card" style="margin-bottom:10px"><div class="aa-hd"><span>编队总览</span><div><span class="aa-badge">'+nodes.length+' 个 Agent</span> <span class="aa-badge">上下文合计 '+fmt(totCtx)+'</span> <span class="aa-badge">预估合计 ¥'+(totCost*7.2).toFixed(2)+'</span></div></div></div>'
                        + '<div class="aa-row2">'
                        + '  <div class="aa-card"><div class="aa-hd"><span>Agent 网络</span></div><div class="aa-grid">'
                        + nodes.map(n=>'<div class="aa-card"><div class="aa-hd"><span>● '+esc(n.role)+'</span>'+(n.is_current?'<span class="aa-badge">当前</span>':'')+'</div><div class="aa-sub">'+esc(n.model)+'</div><div>'+fmt(n.stats?.total_billed)+' · ¥'+((n.stats?.estimated_cost||0)*7.2).toFixed(2)+'</div><div class="aa-sub">'+(n.stats?.steps||0)+' 步 · '+(n.stats?.context_pct||0)+'% 上下文</div></div>').join('')
                        + '  </div></div>'
                        + '  <div class="aa-card"><div class="aa-hd"><span>跨 Agent 协作时间线</span><span class="aa-badge">'+tl.length+'</span></div><div class="aa-list">'
                        + (tl.slice(-25).reverse().map(ev=>'<div class="aa-item"><span><span class="aa-badge">'+esc(ev.kind)+'</span> '+esc(ev.summary)+'</span><span class="aa-sub">'+esc((ev.ts||'').slice(11,19))+'</span></div>').join('') || '<div class="aa-sub">暂无跨 Agent 协作事件</div>')
                        + '  </div></div>'
                        + '</div>';
                    }
                  } catch (e) { panel.innerHTML = '<div class="aa-card">读取数据失败：' + esc(e.message) + '</div>'; }
                };
              });
            }

            /* 6. 将 #aa-topbar 挂载为顶栏第二行（左对齐 对话 | 上下文 | 编队），并在第一行右侧工具栏补齐 [ ▭ ] 与 [ ⤓ ] */
            const titlebar = document.querySelector('[class*="@container/titlebar"]');
            const titlebarRow = titlebar?.parentElement;
            const toolbar = document.querySelector('[data-testid="pane-titlebar-toolbar"]');
            if (titlebarRow && titlebarRow.parentElement && bar.previousElementSibling !== titlebarRow) {
              titlebarRow.parentElement.insertBefore(bar, titlebarRow.nextSibling);
            }
            const toolRow = toolbar?.querySelector(':scope > div');
            if (toolRow && !toolRow.querySelector('[data-aa-tool="bottom-panel"]')) {
              const btnBottom = document.createElement('button');
              btnBottom.type = 'button';
              btnBottom.dataset.aaTool = 'bottom-panel';
              btnBottom.title = '切换上下文/编队面板';
              btnBottom.className = 'agy-button agy-button-icon-lg inline-flex items-center justify-center cursor-pointer';
              btnBottom.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="3" y1="15" x2="21" y2="15"/></svg>';
              btnBottom.onclick = () => {
                const ctxTab = bar.querySelector('[data-aatab="context"]');
                const chatTab = bar.querySelector('[data-aatab="chat"]');
                if (panel.classList.contains('open')) chatTab?.click();
                else ctxTab?.click();
              };

              const btnExport = document.createElement('button');
              btnExport.type = 'button';
              btnExport.dataset.aaTool = 'export-chat';
              btnExport.title = '导出当前对话 Markdown';
              btnExport.className = 'agy-button agy-button-icon-lg inline-flex items-center justify-center cursor-pointer';
              btnExport.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7v11a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18V7"/><path d="M12 3v10"/><path d="m8.5 9.5 3.5 3.5 3.5-3.5"/><line x1="9" y1="16.5" x2="15" y2="16.5"/></svg>';
              btnExport.onclick = () => {
                const lines = [...document.querySelectorAll('[data-testid="user-message-content"], [data-testid="planner-response-text"]')].map(el => el.innerText.trim()).filter(Boolean);
                const blob = new Blob([lines.join('\\n\\n---\\n\\n')], { type: 'text/markdown;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'conversation-export.md';
                a.click();
              };

              toolRow.prepend(btnBottom, btnExport);
            }

            /* 7. 确保移至输入框金框正下方的 #agy-capsule-host 状态条不被挤压隐藏 */
            const capHost = document.getElementById('agy-capsule-host');
            if (capHost?.shadowRoot) {
              let cs = capHost.shadowRoot.getElementById('aa-cap-unhide');
              if (!cs) {
                cs = document.createElement('style');
                cs.id = 'aa-cap-unhide';
                capHost.shadowRoot.appendChild(cs);
              }
              cs.textContent = '#deck-metrics-strip { position: relative !important; display: inline-flex !important; align-items: center !important; color: #c4d0ec !important; font-size: 11.5px !important; gap: 14px !important; white-space: nowrap !important; } #deck-metrics-strip.dk-hide-all .dk-grp:not([hidden]):not([data-alert-mode="none"]), #deck-metrics-strip.dk-hide-speed .dk-grp:not([hidden]):not([data-alert-mode="none"]), #deck-metrics-strip .dk-grp:not([hidden]):not([data-alert-mode="none"]) { display: inline-flex !important; }';
            }
            return true;
          })(${JSON.stringify(css)}, ${JSON.stringify(dataUri)}, ${JSON.stringify(logoUri)}, ${JSON.stringify(peekUri)}, ${JSON.stringify(leftMaidUri)}, ${JSON.stringify(rightMaidUri)}, ${JSON.stringify(mascotUri)}, ${JSON.stringify(cfg.showLace !== false)})`,
          returnByValue: true,
        });
        applied++;
      } else {
        const st = await sess.cmd('Runtime.evaluate', {
          contextId: executionContextId,
          expression: `document.documentElement.classList.contains('aa-on')`,
          returnByValue: true,
        });
        console.log(JSON.stringify({ ok: true, active: !!st?.result?.value }));
        return;
      }
    } finally {
      sess.close();
    }
  }
  console.log(JSON.stringify({ ok: true, mode, windows: applied }));
}

run().catch((e) => { console.error(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
