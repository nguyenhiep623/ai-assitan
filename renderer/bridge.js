/* Giả lập window.claude.use('sample') bằng Claude Code CLI (qua IPC) để app.js dùng nguyên logic cũ. */
(() => {
  'use strict';
  if (!window.assistant) return;
  const pending = new Map();
  let seq = 0;

  assistant.onChat(msg => {
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'text') { p.last = msg.text; p.onText && p.onText({ text: msg.text, delta: '' }); return; }
    pending.delete(msg.id);
    if (p.signal && p.onAbort) p.signal.removeEventListener('abort', p.onAbort);
    if (msg.usage) window.dispatchEvent(new CustomEvent('assistant-usage', { detail: msg.usage }));
    if (msg.type === 'done') p.resolve({ text: msg.text, truncated: false });
    else p.reject({ code: msg.type === 'cancelled' ? 'cancelled' : msg.code || 'cli_failed', message: msg.message || '', text: msg.text || p.last || '' });
  });

  const label = { user: 'Người dùng', assistant: 'Trợ lý' };
  function buildPayload(input, opts) {
    const msgs = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
    const system = msgs[0] && msgs[0].role === 'user' && msgs.length > 1 ? msgs[0].content : '';
    const rest = system ? msgs.slice(1) : msgs;
    const last = rest[rest.length - 1];
    const hist = rest.slice(0, -1);
    let prompt = '';
    if (hist.length) prompt += 'Lịch sử gần đây:\n' + hist.map(m => label[m.role] + ': ' + m.content).join('\n') + '\n\n';
    prompt += (hist.length ? 'Tin nhắn mới của người dùng:\n' : '') + (last ? last.content : '');
    return { system, prompt, tier: (opts && opts.modelTier) || 'quick' };
  }

  async function sample(input, opts = {}) {
    const id = 'r' + Date.now() + '-' + (++seq);
    return new Promise((resolve, reject) => {
      const p = { resolve, reject, onText: opts.onText, signal: opts.signal, last: '' };
      pending.set(id, p);
      if (opts.signal) {
        if (opts.signal.aborted) { pending.delete(id); reject({ code: 'cancelled', text: '' }); return; }
        p.onAbort = () => assistant.chatAbort(id);
        opts.signal.addEventListener('abort', p.onAbort, { once: true });
      }
      assistant.chatStart({ id, ...buildPayload(input, opts) }).catch(err => {
        pending.delete(id);
        reject({ code: 'cli_failed', message: String(err && err.message || err), text: '' });
      });
    });
  }

  window.claude = { use: async name => (name === 'sample' ? sample : null) };
})();
