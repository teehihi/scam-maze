import * as THREE from 'three';
import { canvas } from './textures';
import { tr } from './strings';

const st = (key: string, options?: Record<string, unknown>) => tr(`screen.${key}`, options);

const UI = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function clock(base = { h: 23, m: 8 }, elapsedSec = 0) {
  const total = base.h * 60 + base.m + Math.floor(elapsedSec / 60);
  const h = Math.floor(total / 60) % 24, m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ================= LAPTOP ================= */
export class LaptopScreen {
  c = canvas(1280, 800);
  ctx = this.c.getContext('2d')!;
  tex: THREE.CanvasTexture;
  wallpaper = canvas(1280, 800);
  constructor() {
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    const w = this.wallpaper.getContext('2d')!;
    const g = w.createLinearGradient(0, 0, 0, 800);
    g.addColorStop(0, '#1b2a44'); g.addColorStop(0.55, '#c56a5a'); g.addColorStop(0.75, '#f0b27a'); g.addColorStop(1, '#2a2233');
    w.fillStyle = g; w.fillRect(0, 0, 1280, 800);
    w.fillStyle = '#16131c';
    w.beginPath(); w.moveTo(0, 800);
    for (let x = 0; x <= 1280; x += 20) w.lineTo(x, 560 + Math.sin(x / 140) * 40 + Math.sin(x / 37) * 10);
    w.lineTo(1280, 800); w.fill();
    this.draw(0, '23:08');
  }

  draw(awake: number, time: string, typed = '') {
    const ctx = this.ctx;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 800);
    if (awake <= 0.01) { this.tex.needsUpdate = true; return; }
    ctx.globalAlpha = awake;
    ctx.drawImage(this.wallpaper, 0, 0);

    // --- browser window with mail inbox ---
    const bx = 70, by = 50, bw = 820, bh = 610;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, bx + 6, by + 10, bw, bh, 12); ctx.fill();
    ctx.fillStyle = '#f4f4f6'; rr(ctx, bx, by, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#dcdde3'; ctx.fillRect(bx, by + 10, bw, 34); rr(ctx, bx, by, bw, 40, 10); ctx.fill();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx + 22 + i * 20, by + 20, 6, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#fff'; rr(ctx, bx + 100, by + 8, 200, 26, 6); ctx.fill();
    ctx.fillStyle = '#333'; ctx.font = `14px ${UI}`; ctx.fillText(st('inbox'), bx + 112, by + 26);
    ctx.fillStyle = '#e8e9ee'; rr(ctx, bx + 310, by + 8, 170, 26, 6); ctx.fill();
    ctx.fillStyle = '#666'; ctx.fillText(st('file'), bx + 322, by + 26);
    // sidebar
    ctx.fillStyle = '#eceef3'; ctx.fillRect(bx, by + 44, 170, bh - 44);
    ctx.fillStyle = '#c9d7f5'; rr(ctx, bx + 10, by + 60, 150, 30, 15); ctx.fill();
    ctx.fillStyle = '#223'; ctx.font = `bold 14px ${UI}`; ctx.fillText(st('inboxLabel'), bx + 26, by + 80);
    ctx.font = `14px ${UI}`; ctx.fillStyle = '#444';
    [st('starred'), st('sent'), st('drafts'), st('bills'), st('work')].forEach((t, i) => ctx.fillText(t, bx + 26, by + 120 + i * 32));
    // list
    const mails: [string, string, string, boolean][] = [
      [st('m1from'), st('m1subj'), '22:17', true],
      [st('m2from'), st('m2subj'), '20:03', true],
      [st('m3from'), st('m3subj'), '18:40', true],
      [st('m4from'), st('m4subj'), '20/10', false],
      [st('m5from'), st('m5subj'), '18/10', false],
      [st('m6from'), st('m6subj'), '17/10', false],
      [st('m7from'), st('m7subj'), '15/10', false],
      [st('m8from'), st('m8subj'), '12/10', false],
    ];
    mails.forEach(([from, subj, t, unread], i) => {
      const y = by + 52 + i * 46;
      ctx.fillStyle = unread ? '#fff' : '#f4f5f8'; ctx.fillRect(bx + 172, y, bw - 172, 45);
      ctx.fillStyle = '#e3e4ea'; ctx.fillRect(bx + 172, y + 45, bw - 172, 1);
      ctx.fillStyle = '#222'; ctx.font = `${unread ? 'bold ' : ''}14px ${UI}`;
      ctx.fillText(from, bx + 190, y + 28);
      ctx.fillStyle = unread ? '#222' : '#555'; ctx.font = `${unread ? 'bold ' : ''}14px ${UI}`;
      const s = subj.length > 50 ? subj.slice(0, 50) + '…' : subj;
      ctx.fillText(s, bx + 350, y + 28);
      ctx.fillStyle = '#666'; ctx.font = `12px ${UI}`; ctx.fillText(t, bx + bw - 50, y + 28);
    });
    ctx.fillStyle = '#999'; ctx.font = `12px ${UI}`; ctx.fillText(st('storage'), bx + 190, by + bh - 18);

    // --- music mini player (paused) ---
    ctx.fillStyle = 'rgba(20,20,26,0.82)'; rr(ctx, 920, 60, 300, 92, 14); ctx.fill();
    ctx.fillStyle = '#5a4a7a'; rr(ctx, 934, 74, 64, 64, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 15px ${UI}`; ctx.fillText('rain on a tin roof', 1012, 98);
    ctx.fillStyle = '#aaa'; ctx.font = `13px ${UI}`; ctx.fillText(st('paused'), 1012, 120);
    ctx.fillStyle = '#555'; ctx.fillRect(1012, 134, 190, 3); ctx.fillStyle = '#ddd'; ctx.fillRect(1012, 134, 72, 3);

    // --- old notification still sitting in the corner ---
    const nx = 900, ny = 520, nw = 350, nh = 150;
    ctx.fillStyle = 'rgba(38,40,48,0.92)'; rr(ctx, nx, ny, nw, nh, 12); ctx.fill();
    ctx.fillStyle = '#0f5c4c'; rr(ctx, nx + 14, ny + 14, 22, 22, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${UI}`; ctx.fillText('N', nx + 21, ny + 30);
    ctx.fillStyle = '#ccc'; ctx.font = `12px ${UI}`; ctx.fillText('Northgate Bank  ·  18/10', nx + 46, ny + 30);
    ctx.fillStyle = '#888'; ctx.fillText('✕', nx + nw - 24, ny + 30);
    ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${UI}`; ctx.fillText(st('notifTitle'), nx + 16, ny + 60);
    ctx.fillStyle = '#d8d8de'; ctx.font = `13px ${UI}`;
    ctx.fillText(st('notifL1'), nx + 16, ny + 82);
    ctx.fillText(st('notifL2'), nx + 16, ny + 100);
    ctx.fillStyle = '#9a9aa4'; ctx.font = `11px ${UI}`;
    ctx.fillText(st('notifL3'), nx + 16, ny + 124);
    ctx.fillText(st('notifL4'), nx + 16, ny + 139);

    // --- reply draft being typed ---
    if (typed) {
      const ox = 270, oy = 150, ow = 620, oh = 420;
      ctx.fillStyle = 'rgba(0,0,0,0.32)'; rr(ctx, ox + 6, oy + 12, ow, oh, 12); ctx.fill();
      ctx.fillStyle = '#ffffff'; rr(ctx, ox, oy, ow, oh, 12); ctx.fill();
      ctx.fillStyle = '#e9eaf0'; rr(ctx, ox, oy, ow, 40, 12); ctx.fill(); ctx.fillRect(ox, oy + 24, ow, 16);
      ctx.fillStyle = '#333'; ctx.font = `bold 14px ${UI}`; ctx.fillText(st('replyTitle'), ox + 18, oy + 25);
      ctx.fillStyle = '#888'; ctx.font = `13px ${UI}`;
      ctx.fillText(st('replyTo'), ox + 18, oy + 66);
      ctx.fillText(st('replySubj'), ox + 18, oy + 90);
      ctx.fillStyle = '#e3e4ea'; ctx.fillRect(ox + 14, oy + 100, ow - 28, 1);
      ctx.fillStyle = '#1d1d22'; ctx.font = `17px ${UI}`;
      let ly = oy + 134;
      for (const para of typed.split('\n')) {
        let line = '';
        for (const wd of para.split(' ')) {
          if (ctx.measureText(line + wd).width > ow - 52) { ctx.fillText(line, ox + 22, ly); ly += 26; line = ''; }
          line += wd + ' ';
        }
        ctx.fillText(line, ox + 22, ly);
        const cw = ctx.measureText(line).width;
        if (para === typed.split('\n').slice(-1)[0]) { ctx.fillStyle = '#3b6fd8'; ctx.fillRect(ox + 22 + cw, ly - 16, 2, 20); ctx.fillStyle = '#1d1d22'; }
        ly += 26;
      }
      ctx.fillStyle = '#9db8ee'; rr(ctx, ox + 20, oy + oh - 56, 84, 34, 17); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${UI}`; ctx.fillText(st('send'), ox + 48, oy + oh - 34);
      ctx.fillStyle = '#aaa'; ctx.font = `12px ${UI}`; ctx.fillText(st('draftSaved'), ox + ow - 130, oy + oh - 34);
    }

    // --- taskbar ---
    ctx.fillStyle = 'rgba(18,18,24,0.78)'; ctx.fillRect(0, 752, 1280, 48);
    const icons = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#22c55e'];
    icons.forEach((c, i) => { ctx.fillStyle = c; rr(ctx, 480 + i * 52, 760, 34, 32, 7); ctx.fill(); });
    ctx.fillStyle = '#fff'; ctx.font = `14px ${UI}`; ctx.textAlign = 'right';
    ctx.fillText(time, 1260, 772); ctx.font = `12px ${UI}`; ctx.fillText('21/10/2025', 1260, 790);
    ctx.fillText('🔋 23%   📶', 1180, 782);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    this.tex.needsUpdate = true;
  }
}

/* ================= PHONE ================= */
export type PhoneMode = 'aod' | 'lock' | 'ringing' | 'call' | 'sms' | 'dark';

export class PhoneScreen {
  c = canvas(390, 844);
  ctx = this.c.getContext('2d')!;
  tex: THREE.CanvasTexture;
  constructor() {
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
  }

  draw(mode: PhoneMode, time: string, t: number, callSec = 0) {
    const ctx = this.ctx;
    const W = 390, H = 844;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (mode === 'dark') { this.tex.needsUpdate = true; return; }
    if (mode === 'aod') {
      ctx.fillStyle = 'rgba(200,210,230,0.55)';
      ctx.font = `200 84px ${UI}`; ctx.fillText(time, W / 2, 250);
      ctx.font = `16px ${UI}`; ctx.fillText(st('date'), W / 2, 284);
      ctx.fillStyle = 'rgba(110,220,140,0.75)'; ctx.font = `15px ${UI}`;
      ctx.fillText(st('charging'), W / 2, 760);
      // tiny notification icons
      ['#25D366', '#3b82f6', '#f59e0b'].forEach((c, i) => { ctx.fillStyle = c; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(W / 2 - 24 + i * 24, 320, 6, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
    } else if (mode === 'lock') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1d2b3a'); g.addColorStop(1, '#3b2f45');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = `16px ${UI}`; ctx.fillText(st('date'), W / 2, 110);
      ctx.font = `200 92px ${UI}`; ctx.fillText(time, W / 2, 200);
      const notes: [string, string, string, string][] = [
        ['#25D366', st('n1app'), st('n1msg'), '22:52'],
        ['#3b82f6', st('n2app'), st('n2msg'), '22:40'],
        ['#10b981', st('n3app'), st('n3msg'), '22:58'],
        ['#f59e0b', st('n4app'), st('n4msg'), '21:00'],
      ];
      notes.forEach(([c, app, msg, tm], i) => {
        const y = 260 + i * 104;
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; rr(ctx, 16, y, W - 32, 92, 18); ctx.fill();
        ctx.fillStyle = c; rr(ctx, 30, y + 14, 26, 26, 6); ctx.fill();
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `bold 15px ${UI}`; ctx.fillText(app, 66, y + 33);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `13px ${UI}`; ctx.textAlign = 'right'; ctx.fillText(tm, W - 30, y + 33);
        ctx.textAlign = 'left'; ctx.fillStyle = '#eee'; ctx.font = `14px ${UI}`;
        const words = msg.split(' '); let line = '', ly = y + 58;
        for (const wd of words) { if (ctx.measureText(line + wd).width > W - 80) { ctx.fillText(line, 32, ly); line = ''; ly += 19; } line += wd + ' '; }
        ctx.fillText(line, 32, ly);
        ctx.textAlign = 'center';
      });
      ctx.fillStyle = 'rgba(110,220,140,0.9)'; ctx.font = `14px ${UI}`; ctx.fillText('64%', W / 2, 780);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; rr(ctx, W / 2 - 70, 810, 140, 5, 3); ctx.fill();
    } else if (mode === 'ringing' || mode === 'call') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#20242c'); g.addColorStop(1, '#0d0f13');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const pulse = mode === 'ringing' ? (Math.sin(t * 6) * 0.5 + 0.5) : 0;
      ctx.fillStyle = `rgba(120,140,170,${0.15 + pulse * 0.2})`;
      ctx.beginPath(); ctx.arc(W / 2, 240, 70 + pulse * 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(W / 2, 240, 58, 0, 7); ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.font = `bold 44px ${UI}`; ctx.fillText('?', W / 2, 256);
      ctx.fillStyle = '#fff'; ctx.font = `300 34px ${UI}`; ctx.fillText('+000 0000 1234', W / 2, 360);
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `15px ${UI}`;
      ctx.fillText(mode === 'ringing' ? st('incoming') : st('calling', { sec: String(Math.floor(callSec)).padStart(2, '0') }), W / 2, 392);
      ctx.fillStyle = 'rgba(255,200,120,0.85)'; ctx.font = `13px ${UI}`;
      ctx.fillText(st('maybe'), W / 2, 420);
      if (mode === 'ringing') {
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(100, 700, 36, 0, 7); ctx.fill();
        ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(290, 700, 36, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `14px ${UI}`; ctx.fillText(st('declineBtn'), 100, 762); ctx.fillText(st('answerBtn'), 290, 762);
        ctx.font = `bold 26px ${UI}`; ctx.fillText('✕', 100, 709); ctx.fillText('✆', 290, 710);
      } else {
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(W / 2, 720, 36, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${UI}`; ctx.fillText('✕', W / 2, 729);
      }
    } else if (mode === 'sms') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1d2b3a'); g.addColorStop(1, '#3b2f45');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = `200 92px ${UI}`; ctx.fillText(time, W / 2, 200);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, 16, 250, W - 32, 170, 18); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `bold 15px ${UI}`; ctx.fillText(st('smsFrom'), 32, 280);
      ctx.fillStyle = '#eee'; ctx.font = `14px ${UI}`;
      [st('sms1'), st('sms2'), st('sms3'), st('sms4'), st('sms5')].forEach((l, i) => ctx.fillText(l, 32, 308 + i * 21));
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; rr(ctx, 16, 432, W - 32, 70, 18); ctx.fill();
      ctx.fillStyle = '#ddd'; ctx.font = `13px ${UI}`; ctx.fillText(st('missed'), W / 2, 472);
    }
    this.tex.needsUpdate = true;
  }
}
