(() => {
  const $ = s => document.querySelector(s);
  const charEl = $('#char'), leanEl = $('#lean');
  const log = $('#log'), input = $('#input'), form = $('#form'), sendBtn = $('#send');
  const bubble = $('#bubble'), stage = $('#stage'), note = $('#note'), statusEl = $('#status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 411, H = 486;

  /* ================= Particle Sphere (port of the Remotion "ParticleSphere" composition) =================
     Lat/long dot grid displaced by seeded simplex noise, rim-lit, additively accumulated, plus a blurred glow layer.
     Palette, noise seeds, props (rows 150, radius .34, displacement .14, glow .9) and the 10 s loop match the source. */
  const state = { blinkL: false, blinkR: false, mouth: false, blush: 0, dirty: true };
  const mark = () => { state.dirty = true; };
  const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const mulberry32 = seed => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const createNoise3D = seed => {
    const rand = mulberry32(seed), p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const perm = new Uint8Array(512), pm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = perm[i] % 12; }
    const F3 = 1 / 3, G3 = 1 / 6;
    const corner = (x, y, z, gi) => { let tt = 0.6 - x * x - y * y - z * z; if (tt < 0) return 0; const g = grad3[gi]; tt *= tt; return tt * tt * (g[0] * x + g[1] * y + g[2] * z); };
    return (xin, yin, zin) => {
      const s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s), t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) { if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; } else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; } else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; } }
      else { if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; } else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; } else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; } }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3;
      const x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3, ii = i & 255, jj = j & 255, kk = k & 255;
      return 32 * (corner(x0,y0,z0,pm[ii+perm[jj+perm[kk]]]) + corner(x1,y1,z1,pm[ii+i1+perm[jj+j1+perm[kk+k1]]]) + corner(x2,y2,z2,pm[ii+i2+perm[jj+j2+perm[kk+k2]]]) + corner(x3,y3,z3,pm[ii+1+perm[jj+1+perm[kk+1]]]));
    };
  };
  const noise = createNoise3D(42), noise2 = createNoise3D(1337);
  const PALETTE = [[-1, 80,190,255], [-0.45, 120,110,255], [0.05, 165,70,210], [0.5, 240,55,115], [1, 255,105,50]];
  const col = [0, 0, 0];
  function samplePalette(t) {
    const v = Math.min(1, Math.max(-1, t));
    for (let i = 0; i < 4; i++) { const a = PALETTE[i], b = PALETTE[i + 1];
      if (v <= b[0]) { const k = (v - a[0]) / (b[0] - a[0]); col[0] = a[1] + (b[1]-a[1])*k; col[1] = a[2] + (b[2]-a[2])*k; col[2] = a[3] + (b[3]-a[3])*k; return col; } }
    col[0] = 255; col[1] = 105; col[2] = 50; return col;
  }
  const ROWS = 150, RADIUS = 0.34, DISP = 0.14, GLOW = 0.9, LOOP = 10, S = 640, DOT = Math.max(1, Math.round(2 * S / 1080));
  const parts = (() => {
    const rand = mulberry32(7), out = [];
    for (let r = 0; r < ROWS; r++) {
      const lat = -Math.PI / 2 + (Math.PI * (r + 0.5)) / ROWS, ring = Math.cos(lat), n = Math.max(1, Math.round(ROWS * 2 * ring));
      for (let c = 0; c < n; c++) { const lon = (Math.PI * 2 * c) / n;
        out.push({ x: ring * Math.cos(lon), y: Math.sin(lat), z: ring * Math.sin(lon), seed: rand(), sparkle: rand() < 0.006, twinkle: 1 + Math.floor(rand() * 4) }); }
    }
    return out;
  })();
  const cv = $('#sphere'), glowCv = $('#sphereGlow'), g = cv.getContext('2d'), gg = glowCv.getContext('2d');
  cv.width = cv.height = glowCv.width = glowCv.height = S;
  const acc = new Float32Array(S * S * 3), img = g.createImageData(S, S);
  glowCv.style.filter = `blur(${Math.round(S / 140)}px)`;
  const MOODS_FX = { happy: [1.0, .02], tease: [1.5, .03], think: [0.6, 0], shy: [0.8, .01], surprised: [2.2, .06], neutral: [1, 0] };
  let speed = 1, speedT = 1, extra = 0, extraT = 0, burst = 0, speaking = false, phase = 0, last = performance.now();
  /* ---------- Interaction: hover repel · hold attract · drag rotate (inertia) · click shockwave · wheel zoom ---------- */
  const ptr = { x: 0, y: 0, in: false, down: false, moved: 0, sx: 0, sy: 0 };
  const waves = [];
  let twist = 0, scatter = 0, freezeK = 0, spinMul = 1, cmdBeat = false, flipping = false, hueDeg = 0, zc = 0;
  const anims = [];
  let beatZ = 0, inhaleK = 0, thinking = false, beatT = 0, prevU = 1, inhaleUntil = 0, streamLen = 0, streamed = 0, lastCss = 0, pv = 0;
  let kick = 0, zk = 0, spark = 0, rotOff = 0, tiltOff = 0, velRot = 0, velTilt = 0, zoom = 1, zoomT = 1, dragged = false, pressT = 0, pull = 0, ptrK = 0;
  const WAVE_MAX = 6;
  function addWave(x, y, a = 1, r = S * 0.02, v = 0.55) { waves.push({ x, y, r, a, v }); if (waves.length > WAVE_MAX) waves.shift(); }
  const toS = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * S, ((e.clientY - r.top) / r.height) * S]; };
  charEl.addEventListener('pointerenter', e => { ptr.in = true; [ptr.x, ptr.y] = toS(e); });
  charEl.addEventListener('pointerleave', () => { ptr.in = false; ptr.down = false; });
  charEl.addEventListener('pointerdown', e => {
    try { charEl.setPointerCapture(e.pointerId); } catch {}
    ptr.down = true; ptr.in = true; ptr.moved = 0; dragged = false; pressT = performance.now(); [ptr.x, ptr.y] = toS(e); ptr.sx = e.clientX; ptr.sy = e.clientY;
    velRot = velTilt = 0; document.getElementById('hint')?.classList.add('off');
  });
  charEl.addEventListener('pointermove', e => {
    const [x, y] = toS(e); ptr.in = true;
    if (ptr.down) {
      const dx = e.clientX - ptr.sx, dy = e.clientY - ptr.sy; ptr.sx = e.clientX; ptr.sy = e.clientY;
      ptr.moved += Math.abs(dx) + Math.abs(dy);
      if (ptr.moved > 6) { dragged = true; charEl.classList.add('grabbing'); }
      if (dragged) { velRot = dx * 0.006; velTilt = dy * 0.004; rotOff += velRot; tiltOff = Math.max(-0.9, Math.min(0.9, tiltOff + velTilt)); }
    }
    ptr.x = x; ptr.y = y;
  });
  const up = () => { ptr.down = false; charEl.classList.remove('grabbing'); };
  charEl.addEventListener('pointerup', e => { if (!dragged) { const [x, y] = toS(e); addWave(x, y, 1); } up(); });
  charEl.addEventListener('pointercancel', up);
  charEl.addEventListener('wheel', e => { e.preventDefault(); zoomT = Math.max(0.65, Math.min(1.6, zoomT * Math.exp(-e.deltaY * 0.0012))); }, { passive: false });
  charEl.addEventListener('dblclick', () => { zoomT = 1; tiltOff = 0; });

  /* ---------- Keyboard: typing = ripples, delete = implosion, Enter = shockwave ---------- */
  const rim = () => { const a = Math.random() * 6.283, d = S * 0.34 * (0.5 + Math.random() * 0.5); return [S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d]; };
  function keyFx(ch) {
    if (reduced) return;
    const box = document.getElementById('form').getBoundingClientRect(), sp = sphereBox(), now = performance.now();
    const x0 = box.left + box.width / 2, y0 = box.top + box.height / 2;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const tx = sp.x + (Math.random() - .5) * sp.R * .5, ty = sp.y + (Math.random() - .5) * sp.R * .5, side = (Math.random() - .5) * 2;
      fxp.push({ t0: now + i * 35, dur: 480 + Math.random() * 260, x0: x0 + (Math.random() - .5) * 40, y0: y0 + (Math.random() - .5) * 6, x1: tx, y1: ty, cx: (x0 + tx) / 2 + side * 90, cy: (y0 + ty) / 2 + 10, ease: easeIn, rgb: rgbOf(Math.random() * 2 - 1),
        ch: null, size: 0.6 + Math.random() * 0.8, fade: 'in', done: () => { kick = Math.min(1.2, kick + 0.02); spark = 1; } });
    }
  }
  function typeFx(ch) { keyFx(ch); const [x, y] = rim(); addWave(x, y, 0.55); kick = Math.min(1.2, kick + 0.35); spark = 1; burst = Math.max(burst, 0.12); }
  function deleteFx() { addWave(S / 2, S / 2, -0.9, S * 0.34, -0.5); zk = -0.07; kick = Math.min(1.2, kick + 0.1); }
  function enterFx() { addWave(S / 2, S / 2, -0.8, S * 0.42, -0.7); zk = -0.05; }
  input.addEventListener('input', e => {
    const t = e.inputType || '';
    if (t.startsWith('delete')) deleteFx(); else if (t.startsWith('insert') || t === 'historyUndo' || t === 'historyRedo') typeFx(e.data);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && input.value.trim() && input.value.trim()[0] !== '/') enterFx(); });
  input.addEventListener('focus', () => { addWave(S / 2, S / 2, 0.35, S * 0.05, 0.4); });

  /* ---------- Slash commands: the sphere performs a preset motion ---------- */
  const bell = u => Math.sin(Math.PI * u), easeIO3 = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  function runAnim(name, dur, fn, end) {
    const old = anims.findIndex(a => a.name === name);
    if (old >= 0) { anims[old].fn(1); anims[old].end && anims[old].end(); anims.splice(old, 1); }
    anims.push({ name, t0: performance.now(), dur, fn, end });
  }
  const wavesBurst = (n, gap, a = 1, v = 0.7) => { for (let i = 0; i < n; i++) setTimeout(() => addWave(S / 2, S / 2, a, S * 0.02, v), i * gap); };
  const COMMANDS = [
    { key: 'xoay', alias: ['spin'], label: '/xoay', desc: 'Quay nhanh', msg: 'Quả cầu đang xoay nhanh.',
      run() { runAnim('spin', 4200, u => { spinMul = 1 + 14 * bell(u) * (1 - u * .3); }, () => { spinMul = 1; }); } },
    { key: 'nhip', alias: ['pulse', 'beat'], label: '/nhịp', desc: 'Đập như nhịp tim', msg: 'Quả cầu đang đập theo nhịp.',
      run() { cmdBeat = true; beatT = 0.9; runAnim('beat', 8000, () => {}, () => { cmdBeat = false; }); } },
    { key: 'no', alias: ['explode', 'boom'], label: '/nổ', desc: 'Nổ rồi tụ lại', msg: 'Quả cầu nổ tung rồi tụ lại.',
      run() { burst = 1; addWave(S / 2, S / 2, 1.4, S * 0.02, 1); runAnim('scatter', 2800, u => { const s = u < .1 ? u / .1 : Math.pow(1 - (u - .1) / .9, 2); scatter = 0.17 * s; }, () => { scatter = 0; }); } },
    { key: 'co', alias: ['shrink', 'collapse'], label: '/co', desc: 'Co rút rồi bung ra', msg: 'Quả cầu co rút rồi bung ra.',
      run() { runAnim('shrink', 2000, u => { zc = -0.42 * Math.sin(Math.PI * Math.pow(u, 0.7)); }, () => { zc = 0; burst = 0.9; addWave(S / 2, S / 2, 1.2, S * 0.02, 0.9); }); } },
    { key: 'song', alias: ['wave', 'ripple'], label: '/sóng', desc: 'Chuỗi sóng từ tâm', msg: 'Chuỗi sóng lan ra từ tâm.',
      run() { wavesBurst(6, 280, 1.1, 0.7); } },
    { key: 'loc', alias: ['vortex', 'twist'], label: '/lốc', desc: 'Xoáy lốc', msg: 'Quả cầu xoáy thành lốc.',
      run() { runAnim('twist', 3800, u => { twist = 5.5 * bell(u); spinMul = 1 + 3 * bell(u); }, () => { twist = 0; spinMul = 1; }); } },
    { key: 'lat', alias: ['flip', 'roll'], label: '/lật', desc: 'Lật một vòng', msg: 'Quả cầu lật một vòng.',
      run() { flipping = true; velTilt = 0; runAnim('flip', 1900, u => { tiltOff = Math.PI * 2 * easeIO3(u); }, () => { tiltOff = 0; flipping = false; }); } },
    { key: 'dung', alias: ['freeze', 'stop'], label: '/dừng', desc: 'Đóng băng 4 giây', msg: 'Quả cầu đóng băng.',
      run() { runAnim('freeze', 4000, u => { freezeK = u < .1 ? u / .1 : u > .9 ? (1 - u) / .1 : 1; }, () => { freezeK = 0; }); } },
    { key: 'mau', alias: ['color', 'hue'], label: '/màu', desc: 'Đổi tông màu', msg: 'Đã đổi tông màu.',
      run() { hueDeg += 120; cv.style.transition = glowCv.style.transition = 'filter .9s ease'; cv.style.filter = `hue-rotate(${hueDeg}deg)`; glowCv.style.filter = `blur(${Math.round(S / 140)}px) hue-rotate(${hueDeg}deg)`; } },
    { key: 'reset', alias: ['default', 'macdinh'], label: '/reset', desc: 'Về mặc định', msg: 'Đã đặt lại quả cầu.',
      run() { anims.length = 0; twist = scatter = freezeK = zc = 0; spinMul = 1; cmdBeat = false; flipping = false; tiltOff = 0; zoomT = 1; waves.length = 0;
        hueDeg = 0; cv.style.filter = ''; glowCv.style.filter = `blur(${Math.round(S / 140)}px)`; } },
  ];
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const findCmd = n => { n = norm(n); return COMMANDS.find(c => c.key === n || c.alias.includes(n)); };
  function matchCmds(q) { q = norm(q); return COMMANDS.filter(c => !q || c.key.startsWith(q) || c.alias.some(a => a.startsWith(q)) || c.key.includes(q)); }
  function draw() {
    const FR = S * 0.17, FR2 = FR * FR, R = RADIUS * S * zoom * (1 + zk + zc + beatZ - 0.05 * inhaleK), camDist = R * 4, c0 = S / 2, tilt = 0.35 + tiltOff;
    const ox = Math.cos(phase) * 0.9, oy = Math.sin(phase) * 0.9;
    const ang = phase + rotOff, cy = Math.cos(ang), sy = Math.sin(ang), ct = Math.cos(tilt), st = Math.sin(tilt);
    const disp = DISP + extra + kick * 0.06 + beatZ * 0.9 + inhaleK * 0.02 + burst * 0.1 + (speaking ? 0.03 + (state.mouth ? 0.02 : 0) : 0);
    acc.fill(0);
    for (const p of parts) {
      const n1 = noise(p.x * 1.3 + ox, p.y * 1.3 + oy, p.z * 1.3);
      const n2 = noise2(p.x * 3.2 - oy, p.y * 3.2 + ox, p.z * 3.2);
      const ridge = 1 - Math.abs(noise(p.x * 2.2 + oy * 1.5, p.y * 2.2, p.z * 2.2 - ox * 1.5));
      const d = n1 * 0.6 + n2 * 0.25 + (ridge - 0.5) * 0.35;
      const stray = p.seed > 0.97 ? (p.seed - 0.97) * 3 * Math.max(0, ridge) : 0;
      const rr = R * (1 + disp * d + stray + scatter * (0.4 + p.seed * 1.6));
      let x = p.x * rr, y = p.y * rr, z = p.z * rr;
      if (twist) { const tw = twist * p.y, c2 = Math.cos(tw), s2 = Math.sin(tw), xx = x * c2 - z * s2; z = x * s2 + z * c2; x = xx; }
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      x = x1; y = y2; z = z2;
      const persp = camDist / (camDist - z);
      let sx = c0 + x * persp, syy = c0 + y * persp, hot = 0;
      if (ptr.in && ptrK > 0.01) {
        const dx = sx - ptr.x, dy = syy - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < FR2) { const d = Math.sqrt(d2) + 1e-3, f = 1 - d / FR, f2 = f * f;
          const push = (ptr.down ? -1.15 : 1) * f2 * S * 0.075 * ptrK * (1 + pull);
          sx += (dx / d) * push; syy += (dy / d) * push; hot += f2 * ptrK; }
      }
      for (let w = 0; w < waves.length; w++) { const wv = waves[w], dx = sx - wv.x, dy = syy - wv.y, d = Math.sqrt(dx * dx + dy * dy) + 1e-3, q = (d - wv.r) / (S * 0.05), e = Math.exp(-q * q) * wv.a;
        if (Math.abs(e) > 0.01) { sx += (dx / d) * e * S * 0.028; syy += (dy / d) * e * S * 0.028; hot += Math.abs(e) * 0.9; } }
      const facing = Math.abs(z) / rr, rim = Math.pow(1 - facing, 2.2), front = z > 0 ? 1 : 0.55;
      let b = (0.17 + 1.15 * rim) * front * (0.55 + Math.max(0, ridge - 0.35) * 1.6);
      const c = samplePalette(y / R + n2 * 0.35 + (p.seed - 0.5) * 0.2);
      let r = c[0], gC = c[1], bl = c[2];
      if (hot > 0.01) { b *= 1 + hot * 1.8; const w = Math.min(1, hot * 0.55); r += (255 - r) * w; gC += (255 - gC) * w; bl += (255 - bl) * w; }
      if (p.sparkle) { const tw = 0.5 + 0.5 * Math.sin(phase * p.twinkle + p.seed * 50), w = Math.pow(tw, 3);
        r += (255 - r) * w; gC += (255 - gC) * w; bl += (255 - bl) * w; b = Math.max(b, 0.25 + 1.2 * w); }
      const ix = Math.round(sx), iy = Math.round(syy);
      for (let dy = 0; dy < DOT; dy++) { const py = iy + dy; if (py < 0 || py >= S) continue;
        for (let dx = 0; dx < DOT; dx++) { const px = ix + dx; if (px < 0 || px >= S) continue;
          const o = (py * S + px) * 3; acc[o] += r * b; acc[o + 1] += gC * b; acc[o + 2] += bl * b; } }
    }
    const data = img.data;
    for (let i = 0, j = 0; i < acc.length; i += 3, j += 4) { data[j] = acc[i] > 255 ? 255 : acc[i]; data[j+1] = acc[i+1] > 255 ? 255 : acc[i+1]; data[j+2] = acc[i+2] > 255 ? 255 : acc[i+2]; data[j+3] = 255; }
    g.putImageData(img, 0, 0);
    gg.drawImage(cv, 0, 0);
  }
  let accT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    speed += (speedT - speed) * Math.min(1, dt * 3); zoom += (zoomT - zoom) * Math.min(1, dt * 8); kick *= Math.pow(0.03, dt); zk += (0 - zk) * Math.min(1, dt * 7); spark *= Math.pow(0.1, dt);
    if (!ptr.down) { rotOff += velRot; velRot *= Math.pow(0.04, dt); tiltOff += (flipping ? 0 : (0 - tiltOff) * Math.min(1, dt * 0.6)) + velTilt; velTilt *= Math.pow(0.04, dt); }
    ptrK += ((ptr.in ? 1 : 0) - ptrK) * Math.min(1, dt * 8); pull = ptr.down && !dragged ? Math.min(1, (performance.now() - pressT) / 400) : 0;
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.r += dt * S * w.v; w.a *= Math.pow(0.18, dt); if (Math.abs(w.a) < 0.03 || w.r < 0) waves.splice(i, 1); } extra += (extraT - extra) * Math.min(1, dt * 3); burst *= Math.pow(0.04, dt);
    // heartbeat while thinking (lub-dub), inhale while absorbing
    const nowMs = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i], u = (nowMs - a.t0) / a.dur; if (u >= 1) { a.fn(1); a.end && a.end(); anims.splice(i, 1); } else a.fn(Math.max(0, u)); }
    inhaleK += ((nowMs < inhaleUntil ? 1 : 0) - inhaleK) * Math.min(1, dt * 6);
    if ((thinking || cmdBeat) && nowMs >= inhaleUntil) {
      beatT += dt; const T = 1.1, u = beatT % T;
      if (u < prevU && beatT > 0.2) addWave(S / 2, S / 2, 0.5, S * 0.16, 0.45);
      prevU = u;
      beatZ += ((Math.exp(-Math.pow(u / 0.09, 2)) + 0.6 * Math.exp(-Math.pow((u - 0.27) / 0.1, 2))) * 0.045 - beatZ) * Math.min(1, dt * 30);
    } else { beatZ *= Math.pow(0.001, dt); prevU = 1; }
    pv = Math.max(Math.abs(beatZ) * 18, kick * 0.6, burst * 0.7, inhaleK * 0.5, Math.min(1, waves.length * 0.12));
    if (nowMs - lastCss > 40) { lastCss = nowMs; document.documentElement.style.setProperty('--pulse', Math.min(1, pv).toFixed(2)); }
    if (!reduced) phase = (phase + (dt / LOOP) * Math.PI * 2 * speed * spinMul * (1 - freezeK)) % (Math.PI * 2 * 1000);
    accT += dt;
    if (document.visibilityState === 'visible' && (accT > 1 / 40 || reduced === false)) { accT = 0; draw(); }
    requestAnimationFrame(frame);
  }
  draw(); requestAnimationFrame(frame);

  /* ---------- FX layer: your message is inhaled into the sphere, the reply streams out of it ---------- */
  const SEND_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STOP_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';
  const fxc = document.createElement('canvas'); fxc.id = 'fx'; fxc.setAttribute('aria-hidden', 'true'); document.body.appendChild(fxc);
  const fg = fxc.getContext('2d'); let fw = 0, fh = 0, fdpr = 1;
  const fxFit = () => { fdpr = Math.min(devicePixelRatio || 1, 2); fw = innerWidth; fh = innerHeight; fxc.width = Math.round(fw * fdpr); fxc.height = Math.round(fh * fdpr); };
  addEventListener('resize', fxFit); fxFit();
  const fxp = [];
  const easeIn = u => u * u * u, easeOut = u => 1 - Math.pow(1 - u, 3), easeIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const bez = (p, u) => { const a = 1 - u; return [a * a * p.x0 + 2 * a * u * p.cx + u * u * p.x1, a * a * p.y0 + 2 * a * u * p.cy + u * u * p.y1]; };
  const sphereBox = () => { const r = cv.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * RADIUS * zoom }; };
  const rgbOf = t => { const c = samplePalette(t); return [c[0] | 0, c[1] | 0, c[2] | 0]; };
  function ingestFx(text) {
    streamLen = 0; streamed = 0;
    if (reduced) return;
    const box = document.getElementById('form').getBoundingClientRect(), sp = sphereBox(), now = performance.now();
    const chars = [...text.replace(/\s+/g, '')];
    const n = Math.max(28, Math.min(150, text.length * 4));
    let last = 0;
    for (let i = 0; i < n; i++) {
      const x0 = box.left + box.width / 2 + (Math.random() - .5) * Math.min(box.width - 80, 40 + text.length * 8);
      const y0 = box.top + box.height / 2 + (Math.random() - .5) * 8;
      const tx = sp.x + (Math.random() - .5) * sp.R * .25, ty = sp.y + (Math.random() - .5) * sp.R * .25;
      const side = (Math.random() - .5) * 2;
      const delay = (i / n) * 520 + Math.random() * 60, dur = 650 + Math.random() * 350;
      last = Math.max(last, delay + dur);
      fxp.push({ t0: now + delay, dur, x0, y0, tx, ty, x1: tx, y1: ty, cx: (x0 + tx) / 2 + side * 140, cy: (y0 + ty) / 2 + 20, ease: easeIn, rgb: rgbOf(Math.random() * 2 - 1),
        ch: i % 5 < 2 && chars.length ? chars[i % chars.length] : null, size: 0.7 + Math.random() * 0.9, fade: 'in', done: () => { kick = Math.min(1.2, kick + 0.012); spark = 1; } });
    }
    inhaleUntil = now + last + 40; beatT = 0.9; prevU = 1;
    setTimeout(() => { addWave(S / 2, S / 2, 0.9, S * 0.02, 0.8); burst = Math.max(burst, 0.55); }, last + 40);
  }
  function streamFx(body) {
    thinking = false;
    const delta = body.length - streamLen; streamLen = body.length; streamed += delta;
    if (reduced || delta <= 0) return;
    const sp = sphereBox(), now = performance.now(), lg = document.getElementById('log'), el = lg.lastElementChild;
    const rb = el ? el.getBoundingClientRect() : document.getElementById('reply').getBoundingClientRect(), pb = lg.getBoundingClientRect();
    const k = Math.min(7, 1 + Math.floor(delta / 5));
    for (let i = 0; i < k; i++) {
      const a = Math.random() * 6.283, d = Math.random() * sp.R * .55;
      const x0 = sp.x + Math.cos(a) * d + sp.R * .35, y0 = sp.y + Math.sin(a) * d;
      const x1 = rb.left + 8 + Math.random() * Math.min(rb.width - 16, 240);
      const y1 = Math.min(pb.bottom - 14, Math.max(pb.top + 10, rb.bottom - 6 - Math.random() * 16));
      fxp.push({ t0: now + i * 25, dur: 520 + Math.random() * 260, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: Math.min(y0, y1) - 60 - Math.random() * 60, ease: easeOut, rgb: rgbOf(Math.random() * 2 - 1), ch: null, size: 1.3 + Math.random() * 1.2, fade: 'out' });
    }
  }
  function endFx() {
    thinking = false;
    if (streamed > 0) { addWave(S / 2, S / 2, 0.7, S * 0.02, 0.6); const r = document.getElementById('reply'); r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }
    streamLen = 0; streamed = 0;
  }
  let fxOn = false;
  function fxFrame(now) {
    requestAnimationFrame(fxFrame);
    if (!fxp.length) { if (fxOn) { fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, fxc.width, fxc.height); fxOn = false; } return; }
    fxOn = true; fg.setTransform(fdpr, 0, 0, fdpr, 0, 0); fg.clearRect(0, 0, fw, fh);
    fg.globalCompositeOperation = 'lighter'; fg.textAlign = 'center'; fg.textBaseline = 'middle';
    for (let i = fxp.length - 1; i >= 0; i--) {
      const p = fxp[i], u = (now - p.t0) / p.dur;
      if (u < 0) continue;
      if (u >= 1) { fxp.splice(i, 1); p.done && p.done(); continue; }
      const e = p.ease(u), [x, y] = bez(p, e), [xp, yp] = bez(p, p.ease(Math.max(0, u - 0.07)));
      const al = p.fade === 'in' ? Math.min(1, u * 5) * (1 - Math.pow(u, 6)) : Math.min(1, u * 6) * (1 - Math.pow(u, 3));
      const c = p.rgb, col = `rgba(${c[0]},${c[1]},${c[2]},`;
      fg.strokeStyle = col + (al * .5) + ')'; fg.lineWidth = Math.max(.5, p.size * .7); fg.beginPath(); fg.moveTo(xp, yp); fg.lineTo(x, y); fg.stroke();
      if (p.ch) { fg.font = `500 ${Math.max(4, 11 * (1 - e * .75))}px -apple-system,Inter,sans-serif`; fg.fillStyle = `rgba(255,255,255,${al})`; fg.fillText(p.ch, x, y); }
      else { fg.fillStyle = `rgba(${Math.min(255, c[0] + 70)},${Math.min(255, c[1] + 70)},${Math.min(255, c[2] + 70)},${al})`; fg.beginPath(); fg.arc(x, y, p.size, 0, 6.283); fg.fill(); }
    }
  }
  requestAnimationFrame(fxFrame);
  function blinkLoop() {}
  function setSphere(m) { const f = MOODS_FX[m] || MOODS_FX.neutral; speedT = f[0]; extraT = f[1]; }
  function winkFx() { burst = Math.max(burst, 0.5); }
  function burstFx(v = 0.8) { burst = v; }

  /* ---------- Expressions ---------- */
  const MOODS = ['happy', 'tease', 'think', 'shy', 'surprised', 'neutral'];
  let blushTarget = 0;
  (function blushLoop() {
    const d = blushTarget - state.blush;
    if (Math.abs(d) > 0.01) { state.blush += d * 0.12; mark(); }
    requestAnimationFrame(blushLoop);
  })();
  function pulseClass(c, ms) { charEl.classList.remove(c); void charEl.offsetWidth; charEl.classList.add(c); setTimeout(() => charEl.classList.remove(c), ms); }
  function wink(ms = 520) { winkFx(); state.blinkL = true; mark(); setTimeout(() => { state.blinkL = false; mark(); }, ms); }
  let moodTimer;
  function setMood(m, holdMs) {
    m = MOODS.includes(m) ? m : 'neutral'; setSphere(m);
    clearTimeout(moodTimer);
    charEl.classList.toggle('tilt', m === 'think');
    blushTarget = m === 'shy' ? 1 : m === 'happy' ? 0.35 : 0;
    if (m === 'happy') pulseClass('hop', 600);
    if (m === 'surprised') pulseClass('shake', 500);
    if (m === 'tease') wink();
    if (holdMs) moodTimer = setTimeout(() => { charEl.classList.remove('tilt'); blushTarget = 0; setSphere('neutral'); }, holdMs);
  }
  function blinkLoop() {
    setTimeout(() => {
      state.blinkL = state.blinkR = true; mark();
      setTimeout(() => {
        state.blinkL = state.blinkR = false; mark();
        if (Math.random() < 0.25) setTimeout(() => { state.blinkL = state.blinkR = true; mark(); setTimeout(() => { state.blinkL = state.blinkR = false; mark(); }, 100); }, 150);
      }, 120);
      blinkLoop();
    }, 2200 + Math.random() * 3800);
  }
  let flapTimer = null;
  function talk(on) {
    charEl.classList.toggle('talking', on); speaking = on;
    if (on && !flapTimer) {
      flapTimer = setInterval(() => { state.mouth = !state.mouth && Math.random() > 0.15; mark(); }, 130);
    } else if (!on && flapTimer) {
      clearInterval(flapTimer); flapTimer = null; state.mouth = false; mark();
    }
  }

  let bubbleTimer;
  function say(text, ms = 4200) {
    bubble.textContent = text; bubble.classList.remove('hide');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.add('hide'), ms);
  }
  function hearts(n = 4) { addWave(S * (0.35 + Math.random() * 0.3), S * (0.35 + Math.random() * 0.3), 0.5 + n * 0.06); }

  const pokes = [
    ['happy', 'What would you like to improve today?'],
    ['think', 'What is the one thing that matters most today?'],
    ['neutral', 'Tell me your goal and I will break it into steps.'],
    ['surprised', 'Is your most important work already scheduled?'],
    ['think', 'What is slowing you down right now?'],
    ['happy', 'Small steps compound faster than you think.'],
  ];
  let pokeIdx = 0, busy = false;
  charEl.addEventListener('click', () => {
    if (busy || dragged) return;
    const [m, line] = pokes[pokeIdx++ % pokes.length];
    setMood(m, 2600); burstFx(); say(line); hearts(m === 'shy' || m === 'happy' ? 7 : 4);
  });

  /* ================= Chat ================= */
  const KEY = 'assistant-chat-v2';
  let turns = [], sample = null, ctl = null, tier = 'quick', voice = false;
  try { turns = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch { turns = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(turns.slice(-40))); } catch {} };

  const viVoice = () => ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).find(v => /^vi([-_]|$)/i.test(v.lang || ''));
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch {} }
  const DESK = !!window.assistant;
  if (DESK) {
    document.body.classList.add('desktop');
    assistant.onTts(on => talk(!!on));
  }
  function cleanForSpeech(text) { return text.replace(/```[\s\S]*?```/g, ' (đoạn code) ').replace(/[*`#>_]/g, '').slice(0, 600); }
  function speak(text) {
    if (!voice) return;
    if (DESK) { assistant.ttsSpeak(cleanForSpeech(text)); return; }
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const clean = text.replace(/```[\s\S]*?```/g, ' (đoạn code) ').replace(/[*`#>_]/g, '').slice(0, 500);
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'vi-VN'; u.pitch = 1; u.rate = 1;
      const v = viVoice();
      if (v) u.voice = v;
      u.onstart = () => talk(true);
      u.onend = u.onerror = () => talk(false);
      speechSynthesis.speak(u);
    } catch {}
  }

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  function md(src) {
    const out = [];
    src.split(/```/).forEach((part, i) => {
      if (i % 2) { out.push('<pre><code>' + esc(part.replace(/^[\w+-]*\n/, '')) + '</code></pre>'); return; }
      part.split(/\n{2,}/).forEach(block => {
        if (!block.trim()) return;
        const lines = block.split('\n');
        if (lines.every(l => /^\s*([-*•]|\d+\.)\s+/.test(l) || !l.trim()))
          out.push('<ul>' + lines.filter(l => l.trim()).map(l => '<li>' + inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, '')) + '</li>').join('') + '</ul>');
        else out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
      });
    });
    return out.join('');
  }
  function bubbleEl(role, html, extra = '') {
    const d = document.createElement('div');
    d.className = 'msg ' + (role === 'user' ? 'me' : 'zt') + extra;
    d.innerHTML = (role === 'user' ? '' : '<span class="who">Trợ lý</span>') + html;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }
  function renderAll() {
    log.innerHTML = '';
    bubbleEl('assistant', md('Xin chào, mình là **trợ lý phát triển** của bạn.\n\nMình giúp bạn đặt mục tiêu, lập kế hoạch, phản biện ý tưởng, rèn kỹ năng và tổng kết tiến độ. Hãy bắt đầu từ điều bạn muốn cải thiện nhất lúc này.'));
    turns.forEach(t => bubbleEl(t.role, t.role === 'user' ? inline(t.content).replace(/\n/g, '<br>') : md(t.content)));
  }

  const RULES = () => `Bạn là trợ lý phát triển cá nhân của người dùng: giúp họ tiến bộ về công việc, kỹ năng, tư duy và thói quen. Xưng "mình", gọi người dùng là "bạn". Giọng điềm tĩnh, chuyên nghiệp, thẳng thắn, ấm áp vừa đủ; không sến, không khen sáo rỗng.
Cách làm việc: (1) tìm mục tiêu thật đằng sau câu hỏi; (2) nêu giả định hoặc điểm mù nếu có, và phản biện khi cần; (3) đưa khuyến nghị cụ thể, có thứ tự ưu tiên, kèm bước tiếp theo làm được ngay (có tiêu chí hoàn thành hoặc thời hạn khi phù hợp); (4) thiếu thông tin quan trọng thì hỏi tối đa 1-2 câu ngắn; (5) không bịa số liệu, nguồn hay sự kiện, không chắc thì nói rõ.
Trả lời bằng tiếng Việt, trừ khi người dùng viết ngôn ngữ khác. Ngắn gọn, có cấu trúc; dùng gạch đầu dòng "- " hoặc khối code \`\`\` khi hữu ích. Mặc định trả lời ngắn gọn, dưới khoảng 120 từ, trừ khi người dùng yêu cầu chi tiết hơn.
Thời gian hiện tại của người dùng: ${new Date().toLocaleString('vi-VN')}.${voice ? '\nChế độ giọng nói đang bật: bắt buộc trả lời hoàn toàn bằng tiếng Việt, không xen từ tiếng Anh dài, vì câu trả lời sẽ được đọc thành tiếng.' : ''}
ĐỊNH DẠNG BẮT BUỘC: dòng đầu tiên chỉ chứa đúng một thẻ trạng thái trong số [neutral] [happy] [think] [surprised]. [think] khi đang phân tích hoặc cân nhắc, [happy] khi ghi nhận tiến bộ hoặc tin tốt, [surprised] khi phát hiện điều đáng chú ý hoặc rủi ro, [neutral] cho các trường hợp còn lại. Sau đó xuống dòng và viết câu trả lời.`;

  function parseReply(text) {
    const m = text.match(/^\s*\[(\w+)\]\s*/);
    if (m) return { mood: m[1].toLowerCase(), body: text.slice(m[0].length) };
    if (/^\s*\[[^\]]{0,12}$/.test(text)) return { mood: null, body: '' };
    return { mood: null, body: text };
  }
  const ERR = {
    cli_missing: 'Không tìm thấy Claude Code trên máy. Cài đặt Claude Code rồi mở lại ứng dụng (xem README), hoặc đặt claudePath trong config.json.',
    not_logged_in: 'Claude Code chưa đăng nhập. Mở Terminal, chạy "claude" và đăng nhập, rồi gửi lại.',
    cli_failed: 'Claude Code báo lỗi khi chạy. Bạn thử lại; nếu vẫn lỗi, kiểm tra README.',
    timeout: 'Claude phản hồi quá lâu nên đã dừng. Bạn thử lại nhé.',
    not_granted: 'Chưa có quyền dùng Claude trên trang này. Mở menu Quyền của artifact để bật lại.',
    sampling_disabled: 'Tài khoản này chưa dùng được Claude nên chưa thể trả lời.',
    rate_limited: 'Hệ thống đang quá tải, vui lòng thử lại sau ít phút.',
    session_expired: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi gửi tiếp.',
    refused: 'Mình không thể trả lời câu này. Bạn thử diễn đạt khác nhé.',
    empty_completion: 'Chưa nhận được phản hồi. Bạn thử hỏi ngắn gọn hơn.',
    prompt_too_large: 'Tin nhắn quá dài, bạn chia nhỏ ra giúp mình.',
  };
  function setBusy(b) {
    busy = b;
    sendBtn.innerHTML = b ? STOP_SVG : SEND_SVG; sendBtn.setAttribute('aria-label', b ? 'Dừng' : 'Gửi'); thinking = b;
    sendBtn.classList.toggle('stop', b);
    statusEl.textContent = b ? 'Đang nghĩ…' : 'Online';
  }

  async function send(text) {
    text = text.trim();
    if (text && text[0] === '/') { runSlash(text); return; }
    if (!text || busy) return;
    if (!sample) { say('Chưa kết nối được Claude Code.'); return; }
    if (DESK) assistant.ttsStop();
    turns.push({ role: 'user', content: text }); save();
    ingestFx(text);
    bubbleEl('user', inline(text).replace(/\n/g, '<br>'));
    input.value = ''; autosize();
    $('#chips').hidden = true;

    const el = bubbleEl('assistant', '<span class="typing"><i></i><i></i><i></i></span>');
    setBusy(true); setMood('think'); 
    ctl = new AbortController();
    const history = turns.slice(-8).map(t => ({ role: t.role, content: t.content }));
    while (history.length && history[0].role !== 'user') history.shift();
    let talkTimer, moodSet = false;
    try {
      const { text: full, truncated } = await sample([{ role: 'user', content: RULES() }, ...history], {
        cache: false, signal: ctl.signal, modelTier: tier,
        onText: ({ text: t }) => {
          const { mood, body } = parseReply(t);
          if (mood && !moodSet) { moodSet = true; charEl.classList.remove('tilt'); setMood(mood); }
          if (!body) return;
          streamFx(body);
          el.innerHTML = '<span class="who">Trợ lý</span>' + md(body);
          log.scrollTop = log.scrollHeight;
          bubble.classList.add('hide');
          talk(true);
          clearTimeout(talkTimer); talkTimer = setTimeout(() => talk(false), 450);
        },
      });
      const { mood, body } = parseReply(full);
      const content = body || full;
      turns.push({ role: 'assistant', content, mood }); save();
      el.innerHTML = '<span class="who">Trợ lý</span>' + md(content) + (truncated ? '<p><em>(Phản hồi bị ngắt giữa chừng, hãy hỏi tiếp phần còn lại.)</em></p>' : '');
      setMood(mood === 'neutral' || !mood ? 'happy' : mood, 5000);
      if (mood === 'happy' || Math.random() < 0.3) hearts(4);
      speak(content);
    } catch (e) {
      const keep = e && e.text ? parseReply(e.text).body : '';
      if (e && e.code === 'cancelled') {
        if (keep) { el.innerHTML = '<span class="who">Trợ lý</span>' + md(keep); turns.push({ role: 'assistant', content: keep }); save(); }
        else el.remove();
        setMood('tease', 2500); say('Đã dừng.');
      } else {
        const msg = ERR[e && e.code] || 'Mất kết nối. Bạn thử gửi lại nhé.';
        el.classList.add('err');
        el.innerHTML = '<span class="who">Trợ lý</span>' + (keep ? md(keep) : '') + '<p>' + esc(msg) + '</p>';
        setMood('surprised', 3000);
        if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) disableChat(msg);
      }
    } finally {
      clearTimeout(talkTimer); talk(false); endFx();
      charEl.classList.remove('tilt');
      setBusy(false); ctl = null;
    }
  }
  function disableChat(msg) {
    sample = null;
    note.textContent = msg; note.hidden = false;
  }

  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', e => { e.preventDefault(); if (busy) { ctl && ctl.abort(); return; } send(input.value); });
  $('#chips').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') send(e.target.textContent); });
  const tq = $('#tierQuick'), td = $('#tierDeep');
  tq.onclick = () => { tier = 'quick'; tq.setAttribute('aria-pressed', 'true'); td.setAttribute('aria-pressed', 'false'); say('Chế độ nhanh.', 1800); };
  td.onclick = () => { tier = 'default'; td.setAttribute('aria-pressed', 'true'); tq.setAttribute('aria-pressed', 'false'); setMood('think', 1800); say('Chế độ phân tích kỹ.', 1800); };
  const vb = $('#voiceBtn');
  if (!DESK && !('speechSynthesis' in window)) vb.hidden = true;
  vb.onclick = async () => {
    voice = !voice; vb.setAttribute('aria-pressed', String(voice));
    if (DESK) {
      if (!voice) { assistant.ttsStop(); return; }
      const info = await assistant.ttsInfo();
      say(info && info.voice ? 'Sẽ đọc to bằng giọng ' + info.voice + '.' : 'Máy chưa có giọng tiếng Việt. Cài tại Cài đặt hệ thống → Trợ năng → Nội dung được đọc → Giọng nói hệ thống → Quản lý giọng nói → Tiếng Việt.', info && info.voice ? 2200 : 7000);
      return;
    }
    if (!voice) { try { speechSynthesis.cancel(); } catch {} } else { const hv = 'speechSynthesis' in window && speechSynthesis.getVoices().length; say(hv && !viVoice() ? 'Thiết bị chưa có giọng tiếng Việt. Hãy cài giọng Vietnamese trong cài đặt hệ thống.' : 'Sẽ đọc to câu trả lời bằng tiếng Việt.', hv && !viVoice() ? 5000 : 2000); } };
  $('#clearBtn').onclick = () => { if (busy) return; if (DESK) assistant.ttsStop(); turns = []; save(); renderAll(); $('#chips').hidden = false; setMood('happy', 2000); say('Bắt đầu lại nhé.'); };

  /* ---------- Command palette ---------- */
  const palEl = $('#palette'), dockEl = $('#dock');
  let palItems = [], palSel = 0;
  function palRender() {
    palEl.innerHTML = palItems.map((c, i) => `<button type="button" role="option" data-k="${c.key}" aria-selected="${i === palSel}"><b>${c.label}</b><span>${c.desc}</span></button>`).join('');
  }
  function palClose() { palEl.classList.remove('open'); palItems = []; }
  function palUpdate() {
    const v = input.value;
    if (v[0] === '/' && !/\s/.test(v)) { palItems = matchCmds(v.slice(1)); if (palSel >= palItems.length) palSel = 0; if (palItems.length) { palRender(); palEl.classList.add('open'); return; } }
    palClose();
  }
  input.addEventListener('input', palUpdate);
  input.addEventListener('blur', () => setTimeout(palClose, 150));
  input.addEventListener('keydown', e => {
    if (!palEl.classList.contains('open') || e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel + (e.key === 'ArrowDown' ? 1 : palItems.length - 1)) % palItems.length; palRender(); }
    else if (e.key === 'Tab') { e.preventDefault(); input.value = '/' + palItems[palSel].key; palUpdate(); }
    else if (e.key === 'Escape') { palClose(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); input.value = '/' + palItems[palSel].key; form.requestSubmit(); }
  }, true);
  palEl.addEventListener('mousedown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); input.value = '/' + b.dataset.k; form.requestSubmit(); });
  function runSlash(text) {
    const name = text.slice(1).trim().split(/\s+/)[0] || '';
    const c = findCmd(name);
    input.value = ''; autosize(); palClose();
    $('#chips').hidden = true;
    bubbleEl('user', esc(text));
    if (!c) { bubbleEl('assistant', md('Không có lệnh `' + esc(text.split(/\s+/)[0]) + '`. Gõ `/` để xem danh sách hiệu ứng.')); return; }
    c.run(); setMood('neutral'); bubbleEl('assistant', esc(c.msg));
    document.getElementById('hint')?.classList.add('off');
  }

  const tokEl = $('#tok');
  window.addEventListener('assistant-usage', ev => {
    const u = ev.detail || {};
    if (!tokEl) return;
    tokEl.textContent = 'Lượt này: ' + (u.input || 0).toLocaleString('vi-VN') + ' token vào · ' + (u.output || 0).toLocaleString('vi-VN') + ' token ra' + (u.cost ? ' · ~$' + u.cost.toFixed(4) : '');
    tokEl.hidden = false;
  });
  renderAll();
  autosize();
  if (turns.length) $('#chips').hidden = true;
  setTimeout(() => bubble.classList.add('hide'), 5000);

  const offline = 'Không kết nối được Claude. Bạn vẫn có thể tương tác với quả cầu.';
  if (window.claude && claude.use) claude.use('sample').then(s => { sample = s; if (!s) disableChat(offline); });
  else disableChat(offline);
})();