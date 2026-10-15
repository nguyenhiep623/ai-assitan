'use strict';
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TIMEOUT_MS = 120000;
const DEFAULT_MODELS = { quick: 'haiku', default: 'sonnet', complex: 'opus' };
const jobs = new Map();      // id -> child process
let claudeBin = null;
let sayProc = null;

/* ---------- config (userData/config.json) ---------- */
function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'config.json'), 'utf8')) || {}; }
  catch { return {}; }
}

/* ---------- tìm binary `claude` (app GUI trên macOS có PATH rất tối giản) ---------- */
function isExec(p) { try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile(); } catch { return false; } }
function nvmCandidates() {
  const base = path.join(os.homedir(), '.nvm', 'versions', 'node');
  try { return fs.readdirSync(base).sort().reverse().map(v => path.join(base, v, 'bin', 'claude')); } catch { return []; }
}
function shellLookup() {
  return new Promise(resolve => {
    execFile('/bin/zsh', ['-ilc', 'command -v claude'], { timeout: 8000 }, (err, out) => {
      const p = String(out || '').trim().split('\n').pop();
      resolve(!err && p && isExec(p) ? p : null);
    });
  });
}
async function resolveClaude() {
  const cfg = readConfig();
  if (cfg.claudePath && isExec(cfg.claudePath)) return (claudeBin = cfg.claudePath);
  if (claudeBin && isExec(claudeBin)) return claudeBin;
  const home = os.homedir();
  const list = [
    path.join(home, '.local/bin/claude'), path.join(home, '.claude/local/claude'),
    '/opt/homebrew/bin/claude', '/usr/local/bin/claude', ...nvmCandidates(),
  ];
  claudeBin = list.find(isExec) || (await shellLookup());
  return claudeBin;
}
function childEnv(bin) {
  const home = os.homedir();
  const extra = [path.dirname(bin), '/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local/bin'), '/usr/bin', '/bin'];
  return { ...process.env, PATH: [...extra, process.env.PATH || ''].join(':'), NO_COLOR: '1' };
}

/* ---------- chat qua Claude Code CLI ---------- */
function classify(text) {
  const t = (text || '').toLowerCase();
  if (/not logged in|please run \/login|invalid api key|authentication|oauth|unauthorized|\/login/.test(t)) return 'not_logged_in';
  if (/rate limit|usage limit|quota|overloaded|429/.test(t)) return 'rate_limited';
  return 'cli_failed';
}

ipcMain.handle('chat:start', async (event, { id, system, prompt, tier }) => {
  const send = msg => { try { if (!event.sender.isDestroyed()) event.sender.send('chat:event', { id, ...msg }); } catch {} };
  const bin = await resolveClaude();
  if (!bin) { send({ type: 'error', code: 'cli_missing' }); return; }

  const cfg = readConfig();
  const model = { ...DEFAULT_MODELS, ...(cfg.models || {}) }[tier] || DEFAULT_MODELS.quick;
  const cwd = path.join(app.getPath('userData'), 'sandbox');
  fs.mkdirSync(cwd, { recursive: true });

  const args = [
    '-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--model', model,
    '--tools', '',
    '--no-session-persistence',
    '--setting-sources', '',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--disable-slash-commands',
  ];
  if (system) args.push('--system-prompt', system);

  let acc = '', buf = '', stderr = '', usage = null, resultText = '', isError = false, finished = false, timedOut = false, cancelled = false;
  const child = spawn(bin, args, { cwd, env: childEnv(bin), stdio: ['pipe', 'pipe', 'pipe'] });
  jobs.set(id, { child, cancel: () => { cancelled = true; child.kill('SIGTERM'); } });
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, TIMEOUT_MS);

  const finish = msg => { if (finished) return; finished = true; clearTimeout(timer); jobs.delete(id); send(msg); };

  child.on('error', err => finish({ type: 'error', code: err.code === 'ENOENT' ? 'cli_missing' : 'cli_failed', message: String(err.message) }));
  child.stdin.on('error', () => {});
  child.stdin.end(prompt || '');
  child.stderr.on('data', d => { stderr += d; if (stderr.length > 8000) stderr = stderr.slice(-8000); });

  function handleLine(line) {
    if (!line.trim()) return;
    let ev; try { ev = JSON.parse(line); } catch { return; }
    if (ev.type === 'stream_event' && ev.event && ev.event.type === 'content_block_delta') {
      const d = ev.event.delta;
      if (d && d.type === 'text_delta' && d.text) { acc += d.text; send({ type: 'text', text: acc }); }
    } else if (ev.type === 'result') {
      isError = !!ev.is_error;
      resultText = typeof ev.result === 'string' ? ev.result : '';
      const u = ev.usage || {};
      usage = {
        input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
        output: u.output_tokens || 0,
        cost: ev.total_cost_usd || 0,
      };
    }
  }
  child.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
  });

  child.on('close', code => {
    handleLine(buf);
    if (cancelled) return finish({ type: 'cancelled', text: acc, usage });
    if (timedOut) return finish({ type: 'error', code: 'timeout', text: acc, usage });
    const text = acc || (isError ? '' : resultText);
    if (code === 0 && !isError && text.trim()) return finish({ type: 'done', text, usage });
    const detail = (isError ? resultText : '') + '\n' + stderr;
    finish({ type: 'error', code: classify(detail), message: detail.trim().slice(0, 400), text: acc, usage });
  });
});

ipcMain.handle('chat:abort', (_e, id) => { const j = jobs.get(id); if (j) j.cancel(); });

/* ---------- giọng nói hệ thống macOS: `say` ---------- */
function listVoices() {
  return new Promise(resolve => {
    execFile('say', ['-v', '?'], { timeout: 5000 }, (err, out) => {
      if (err) return resolve([]);
      resolve(String(out).split('\n').map(l => {
        const m = l.match(/^(.+?)\s+([a-z]{2,3}[_-][A-Za-z]{2,4})\s+#/);
        return m ? { name: m[1].trim(), lang: m[2] } : null;
      }).filter(Boolean));
    });
  });
}
async function pickVoice() {
  const cfg = readConfig();
  if (cfg.voice) return cfg.voice;
  const vi = (await listVoices()).filter(v => /^vi[_-]/i.test(v.lang));
  const pref = vi.find(v => /linh/i.test(v.name)) || vi[0];
  return pref ? pref.name : null;
}
function stopSay() { if (sayProc) { try { sayProc.kill('SIGTERM'); } catch {} sayProc = null; } }

ipcMain.handle('tts:info', async () => ({ voice: await pickVoice() }));
ipcMain.handle('tts:stop', () => { stopSay(); });
ipcMain.handle('tts:speak', async (event, text) => {
  stopSay();
  if (!text.trim()) return false;
  const voice = await pickVoice();
  if (!voice) return false;
  const notify = on => { try { if (!event.sender.isDestroyed()) event.sender.send('tts:state', on); } catch {} };
  const p = spawn('say', ['-v', voice, '-f', '-'], { stdio: ['pipe', 'ignore', 'ignore'] });
  sayProc = p;
  p.stdin.on('error', () => {});
  p.stdin.end(text);
  notify(true);
  p.on('close', () => { if (sayProc === p) sayProc = null; notify(false); });
  p.on('error', () => notify(false));
  return true;
});

/* ---------- cửa sổ ---------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
}

app.setName('Trợ lý phát triển');
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { stopSay(); jobs.forEach(j => j.cancel()); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { stopSay(); jobs.forEach(j => j.cancel()); });
