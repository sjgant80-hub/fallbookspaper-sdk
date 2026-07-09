// fallbookspaper SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallbookspaper/index.html · 102090 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "fallbookspaper" }); }
    else go();
  })();
'use strict';
// ════════════════════════════════════════════════════════════════
// FallBooksPaper v1.0.0 · sovereign accountancy document generator
// prime 797 · MIT · 14 templates · bundle: fallbooks
// Client data never leaves the device.
// ════════════════════════════════════════════════════════════════
const TOOLNAME='fallbookspaper';
const VERSION='1.0.0';
const PRIME=797;
const STORE='fallbookspaper-v1';
const SCHEMA_VERSION='1.0';
const TABS=[
 {id:'dashboard', name:'Dashboard', ico:'◐'},
 {id:'generate', name:'Generate', ico:'△'},
 {id:'library', name:'Library', ico:'▦'},
 {id:'templates', name:'Templates', ico:'✆'},
 {id:'firm', name:'Firm', ico:'⌂'},
 {id:'audit', name:'Audit', ico:'◯'},
 {id:'help', name:'Q & A', ico:'?'},
];
let state={
 active:'dashboard',
 brandName:'FallBooksPaper',
 firm:null,
 advisers:[],
 clients:[],
 documents:[],
 templates:[],
 audit:[],
 ui:{
 selectedClientId:null,
 selectedTemplateId:'engagement-letter',
 selectedDocumentId:null,
 activeAdviserId:null,
 libFilterClient:'',
 libFilterTpl:'',
 libFilterStatus:'',
 fallbooksCompute:null,
 sectionOverrides:{},
 extraContext:{},
 chat:[],
 },
 settings:{anthropicKey:'',auditChain:true,autoBroadcast:true},
};
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const uid=(p='id')=>p+'_'+Math.random().toString(36).slice(2,11);
const now=()=>Date.now();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>(+n||0).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0});
const fmt2=n=>(+n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=n=>'£'+fmt(n);
const dateStr=ts=>{if(!ts)return '—';const d=new Date(ts);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};
const dateTime=ts=>{if(!ts)return '—';const d=new Date(ts);return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})};
const isoDate=ts=>{if(!ts)return '';const d=new Date(ts);return d.toISOString().slice(0,10)};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),1900)}
async function sha256(s){const buf=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
// IDB · stores per shared schema: firms, advisers, clients, documents, templates, audit, state
let db;
function openDB(){
 return new Promise((res,rej)=>{
 const r=indexedDB.open(STORE,1);
 r.onupgradeneeded=e=>{
 const d=e.target.result;
 ['firms','advisers','clients','documents','templates','audit','state'].forEach(s=>{
 if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:s==='state'?undefined:'id'});
 });
 };
 r.onsuccess=e=>{db=e.target.result;res(db)};
 r.onerror=rej;
 });
}
function idbGetAll(store){return new Promise(res=>{const tx=db.transaction(store,'readonly');const q=tx.objectStore(store).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
function idbGet(store,key){return new Promise(res=>{const tx=db.transaction(store,'readonly');const q=tx.objectStore(store).get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}
function idbPut(store,val,key){return new Promise(res=>{const tx=db.transaction(store,'readwrite');const o=tx.objectStore(store);const q=key!=null?o.put(val,key):o.put(val);q.onsuccess=()=>res(true);q.onerror=()=>res(false)})}
function idbDel(store,key){return new Promise(res=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res(true)})}
async function loadAll(){
 if(!db)await openDB();
 const [firms,advisers,clients,documents,templates,audit,uiState]=await Promise.all([
 idbGetAll('firms'),idbGetAll('advisers'),idbGetAll('clients'),
 idbGetAll('documents'),idbGetAll('templates'),idbGetAll('audit'),
 idbGet('state','ui'),
 ]);
 state.firm=firms[0]||null;
 state.advisers=advisers;
 state.clients=clients;
 state.documents=documents;
 state.audit=audit.sort((a,b)=>a.i-b.i);
 state.templates=mergeTemplates(templates);
 if(uiState){
 state.ui=Object.assign({},state.ui,uiState.value||{});
 state.brandName=uiState.brand||'FallBooksPaper';
 state.settings=Object.assign({},state.settings,uiState.settings||{});
 }
}
async function persistUI(){if(!db)await openDB();await idbPut('state',{value:state.ui,brand:state.brandName,settings:state.settings},'ui')}
// AUDIT chain · P3 · 7yr retention (HMRC 6 + ICAEW 7)
async function audit(action,opts={}){
 if(!state.settings.auditChain)return;
 if(!db)await openDB();
 const prev=state.audit.length?state.audit[state.audit.length-1]:null;
 const prevHash=prev?prev.docHash:'';
 const i=(prev?prev.i:0)+1;
 const payload=opts.payload||{};
 const entry={id:uid('au'),i,ts:now(),tool:TOOLNAME,adviserId:opts.adviserId||state.ui.activeAdviserId||'',clientId:opts.clientId||'',action,reasoning:opts.reasoning||'',configVersion:TOOLNAME+'@'+VERSION,prevHash,docHash:'',payload};
 entry.docHash=await sha256(JSON.stringify({i,ts:entry.ts,action,clientId:entry.clientId,prevHash,payload}));
 state.audit.push(entry);
 await idbPut('audit',entry);
}
// BUNDLE MESH · fall-books (anchor channel) + fall-signal
let bcBooks,bcSignal;
let bcDebounce={};
function broadcast(channel,type,payload){if(!state.settings.autoBroadcast||!channel)return;try{channel.postMessage({v:1,type,ts:now(),source:TOOLNAME,payload})}catch(e){}}
function debouncedBroadcast(key,channel,type,payload){clearTimeout(bcDebounce[key]);bcDebounce[key]=setTimeout(()=>broadcast(channel,type,payload),300)}
async function initMesh(){
 try{
 bcSignal=new BroadcastChannel('fall-signal');
 bcSignal.postMessage({source:TOOLNAME,type:'hello',prime:PRIME,version:VERSION,ts:now()});
 bcSignal.addEventListener('message',e=>{const m=e.data;if(!m)return;if(m.type==='ping')bcSignal.postMessage({source:TOOLNAME,type:'pong',prime:PRIME})});
 }catch(e){}
 try{
 bcBooks=new BroadcastChannel('fall-books');
 bcBooks.addEventListener('message',handleBooksMessage);
 bcBooks.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME,payload:{wants:['clients','advisers','firm']}});
 }catch(e){}
}
async function handleBooksMessage(e){
 const m=e.data;if(!m||m.source===TOOLNAME)return;
 let dirty=false;
 if(m.type==='client.created'||m.type==='client.updated'){
 const c=m.payload;if(c&&c.id){
 const idx=state.clients.findIndex(x=>x.id===c.id);
 const existing=idx>=0?state.clients[idx]:null;
 if(!existing||(c.updatedAt||0)>=(existing.updatedAt||0)){
 if(idx>=0)state.clients[idx]=c;else state.clients.push(c);
 await idbPut('clients',c);dirty=true;
 }
 }
 }else if(m.type==='client.archived'){
 const c=m.payload;if(c&&c.id){const idx=state.clients.findIndex(x=>x.id===c.id);if(idx>=0){state.clients[idx]=c;await idbPut('clients',c);dirty=true}}
 }else if(m.type==='adviser.created'||m.type==='adviser.updated'){
 const a=m.payload;if(a&&a.id){const idx=state.advisers.findIndex(x=>x.id===a.id);if(idx>=0)state.advisers[idx]=a;else state.advisers.push(a);await idbPut('advisers',a);dirty=true}
 }else if(m.type==='firm.updated'){
 const f=m.payload;if(f){state.firm=f;await idbPut('firms',f);dirty=true}
 }else if(m.type==='sync.request'){
 bcBooks.postMessage({v:1,type:'sync.snapshot',ts:now(),source:TOOLNAME,payload:{clients:state.clients,advisers:state.advisers,firm:state.firm}});
 }else if(m.type==='sync.snapshot'){
 const p=m.payload||{};
 if(Array.isArray(p.clients))for(const c of p.clients){const idx=state.clients.findIndex(x=>x.id===c.id);const ex=idx>=0?state.clients[idx]:null;if(!ex||(c.updatedAt||0)>=(ex.updatedAt||0)){if(idx>=0)state.clients[idx]=c;else state.clients.push(c);await idbPut('clients',c);dirty=true}}
 if(Array.isArray(p.advisers))for(const a of p.advisers){const idx=state.advisers.findIndex(x=>x.id===a.id);const ex=idx>=0?state.advisers[idx]:null;if(!ex||(a.updatedAt||0)>=(ex.updatedAt||0)){if(idx>=0)state.advisers[idx]=a;else state.advisers.push(a);await idbPut('advisers',a);dirty=true}}
 if(p.firm&&(!state.firm||(p.firm.updatedAt||0)>(state.firm.updatedAt||0))){state.firm=p.firm;await idbPut('firms',p.firm);dirty=true}
 }else if(m.type==='fallbooks.compute.response'){
 // FallBooks anchor returns computation payload for SA/CT/VAT
 state.ui.fallbooksCompute=m.payload||null;
 toast('compute response · fallbooks');
 render();
 }else if(m.type==='deadline.created'||m.type==='deadline.updated'){
 // informational — refresh if client matches
 if(m.payload&&m.payload.clientId)dirty=true;
 }
 if(dirty)render();
}
function requestFallbooksCompute(clientId,kind,year){
 if(!bcBooks){toast('mesh not ready');return}
 bcBooks.postMessage({v:1,type:'fallbooks.compute.request',ts:now(),source:TOOLNAME,payload:{clientId,kind,year}});
 toast('compute request → fallbooks');
}
async function emitClientUpdate(client){if(!bcBooks)return;debouncedBroadcast('client-'+client.id,bcBooks,'client.updated',client)}
async function emitFirmUpdate(){if(!bcBooks||!state.firm)return;debouncedBroadcast('firm',bcBooks,'firm.updated',state.firm)}
async function emitAdviserUpdate(a){if(!bcBooks)return;debouncedBroadcast('adv-'+a.id,bcBooks,'adviser.updated',a)}
async function emitDocCreated(doc){if(!bcBooks)return;broadcast(bcBooks,'document.created',doc);broadcast(bcBooks,'engagement.signed',doc)}
// ════════════════════════════════════════════════════════════════
// TEMPLATE CATALOGUE · 14 templates · UK accountancy
// ════════════════════════════════════════════════════════════════
const TEMPLATES_BUILTIN=[];
TEMPLATES_BUILTIN.push({
 id:'engagement-letter', name:'Engagement Letter', version:'1.0',
 cobs:'ICAEW / ACCA model', kind:'agreement',
 description:'Initial client agreement — ICAEW/ACCA model engagement letter for UK accountancy practice.',
 sections:[
{id:'header', heading:'Engagement Letter',
 body:'**{{firm.name}}**\nProfessional body: {{firm.professionalBody}} · Practising cert: {{firm.practiceCertNo}}\nAML supervisor: {{firm.amlSupervisor}} (ref {{firm.amlSupervisorRef}})\nRegistered: {{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}\n\nFor the attention of: **{{client.displayName}}**\n{{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}\n\nDate: {{today}}',
 requiredFields:['firm.name','firm.amlSupervisor','client.displayName']},
{id:'intro', heading:'1. Introduction',
 body:'This letter sets out the basis on which **{{firm.name}}** ("we", "us", "our") will provide professional services to **{{client.displayName}}** ("you", "your"). It supersedes any previous engagement letter and should be read together with our standard terms of business.\n\nWe are a {{firm.practiceType}} regulated by **{{firm.professionalBody}}**. Our practising certificate number is {{firm.practiceCertNo}}. We are supervised for anti-money-laundering purposes by **{{firm.amlSupervisor}}** (reference {{firm.amlSupervisorRef}}).'},
{id:'services', heading:'2. Services we will provide',
 body:'We will provide the following services in respect of the accounting period beginning **{{client.accountingPeriodStart}}** and ending **{{client.accountingPeriodEnd}}**:\n\n{{ctx.servicesList}}\n\nAny additional services not listed above will be the subject of a separate engagement or fee note. Where any of these services require disclosure to or filing with HMRC, Companies House or any other authority, the responsibility for that filing remains as set out in section 4.'},
{id:'your-responsibilities', heading:'3. Your responsibilities',
 body:'You are responsible for:\n\n- Providing complete and accurate information, books, records and explanations on a timely basis.\n- Maintaining adequate accounting records under the Companies Act 2006 / ITTOIA 2005 as applicable.\n- Approving the accounts, tax returns and other deliverables before submission.\n- Notifying us promptly of any changes to your circumstances, beneficial ownership or business activities.\n- Compliance with all statutory deadlines, even where we are engaged to prepare the relevant filings.'},
{id:'our-responsibilities', heading:'4. Our responsibilities',
 body:'We will:\n\n- Carry out the engaged services with reasonable care and skill in accordance with the standards of {{firm.professionalBody}}.\n- Maintain professional indemnity insurance in accordance with our professional body’s minimum requirements.\n- Treat all information received from you as confidential, subject only to our legal and regulatory obligations (including, where applicable, mandatory reports under the Proceeds of Crime Act 2002 / Money Laundering Regulations 2017).\n- Use HMRC-recognised software where required (MTD for VAT, MTD for ITSA when applicable).'},
{id:'fees', heading:'5. Fees',
 body:'Our fees for the services described above are charged on a **{{engagement.feeBasis}}** basis at **£{{engagement.feeAmount}}** per {{engagement.feeFrequency}}, payable {{ctx.paymentTerms}}.\n\nFees are exclusive of VAT, disbursements and any third-party fees (Companies House filings, statutory company books, search fees, etc.) which will be passed through at cost.\n\nWhere we are required to undertake substantial additional work (for example, an HMRC enquiry, late provision of records, restructuring) we will discuss and agree the additional fee with you in advance wherever possible.\n\n**Next fee review:** {{engagement.nextReviewDue}}'},
{id:'aml-disclosure', heading:'6. Anti-money-laundering disclosure', locked:true,
 body:'As {{firm.amlSupervisor}}-supervised professionals we are required by the **Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017** (as amended) to:\n\n- Verify your identity and that of all beneficial owners (CDD) before commencing work.\n- Conduct ongoing monitoring of the business relationship.\n- Submit a Suspicious Activity Report (SAR) to the National Crime Agency where we know or suspect (or have reasonable grounds to suspect) money laundering or terrorist financing.\n\nWe are prohibited by section 333A POCA 2002 from informing you (or any third party) that a SAR has been or may be made — this is known as the "tipping-off" offence. This obligation overrides our duty of confidentiality.'},
{id:'liability', heading:'7. Limitation of liability', locked:true,
 body:'Our aggregate liability to you under or in connection with this engagement (whether in contract, tort, breach of statutory duty or otherwise) is limited to **£{{ctx.liabilityCap}}**, which represents not less than the minimum required by {{firm.professionalBody}}.\n\nWe accept no liability for any loss or damage arising from:\n\n- Information provided by you which is incomplete, inaccurate or misleading.\n- Your failure to act on advice given.\n- Loss of profit, revenue, goodwill or anticipated savings, or any indirect or consequential loss.\n\nNothing in this clause excludes liability for death or personal injury caused by our negligence, for fraud, or for any matter for which liability cannot lawfully be excluded.'},
{id:'complaints', heading:'8. Complaints', locked:true,
 body:'If you are dissatisfied with any aspect of our service please contact our Principal in the first instance. Complaints will be investigated promptly and a substantive response provided within 28 days.\n\nIf you remain dissatisfied you may refer the matter to:\n\n- **{{firm.professionalBody}}** professional standards / conduct department (www.{{ctx.bodyDomain}}).\n- Where eligible, the **{{ctx.complaintsScheme}}**.'},
{id:'data', heading:'9. Data protection & retention',
 body:'We process your personal data as a **Data Controller** under the UK GDPR and the Data Protection Act 2018, for the purposes of providing the agreed services and complying with our legal and regulatory obligations.\n\nWe retain client records for a minimum of **seven years** from the end of the engagement, in line with {{firm.professionalBody}} requirements and the six-year HMRC enquiry window plus one year for safety margin. Records may be retained longer where required by litigation, regulatory enquiry or money-laundering rules.'},
{id:'termination', heading:'10. Termination',
 body:'Either party may terminate this engagement by giving 30 days written notice. We may suspend services without notice for non-payment of fees or where continuing would put us in breach of our regulatory obligations.\n\nOn termination we will provide you with copies of your records and any work-in-progress on payment of outstanding fees. We may exercise a lien over papers in our possession in respect of unpaid fees.'},
{id:'governing', heading:'11. Governing law',
 body:'This engagement is governed by the laws of **England and Wales** (or the law of {{ctx.jurisdiction}} where applicable). Any dispute is subject to the exclusive jurisdiction of those courts.'},
{id:'accept', heading:'12. Acceptance',
 body:'Please sign and return one copy of this letter to confirm your acceptance of these terms. The engagement will commence on the later of the date of this letter and the date of your countersignature.\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'accounts-cover', name:'Annual Accounts Cover Letter', version:'1.0',
 cobs:'covering letter', kind:'cover',
 description:'Cover letter accompanying annual financial statements for client approval.',
 sections:[
{id:'header', heading:'Annual Accounts · {{client.entityName}}',
 body:'**Period:** {{client.accountingPeriodStart}} to {{client.accountingPeriodEnd}}\n**Prepared by:** {{firm.name}}\n**Date:** {{today}}\n**Adviser:** {{adviser.name}}'},
{id:'enclose', heading:'1. Enclosed',
 body:'Please find enclosed for your approval:\n\n- Draft statutory accounts for the year ended {{client.accountingPeriodEnd}}\n- Director’s report (where applicable)\n- Notes to the accounts\n- Tax computation supporting the corporation tax return (where applicable)\n- Proposed Companies House filing version (abridged / micro / full)'},
{id:'basis', heading:'2. Basis of preparation',
 body:'The accounts have been prepared in accordance with **{{ctx.frsStandard}}** (FRS 102 / FRS 105 micro) and the Companies Act 2006, on the basis of the books, records and explanations provided by you. They have not been audited.\n\nResponsibility for the accuracy of the underlying records and the disclosure of all material information rests with the directors / proprietors.'},
{id:'review', heading:'3. Action required',
 body:'1. Please review the accounts carefully, paying particular attention to the {{ctx.coverHighlights}}.\n2. Sign the directors’ approval page and return one copy to us.\n3. We will then submit the accounts to **Companies House** (deadline: {{ctx.chDeadline}}) and the corporation tax return to **HMRC** (deadline: {{ctx.ctDeadline}}).\n4. Corporation tax of **£{{ctx.ctLiability}}** is due for payment by **{{ctx.ctPayDeadline}}** (9 months and 1 day after the period end).'},
{id:'comments', heading:'4. Comments on the year',
 body:'{{ctx.coverComments}}'},
{id:'sign', heading:'5. Approval',
 body:'I/We confirm that the accounts give a true and fair view of the financial position of the company and that I/we approve them for filing.\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'sa100', name:'SA100 Self Assessment Summary', version:'1.0',
 cobs:'HMRC SA100', kind:'tax-computation',
 description:'Individual self-assessment tax computation summary — income, allowances, tax, payments, balance.',
 sections:[
{id:'header', heading:'Self Assessment Computation · {{ctx.taxYear}}',
 body:'**Client:** {{client.displayName}}\n**NINO:** {{client.nino}}\n**UTR:** {{client.utr}}\n**Tax year:** {{ctx.taxYear}} (6 April {{ctx.taxYearFromYear}} to 5 April {{ctx.taxYearToYear}})\n**Prepared by:** {{adviser.name}}, {{firm.name}}\n**Filing deadline:** 31 January {{ctx.saFilingYear}}'},
{id:'income', heading:'1. Income',
 body:'| Source | Amount (£) |\n|---|---:|\n| Employment income (P60) | {{ctx.saEmploymentIncome}} |\n| Benefits in kind (P11D) | {{ctx.saBik}} |\n| Self-employment profit | {{ctx.saSelfEmploymentProfit}} |\n| Partnership share | {{ctx.saPartnershipProfit}} |\n| UK property income | {{ctx.saPropertyIncome}} |\n| Bank/building society interest | {{ctx.saInterest}} |\n| UK dividends | {{ctx.saDividends}} |\n| Pension income | {{ctx.saPensionIncome}} |\n| Other income | {{ctx.saOtherIncome}} |\n| **Total income** | **{{ctx.saTotalIncome}}** |'},
{id:'allowances', heading:'2. Allowances',
 body:'| Allowance | Amount (£) |\n|---|---:|\n| Personal allowance | {{ctx.saPersonalAllowance}} |\n| Personal savings allowance | {{ctx.saPsa}} |\n| Dividend allowance | {{ctx.saDividendAllowance}} |\n| Marriage allowance transfer | {{ctx.saMarriageAllowance}} |\n| **Total reliefs** | **{{ctx.saReliefs}}** |\n\n**Taxable income:** £{{ctx.saTaxableIncome}}'},
{id:'tax', heading:'3. Income tax',
 body:'| Band | Rate | Amount taxed (£) | Tax (£) |\n|---|---:|---:|---:|\n| Basic rate (£0 – £37,700) | 20% | {{ctx.saBasicAmount}} | {{ctx.saBasicTax}} |\n| Higher rate (£37,701 – £125,140) | 40% | {{ctx.saHigherAmount}} | {{ctx.saHigherTax}} |\n| Additional rate (over £125,140) | 45% | {{ctx.saAdditionalAmount}} | {{ctx.saAdditionalTax}} |\n| Dividend ordinary | 8.75% | {{ctx.saDivOrdAmount}} | {{ctx.saDivOrdTax}} |\n| Dividend upper | 33.75% | {{ctx.saDivUpperAmount}} | {{ctx.saDivUpperTax}} |\n| Dividend additional | 39.35% | {{ctx.saDivAddAmount}} | {{ctx.saDivAddTax}} |\n| **Total income tax** | | | **{{ctx.saTotalIncomeTax}}** |\n\nClass 2 NIC: £{{ctx.saClass2}} · Class 4 NIC: £{{ctx.saClass4}}\n\n**Total tax & NIC liability:** £{{ctx.saTotalLiability}}'},
{id:'payments', heading:'4. Payments & balance',
 body:'| Item | Amount (£) |\n|---|---:|\n| PAYE tax already deducted | {{ctx.saPayeDeducted}} |\n| Payments on account already made | {{ctx.saPoaMade}} |\n| **Balance due / (refund)** | **{{ctx.saBalanceDue}}** |\n\n**Payments on account for {{ctx.saNextYear}}:**\n- First payment on account (50% of liability): £{{ctx.saPoa1}} due 31 January {{ctx.saFilingYear}}\n- Second payment on account (50% of liability): £{{ctx.saPoa2}} due 31 July {{ctx.saFilingYear}}'},
{id:'notes', heading:'5. Notes & assumptions', locked:true,
 body:'This computation is prepared on the information you have provided and is **not yet submitted to HMRC**. You remain responsible for the accuracy and completeness of the underlying figures and for the submission of the SA100 return. Please review carefully, sign the approval, and return to enable us to file before the **31 January** deadline. Late filing attracts an automatic £100 penalty plus daily and tax-geared penalties thereafter.'}
]});
TEMPLATES_BUILTIN.push({
 id:'ct600', name:'CT600 Corporation Tax Summary', version:'1.0',
 cobs:'HMRC CT600', kind:'tax-computation',
 description:'Corporation tax computation for limited companies — trading profit, adjustments, marginal relief, liability.',
 sections:[
{id:'header', heading:'Corporation Tax Computation',
 body:'**Company:** {{client.entityName}}\n**Companies House no:** {{client.companiesHouseNo}}\n**CT UTR:** {{client.ctUtr}}\n**Accounting period:** {{client.accountingPeriodStart}} to {{client.accountingPeriodEnd}}\n**Prepared by:** {{adviser.name}}, {{firm.name}}\n**Filing deadline (CT600):** 12 months after period end · **{{ctx.ctFilingDeadline}}**\n**Payment deadline:** 9 months and 1 day after period end · **{{ctx.ctPayDeadline}}**'},
{id:'profit', heading:'1. Trading profit per accounts',
 body:'| Item | Amount (£) |\n|---|---:|\n| Turnover | {{ctx.ctTurnover}} |\n| Cost of sales | ({{ctx.ctCogs}}) |\n| **Gross profit** | **{{ctx.ctGrossProfit}}** |\n| Administrative expenses | ({{ctx.ctAdmin}}) |\n| Other operating income | {{ctx.ctOtherIncome}} |\n| **Operating profit** | **{{ctx.ctOperatingProfit}}** |\n| Interest receivable | {{ctx.ctInterestRec}} |\n| Interest payable | ({{ctx.ctInterestPay}}) |\n| **Profit before tax (per accounts)** | **{{ctx.ctPbt}}** |'},
{id:'adjustments', heading:'2. Tax adjustments',
 body:'| Adjustment | Amount (£) |\n|---|---:|\n| Profit per accounts | {{ctx.ctPbt}} |\n| Add: depreciation | {{ctx.ctDepreciation}} |\n| Add: disallowable entertainment | {{ctx.ctEntertainment}} |\n| Add: disallowable legal/professional | {{ctx.ctDisallowedLegal}} |\n| Add: other disallowables | {{ctx.ctOtherDisallow}} |\n| Less: capital allowances (AIA / WDA / FYA) | ({{ctx.ctCapAllowances}}) |\n| Less: R&D relief uplift | ({{ctx.ctRdUplift}}) |\n| Less: loss relief brought forward | ({{ctx.ctLossesBfwd}}) |\n| **Taxable trading profit** | **{{ctx.ctTaxableProfit}}** |'},
{id:'tax', heading:'3. Corporation tax',
 body:'**Augmented profits:** £{{ctx.ctAugmentedProfits}}\n**Number of associated companies:** {{ctx.ctAssociated}}\n**Effective lower limit (£50k / (1+n)):** £{{ctx.ctLowerLimit}}\n**Effective upper limit (£250k / (1+n)):** £{{ctx.ctUpperLimit}}\n\n| Band | Rate | Tax (£) |\n|---|---:|---:|\n| Small profits rate (≤ lower limit) | 19% | {{ctx.ctSmallRateTax}} |\n| Main rate (≥ upper limit) | 25% | {{ctx.ctMainRateTax}} |\n| Marginal relief (between limits) | (3/200 × (UL − AP) × N/AP) | ({{ctx.ctMarginalRelief}}) |\n| **Corporation tax liability** | | **{{ctx.ctLiability}}** |\n\nLess: tax paid in instalments / overpaid: £{{ctx.ctPaidInstalments}}\n**Balance of CT payable:** £{{ctx.ctBalancePayable}} due **{{ctx.ctPayDeadline}}**'},
{id:'losses', heading:'4. Loss memorandum',
 body:'| | Amount (£) |\n|---|---:|\n| Losses brought forward at period start | {{ctx.ctLossesOpening}} |\n| Loss arising in period | {{ctx.ctLossArising}} |\n| Loss utilised in period | ({{ctx.ctLossesUtilised}}) |\n| Loss surrendered to group / R&D | ({{ctx.ctLossesSurrendered}}) |\n| **Losses carried forward** | **{{ctx.ctLossesCfwd}}** |'},
{id:'notes', heading:'5. Notes', locked:true,
 body:'This computation is based on the draft accounts and supporting records provided. It has **not yet been submitted to HMRC**. Please review, sign the approval block, and return to enable us to file the CT600 with iXBRL-tagged accounts via HMRC’s online filing channel. Late filing penalties begin at £100 (first 3 months), £200 (3-6 months) and 10–20% tax-geared thereafter. Interest runs on unpaid tax from 9 months + 1 day after the period end.'}
]});
TEMPLATES_BUILTIN.push({
 id:'vat100', name:'VAT Return Summary (VAT100)', version:'1.0',
 cobs:'HMRC VAT100 · MTD', kind:'tax-computation',
 description:'Quarterly VAT100 — Box 1-9 with explanation. MTD-compatible.',
 sections:[
{id:'header', heading:'VAT Return · {{ctx.vatPeriod}}',
 body:'**Business:** {{client.entityName}}\n**VAT number:** {{client.vatNumber}}\n**VAT scheme:** {{client.vatScheme}}\n**Period:** {{ctx.vatPeriodStart}} to {{ctx.vatPeriodEnd}}\n**Filing & payment deadline (1 month + 7 days):** **{{ctx.vatDueDate}}**\n**Submission method:** MTD-compatible (HMRC API)'},
{id:'boxes', heading:'1. VAT100 boxes',
 body:'| Box | Description | Amount (£) |\n|---|---|---:|\n| 1 | VAT due on sales and other outputs | {{ctx.vatBox1}} |\n| 2 | VAT due on acquisitions from EU member states (NI only) | {{ctx.vatBox2}} |\n| 3 | Total VAT due (Box 1 + Box 2) | **{{ctx.vatBox3}}** |\n| 4 | VAT reclaimed on purchases and other inputs | ({{ctx.vatBox4}}) |\n| 5 | **Net VAT payable / (reclaim)** (Box 3 − Box 4) | **{{ctx.vatBox5}}** |\n| 6 | Total value of sales (excl VAT) | {{ctx.vatBox6}} |\n| 7 | Total value of purchases (excl VAT) | {{ctx.vatBox7}} |\n| 8 | Total value of goods supplied to EU member states (NI only) | {{ctx.vatBox8}} |\n| 9 | Total value of goods acquired from EU member states (NI only) | {{ctx.vatBox9}} |'},
{id:'reconciliation', heading:'2. Reconciliation to records',
 body:'| | Amount (£) |\n|---|---:|\n| Sales per nominal ledger (period) | {{ctx.vatSalesLedger}} |\n| Adjustments (zero/exempt/outside scope) | ({{ctx.vatAdjustments}}) |\n| Sales for VAT (Box 6) | {{ctx.vatBox6}} |\n| VAT rate(s) applied | {{ctx.vatRates}} |\n\nWhere the flat-rate scheme is used, Box 1 is calculated as **{{ctx.vatFrPercent}}%** of VAT-inclusive turnover (£{{ctx.vatFrTurnover}}).'},
{id:'mtd-notice', heading:'3. Making Tax Digital', locked:true,
 body:'**Making Tax Digital for VAT** has been mandatory for all VAT-registered businesses since 1 April 2022. We are required to maintain a "digital link" from your source records to the VAT return — manual re-keying breaks this link and may attract an MTD-specific penalty.\n\nThis return will be submitted to HMRC via an MTD-recognised software bridge. A copy of the submission receipt will be retained on file for at least six years (HMRC VAT record-keeping rule).'},
{id:'sign', heading:'4. Approval',
 body:'I confirm that the figures above are a true and complete record of the VAT due for the period stated and authorise submission to HMRC.\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'mgmt-accounts', name:'Management Accounts Pack', version:'1.0',
 cobs:'management info', kind:'mgmt-info',
 description:'Quarterly / monthly management accounts — P&L summary, balance sheet, cash, KPIs.',
 sections:[
{id:'header', heading:'Management Accounts · {{client.entityName}}',
 body:'**Period:** {{ctx.mgmtPeriod}}\n**Prepared by:** {{firm.name}}\n**For:** Internal management use — not statutory.\n**Date:** {{today}}'},
{id:'pl', heading:'1. Profit & Loss summary',
 body:'| | Period (£) | YTD (£) | Prior YTD (£) | Var % |\n|---|---:|---:|---:|---:|\n| Turnover | {{ctx.mgmtRevPeriod}} | {{ctx.mgmtRevYtd}} | {{ctx.mgmtRevPriorYtd}} | {{ctx.mgmtRevVarPct}}% |\n| Cost of sales | ({{ctx.mgmtCogsPeriod}}) | ({{ctx.mgmtCogsYtd}}) | ({{ctx.mgmtCogsPriorYtd}}) | — |\n| **Gross profit** | **{{ctx.mgmtGpPeriod}}** | **{{ctx.mgmtGpYtd}}** | {{ctx.mgmtGpPriorYtd}} | — |\n| Gross margin % | {{ctx.mgmtGmPeriod}}% | {{ctx.mgmtGmYtd}}% | {{ctx.mgmtGmPriorYtd}}% | — |\n| Overheads | ({{ctx.mgmtOverheadsPeriod}}) | ({{ctx.mgmtOverheadsYtd}}) | ({{ctx.mgmtOverheadsPriorYtd}}) | — |\n| **Net profit** | **{{ctx.mgmtNetPeriod}}** | **{{ctx.mgmtNetYtd}}** | {{ctx.mgmtNetPriorYtd}} | — |\n| Net margin % | {{ctx.mgmtNmPeriod}}% | {{ctx.mgmtNmYtd}}% | {{ctx.mgmtNmPriorYtd}}% | — |'},
{id:'bs', heading:'2. Balance sheet (snapshot)',
 body:'| | At period end (£) | Prior period (£) |\n|---|---:|---:|\n| **Fixed assets** | {{ctx.mgmtFixed}} | {{ctx.mgmtFixedPrior}} |\n| Stock | {{ctx.mgmtStock}} | {{ctx.mgmtStockPrior}} |\n| Trade debtors | {{ctx.mgmtDebtors}} | {{ctx.mgmtDebtorsPrior}} |\n| Cash at bank | {{ctx.mgmtCash}} | {{ctx.mgmtCashPrior}} |\n| **Current assets** | **{{ctx.mgmtCurrentAssets}}** | {{ctx.mgmtCurrentAssetsPrior}} |\n| Trade creditors | ({{ctx.mgmtCreditors}}) | ({{ctx.mgmtCreditorsPrior}}) |\n| VAT, PAYE, CT due | ({{ctx.mgmtTaxDue}}) | ({{ctx.mgmtTaxDuePrior}}) |\n| Other creditors | ({{ctx.mgmtOtherCreditors}}) | ({{ctx.mgmtOtherCreditorsPrior}}) |\n| **Current liabilities** | **({{ctx.mgmtCurrentLiabilities}})** | ({{ctx.mgmtCurrentLiabilitiesPrior}}) |\n| Net current assets | {{ctx.mgmtNca}} | {{ctx.mgmtNcaPrior}} |\n| Long-term debt | ({{ctx.mgmtLtDebt}}) | ({{ctx.mgmtLtDebtPrior}}) |\n| **Net assets / shareholders’ funds** | **{{ctx.mgmtNetAssets}}** | {{ctx.mgmtNetAssetsPrior}} |'},
{id:'cash', heading:'3. Cash position',
 body:'**Cash at period end:** £{{ctx.mgmtCash}}\n**Movement in period:** £{{ctx.mgmtCashMovement}}\n**Debtor days:** {{ctx.mgmtDebtorDays}} · **Creditor days:** {{ctx.mgmtCreditorDays}}\n**Quick ratio:** {{ctx.mgmtQuickRatio}} · **Current ratio:** {{ctx.mgmtCurrentRatio}}\n\nProjected cash position end of next quarter: £{{ctx.mgmtCashProj}}'},
{id:'kpis', heading:'4. KPIs',
 body:'| KPI | Period | YTD | Target |\n|---|---:|---:|---:|\n| Revenue growth (YoY) | {{ctx.mgmtRevGrowth}}% | — | {{ctx.mgmtRevGrowthTarget}}% |\n| Gross margin | {{ctx.mgmtGmPeriod}}% | {{ctx.mgmtGmYtd}}% | {{ctx.mgmtGmTarget}}% |\n| Net margin | {{ctx.mgmtNmPeriod}}% | {{ctx.mgmtNmYtd}}% | {{ctx.mgmtNmTarget}}% |\n| Debtor days | {{ctx.mgmtDebtorDays}} | — | 45 |\n| Cash runway (months) | {{ctx.mgmtRunway}} | — | 6+ |'},
{id:'commentary', heading:'5. Commentary',
 body:'{{ctx.mgmtCommentary}}'}
]});
TEMPLATES_BUILTIN.push({
 id:'year-end-pack', name:'Year-End Pack', version:'1.0',
 cobs:'year-end summary', kind:'pack',
 description:'Consolidated year-end pack — accounts, CT600, deadlines, recommendations.',
 sections:[
{id:'header', heading:'Year-End Pack · {{client.entityName}}',
 body:'**Year ended:** {{client.accountingPeriodEnd}}\n**Prepared by:** {{firm.name}}\n**Adviser:** {{adviser.name}}\n**Date:** {{today}}'},
{id:'summary', heading:'1. Headline figures',
 body:'| | £ |\n|---|---:|\n| Turnover | {{ctx.yeTurnover}} |\n| Gross profit | {{ctx.yeGrossProfit}} |\n| Profit before tax | {{ctx.yePbt}} |\n| Corporation tax | {{ctx.yeCt}} |\n| Profit after tax | {{ctx.yePat}} |\n| Net assets | {{ctx.yeNetAssets}} |\n| Cash | {{ctx.yeCash}} |\n| Dividends paid in year | {{ctx.yeDividends}} |\n| Director’s salary | {{ctx.yeDirectorSalary}} |'},
{id:'deadlines', heading:'2. Filing deadlines',
 body:'| Filing | Authority | Due date |\n|---|---|---|\n| Statutory accounts | Companies House | **{{ctx.yeAccountsDue}}** (9 months after year-end) |\n| Corporation tax return (CT600) | HMRC | {{ctx.ctFilingDeadline}} (12 months after year-end) |\n| Corporation tax payment | HMRC | **{{ctx.ctPayDeadline}}** (9m + 1 day) |\n| Confirmation statement (CS01) | Companies House | {{ctx.yeCs01Due}} |\n| Self Assessment (director) | HMRC | 31 January {{ctx.saFilingYear}} |'},
{id:'recommendations', heading:'3. Recommendations for next year',
 body:'{{ctx.yeRecommendations}}'},
{id:'tax-planning', heading:'4. Tax planning notes',
 body:'- **Director remuneration mix:** salary at NI-efficient level (£{{ctx.yeOptimalSalary}}) + dividends to use basic-rate band.\n- **Pension contributions:** employer contributions reduce CT (subject to wholly & exclusively test).\n- **R&D claims:** review whether any qualifying expenditure has been incurred.\n- **Capital allowances:** £1m AIA available for qualifying plant & machinery.\n- **Annual investment allowance utilisation:** £{{ctx.yeAiaUsed}} of £1,000,000.'},
{id:'sign', heading:'5. Approval',
 body:'I confirm receipt of this pack and that I have reviewed the figures and deadlines above.\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'rd-narrative', name:'R&D Tax Claim Narrative', version:'1.0',
 cobs:'CTA 2009 Part 13 · merged scheme', kind:'tax-claim',
 description:'R&D tax relief narrative — SME merged scheme post-April 2024.',
 sections:[
{id:'header', heading:'R&D Tax Relief Claim · {{client.entityName}}',
 body:'**Accounting period:** {{client.accountingPeriodStart}} to {{client.accountingPeriodEnd}}\n**Scheme:** Merged R&D Expenditure Credit (post-April 2024) / SME loss-making intensive\n**Prepared by:** {{firm.name}} · {{adviser.name}}\n**Date:** {{today}}'},
{id:'company-context', heading:'1. Company and project context',
 body:'**Trade:** {{ctx.rdTrade}}\n**Size category:** {{ctx.rdSizeCategory}} (SME / large / loss-making R&D intensive)\n**Total qualifying staff:** {{ctx.rdStaffCount}}\n**Number of R&D projects in period:** {{ctx.rdProjectCount}}\n\n{{ctx.rdCompanyContext}}'},
{id:'technical-baseline', heading:'2. Baseline of science or technology (advance starts from where?)',
 body:'The baseline against which our advance is measured is established by reference to publicly available knowledge in **{{ctx.rdField}}** at the start of the project. Specifically:\n\n{{ctx.rdBaseline}}\n\nA competent professional working in this field would not, without recourse to systematic experimentation, have been able to achieve the outcome we sought.'},
{id:'advance', heading:'3. Advance sought in science or technology',
 body:'**Project:** {{ctx.rdProjectName}}\n\nThe advance sought is:\n\n{{ctx.rdAdvance}}\n\nThis goes beyond what would constitute mere "use of existing technology in a new way" because {{ctx.rdAdvanceWhy}}.'},
{id:'uncertainty', heading:'4. Scientific or technological uncertainty',
 body:'The uncertainties faced were:\n\n{{ctx.rdUncertainty}}\n\nThese were not capable of being resolved by reading the literature, consulting a competent professional, or by routine engineering — they required investigation and trial.'},
{id:'resolution', heading:'5. How the uncertainty was (or was being) resolved',
 body:'{{ctx.rdResolution}}\n\nThe methodology was iterative: hypothesis → prototype → test → refinement, with documented results at each stage. Records of failed experiments are retained, evidencing the genuine nature of the uncertainty.'},
{id:'qualifying-expenditure', heading:'6. Qualifying expenditure',
 body:'| Category | £ |\n|---|---:|\n| Staff costs (directly engaged) | {{ctx.rdStaffCosts}} |\n| Externally provided workers (65%) | {{ctx.rdEpw}} |\n| Subcontracted R&D (65% / connected at cost) | {{ctx.rdSubcontract}} |\n| Software licences | {{ctx.rdSoftware}} |\n| Consumables (heat, light, power, transformed materials) | {{ctx.rdConsumables}} |\n| Data and cloud computing (post April 2023) | {{ctx.rdCloud}} |\n| **Total qualifying expenditure** | **{{ctx.rdQualifying}}** |'},
{id:'calculation', heading:'7. Relief calculation',
 body:'**Merged scheme RDEC (post-April 2024):**\n- 20% above-the-line credit on qualifying expenditure: £{{ctx.rdRdecGross}}\n- Less notional CT at main rate (25% or 19% depending on banding): (£{{ctx.rdRdecCtNotional}})\n- **Net cash benefit / CT reduction:** £{{ctx.rdNetBenefit}}\n\n**Alternative — loss-making R&D-intensive SME (≥30% intensity, post-April 2024):**\n- Enhanced deduction at 86% gives surrenderable loss of £{{ctx.rdSmeEnhanced}}\n- Tax credit at 14.5% gives cash credit of £{{ctx.rdSmeCredit}}\n- **Cash credit:** £{{ctx.rdSmeCashCredit}}'},
{id:'declaration', heading:'8. Declaration', locked:true,
 body:'This narrative has been prepared by **{{firm.name}}** as agent on behalf of **{{client.entityName}}**. The factual content has been provided by the company’s technical staff. The R&D claim has been notified to HMRC via the **Additional Information Form** within the six-month notification window where required (CTA 2009 s.1142A). The claim is supported by contemporaneous records made available to HMRC on request.\n\nI confirm that the activities described meet the DSIT guidelines on the meaning of R&D for tax purposes.'}
]});
TEMPLATES_BUILTIN.push({
 id:'payslip', name:'Payslip', version:'1.0',
 cobs:'ITEPA 2003 / RTI', kind:'payroll',
 description:'Employee payslip — gross, tax, NI, pension, student loan, net.',
 sections:[
{id:'header', heading:'Payslip',
 body:'**Employer:** {{client.entityName}}\nPAYE reference: {{client.payeReference}}\n\n**Employee:** {{ctx.psEmployeeName}}\nPayroll no: {{ctx.psPayrollNo}}\nNINO: {{ctx.psNino}}\nTax code: **{{ctx.psTaxCode}}**\n\n**Pay period:** {{ctx.psPeriod}} · Pay date: {{ctx.psPayDate}}'},
{id:'earnings', heading:'1. Earnings',
 body:'| Item | Hours / units | Rate | Amount (£) |\n|---|---:|---:|---:|\n| Basic salary | {{ctx.psBasicHours}} | {{ctx.psBasicRate}} | {{ctx.psBasic}} |\n| Overtime | {{ctx.psOtHours}} | {{ctx.psOtRate}} | {{ctx.psOt}} |\n| Bonus | — | — | {{ctx.psBonus}} |\n| Holiday pay | — | — | {{ctx.psHoliday}} |\n| Other | — | — | {{ctx.psOther}} |\n| **Gross pay** | | | **{{ctx.psGross}}** |'},
{id:'deductions', heading:'2. Deductions',
 body:'| Deduction | Amount (£) |\n|---|---:|\n| PAYE income tax | {{ctx.psPaye}} |\n| Employee National Insurance (Cat A, 8% / 2%) | {{ctx.psEeNi}} |\n| Workplace pension (employee, {{ctx.psPensionEePct}}%) | {{ctx.psPensionEe}} |\n| Student loan ({{ctx.psSlPlan}}) | {{ctx.psStudentLoan}} |\n| Postgraduate loan | {{ctx.psPgLoan}} |\n| Other deductions | {{ctx.psOtherDed}} |\n| **Total deductions** | **{{ctx.psTotalDed}}** |\n\n## Net pay: £{{ctx.psNet}}'},
{id:'employer-costs', heading:'3. Employer contributions (information only)',
 body:'| | Amount (£) |\n|---|---:|\n| Employer NI (Cat A, 13.8% over £5,000 secondary threshold) | {{ctx.psErNi}} |\n| Employer pension contribution ({{ctx.psPensionErPct}}%) | {{ctx.psPensionEr}} |\n| Apprenticeship levy (where applicable) | {{ctx.psAppLevy}} |\n| **Total employment cost** | **{{ctx.psTotalCost}}** |'},
{id:'ytd', heading:'4. Year-to-date',
 body:'| | YTD (£) |\n|---|---:|\n| Gross pay | {{ctx.psYtdGross}} |\n| PAYE | {{ctx.psYtdPaye}} |\n| Employee NI | {{ctx.psYtdEeNi}} |\n| Pension (employee) | {{ctx.psYtdPensionEe}} |\n| Net pay | {{ctx.psYtdNet}} |'},
{id:'rti-notice', heading:'5. RTI submission', locked:true,
 body:'The Full Payment Submission (FPS) for this pay period was submitted to HMRC on or before the pay date in accordance with **PAYE Regulations 2003 (as amended)**. Late FPS attracts automatic penalties (£100–£400 per month depending on PAYE scheme size). A copy of the submission acknowledgement is retained on the payroll file.'}
]});
TEMPLATES_BUILTIN.push({
 id:'p60', name:'P60 (Informational)', version:'1.0',
 cobs:'HMRC P60 · annual', kind:'payroll',
 description:'Annual employee statement P60 — pay & tax for the tax year. Informational, not the official HMRC P60 substitute.',
 sections:[
{id:'header', heading:'P60 · End of Year Certificate',
 body:'**Tax year:** {{ctx.taxYear}} (6 April {{ctx.taxYearFromYear}} – 5 April {{ctx.taxYearToYear}})\n\n**Employer:** {{client.entityName}}\nPAYE reference: {{client.payeReference}}\n\n**Employee:** {{ctx.p60EmployeeName}}\nNINO: {{ctx.p60Nino}}\nFinal tax code: **{{ctx.p60FinalCode}}**\nDate left (if applicable): {{ctx.p60Left}}'},
{id:'pay', heading:'1. Pay and tax in this employment',
 body:'| | £ |\n|---|---:|\n| Total pay in this employment | {{ctx.p60Pay}} |\n| Total tax in this employment | {{ctx.p60Tax}} |\n| Previous employment(s) pay | {{ctx.p60PrevPay}} |\n| Previous employment(s) tax | {{ctx.p60PrevTax}} |\n| **Total pay for the year** | **{{ctx.p60TotalPay}}** |\n| **Total tax for the year** | **{{ctx.p60TotalTax}}** |'},
{id:'ni', heading:'2. National Insurance contributions',
 body:'| Category | Earnings at LEL (£) | LEL → PT (£) | PT → UEL (£) | Employee NIC (£) |\n|---|---:|---:|---:|---:|\n| {{ctx.p60NiCat}} | {{ctx.p60NiLel}} | {{ctx.p60NiLelPt}} | {{ctx.p60NiPtUel}} | {{ctx.p60EeNi}} |'},
{id:'statutory-payments', heading:'3. Statutory payments included',
 body:'| | £ |\n|---|---:|\n| Statutory maternity pay (SMP) | {{ctx.p60Smp}} |\n| Statutory paternity pay (SPP) | {{ctx.p60Spp}} |\n| Statutory adoption pay (SAP) | {{ctx.p60Sap}} |\n| Statutory shared parental pay (ShPP) | {{ctx.p60Shpp}} |\n| Statutory neonatal pay (SNP) | {{ctx.p60Snp}} |'},
{id:'student-loans', heading:'4. Student loan and other deductions',
 body:'| | £ |\n|---|---:|\n| Student loan deductions ({{ctx.psSlPlan}}) | {{ctx.p60StudentLoan}} |\n| Postgraduate loan deductions | {{ctx.p60PgLoan}} |'},
{id:'notice', heading:'5. Notice', locked:true,
 body:'**Keep this certificate in a safe place — you may need it to claim tax credits, complete a tax return, or as proof of income.**\n\nThis document has been prepared from the payroll records held by {{client.entityName}}. The corresponding RTI submissions have been made to HMRC. If you believe any figure is incorrect please contact your employer’s payroll office before the **31 May** deadline for issuing the official P60.'}
]});
TEMPLATES_BUILTIN.push({
 id:'p11d', name:'P11D Benefits in Kind', version:'1.0',
 cobs:'ITEPA 2003 · benefits code', kind:'payroll',
 description:'P11D BIK disclosure for directors / employees earning > £8,500 (now universal).',
 sections:[
{id:'header', heading:'P11D · Benefits in Kind · {{ctx.taxYear}}',
 body:'**Employer:** {{client.entityName}}\nPAYE reference: {{client.payeReference}}\nFiling deadline: **6 July {{ctx.taxYearToYear}}** (return) · **22 July {{ctx.taxYearToYear}}** (Class 1A NIC payment)\n\n**Employee:** {{ctx.p11dEmployeeName}}\nNINO: {{ctx.p11dNino}}\nJob title: {{ctx.p11dJobTitle}}\nDirector? {{ctx.p11dDirector}}'},
{id:'cars', heading:'A. Cars and car fuel',
 body:'| Item | Value (£) |\n|---|---:|\n| List price + accessories | {{ctx.p11dCarListPrice}} |\n| CO2 emissions (g/km) | {{ctx.p11dCarCo2}} |\n| Appropriate %age | {{ctx.p11dCarPct}}% |\n| **Car benefit charge** | **{{ctx.p11dCarBenefit}}** |\n| Car fuel benefit (£27,800 × % for {{ctx.taxYear}}) | {{ctx.p11dFuelBenefit}} |'},
{id:'vans', heading:'B. Vans and van fuel',
 body:'**Van benefit:** £{{ctx.p11dVanBenefit}} (standard £3,960 for {{ctx.taxYear}}, nil for zero-emission)\n**Van fuel benefit:** £{{ctx.p11dVanFuelBenefit}}'},
{id:'loans', heading:'C. Beneficial loans',
 body:'**Average balance outstanding:** £{{ctx.p11dLoanAvg}}\n**HMRC official rate of interest:** {{ctx.p11dOir}}%\n**Interest charged by employer:** {{ctx.p11dInterestCharged}}%\n**Cash equivalent of benefit:** £{{ctx.p11dLoanBenefit}}\n\n(De minimis: loans aggregating ≤ £10,000 are exempt)'},
{id:'medical', heading:'D. Private medical & dental insurance',
 body:'**Annual premium paid by employer:** £{{ctx.p11dMedical}}'},
{id:'accommodation', heading:'E. Living accommodation',
 body:'**Cash equivalent:** £{{ctx.p11dAccommodation}}'},
{id:'other', heading:'F. Other benefits',
 body:'| Item | £ |\n|---|---:|\n| Mobile phones (additional) | {{ctx.p11dMobiles}} |\n| Vouchers and credit cards | {{ctx.p11dVouchers}} |\n| Asset transfers | {{ctx.p11dAssetTransfers}} |\n| Expenses payments | {{ctx.p11dExpenses}} |\n| Other benefits | {{ctx.p11dOther}} |\n| **Total other** | **{{ctx.p11dOtherTotal}}** |'},
{id:'class-1a', heading:'G. Class 1A NIC',
 body:'| | £ |\n|---|---:|\n| Total cash-equivalent benefits | {{ctx.p11dTotalBenefits}} |\n| Class 1A NIC at 13.8% | **{{ctx.p11dClass1A}}** |\n\nPayable to HMRC by **22 July {{ctx.taxYearToYear}}** (electronic) / 19 July (post).'},
{id:'notice', heading:'H. Notice', locked:true,
 body:'A copy of this P11D must be given to the employee by **6 July {{ctx.taxYearToYear}}**. The corresponding **P11D(b)** return is filed with HMRC by the same date. From April 2026, mandatory payrolling of most BIKs will replace P11D filing for most benefits — we will advise on the transition.'}
]});
TEMPLATES_BUILTIN.push({
 id:'dividend-voucher', name:'Dividend Voucher', version:'1.0',
 cobs:'Companies Act 2006 s.836–s.853', kind:'company',
 description:'Dividend voucher — Ltd company distribution to shareholder.',
 sections:[
{id:'header', heading:'Dividend Voucher',
 body:'**Company:** {{client.entityName}}\nCompanies House no: {{client.companiesHouseNo}}\nRegistered office: {{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}'},
{id:'distribution', heading:'Distribution details',
 body:'**Shareholder:** {{ctx.divShareholderName}}\n**Shareholder address:** {{ctx.divShareholderAddress}}\n**Share class:** {{ctx.divShareClass}} (e.g. Ordinary £1)\n**Number of shares held:** {{ctx.divSharesHeld}}\n**Dividend per share:** £{{ctx.divPerShare}}\n**Date declared:** {{ctx.divDeclared}}\n**Date paid:** {{ctx.divPaid}}\n\n## Net dividend: £{{ctx.divAmount}}'},
{id:'tax-info', heading:'Tax credit information', locked:true,
 body:'Since 6 April 2016 the **notional 10% tax credit has been abolished**. The shareholder receives the dividend without any tax credit and will pay dividend tax through self-assessment as follows for {{ctx.taxYear}}:\n\n- First **£500** of dividend income is covered by the dividend allowance (tax-free).\n- Above £500: **8.75% basic rate · 33.75% higher rate · 39.35% additional rate**.\n\nThe shareholder should retain this voucher with their tax records.'},
{id:'authorisation', heading:'Authorisation',
 body:'The above dividend was lawfully declared from the company’s **distributable profits** in accordance with the Companies Act 2006 (Part 23, sections 829–853) and the company’s articles of association. Board minute of the declaration is retained at the registered office.\n\nSigned for and on behalf of **{{client.entityName}}**:\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'directors-loan', name:'Director’s Loan Account Statement', version:'1.0',
 cobs:'CTA 2010 s.455 · BIK rules', kind:'company',
 description:'Director’s Loan Account statement — movements, overdrawn position, s.455 charge, BIK on interest.',
 sections:[
{id:'header', heading:'Director’s Loan Account · {{ctx.dlaDirectorName}}',
 body:'**Company:** {{client.entityName}}\n**Director:** {{ctx.dlaDirectorName}}\n**Period:** {{client.accountingPeriodStart}} to {{client.accountingPeriodEnd}}\n**Date of statement:** {{today}}'},
{id:'movements', heading:'1. Movements in the period',
 body:'| Date | Description | Debit (£) | Credit (£) | Balance (£) |\n|---|---|---:|---:|---:|\n| {{client.accountingPeriodStart}} | Balance brought forward | | | {{ctx.dlaOpening}} |\n| {{ctx.dlaDate1}} | {{ctx.dlaDesc1}} | {{ctx.dlaDebit1}} | {{ctx.dlaCredit1}} | {{ctx.dlaBal1}} |\n| {{ctx.dlaDate2}} | {{ctx.dlaDesc2}} | {{ctx.dlaDebit2}} | {{ctx.dlaCredit2}} | {{ctx.dlaBal2}} |\n| {{ctx.dlaDate3}} | {{ctx.dlaDesc3}} | {{ctx.dlaDebit3}} | {{ctx.dlaCredit3}} | {{ctx.dlaBal3}} |\n| {{client.accountingPeriodEnd}} | **Balance carried forward** | | | **{{ctx.dlaClosing}}** |'},
{id:'overdrawn', heading:'2. Overdrawn position',
 body:'**Period-end balance:** £{{ctx.dlaClosing}} ({{ctx.dlaOverdrawnYn}})\n**Maximum overdrawn in period:** £{{ctx.dlaMaxOverdrawn}}\n**Average balance:** £{{ctx.dlaAvg}}'},
{id:'s455', heading:'3. Section 455 corporation tax charge',
 body:'Where a director’s loan remains outstanding **9 months and 1 day** after the period end, a **section 455 CTA 2010** charge of **33.75%** of the outstanding amount becomes payable.\n\n| | £ |\n|---|---:|\n| Loan outstanding 9m+1d after period end | {{ctx.dlaS455Outstanding}} |\n| Section 455 charge at 33.75% | **{{ctx.dlaS455Charge}}** |\n| Due date | **{{ctx.dlaS455DueDate}}** |\n\nThe charge is reclaimable when the loan is repaid (one year after the period end in which repayment falls).'},
{id:'bik', heading:'4. Benefit in kind on interest-free loan', locked:true,
 body:'Where the loan exceeds **£10,000** at any point in the tax year and the director pays no interest (or below HMRC’s official rate of **{{ctx.p11dOir}}%**), a beneficial loan benefit arises and must be reported on the **P11D**.\n\n**BIK in {{ctx.taxYear}}:** £{{ctx.dlaBik}}\n\nClass 1A NIC at 13.8% is also payable by the company on this benefit.'},
{id:'recommendation', heading:'5. Recommendation',
 body:'{{ctx.dlaRecommendation}}'}
]});
TEMPLATES_BUILTIN.push({
 id:'disengagement', name:'Disengagement Letter', version:'1.0',
 cobs:'ICAEW / ACCA model', kind:'agreement',
 description:'Disengagement letter — formal cessation of professional relationship.',
 sections:[
{id:'header', heading:'Disengagement Letter',
 body:'**{{firm.name}}**\nDate: {{today}}\n\nFor the attention of: **{{client.displayName}}**\n{{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}'},
{id:'notice', heading:'1. Notice of disengagement',
 body:'I write to confirm that, in accordance with clause 10 of our engagement letter dated {{ctx.disengageEngagementDate}}, **{{firm.name}}** will cease to act for **{{client.displayName}}** with effect from **{{ctx.disengageEffectiveDate}}**.\n\nThe reason for the disengagement is: {{ctx.disengageReason}}.'},
{id:'work-completed', heading:'2. Work completed up to disengagement',
 body:'We have completed the following work up to the date of this letter:\n\n{{ctx.disengageWorkDone}}\n\nThe following work remains outstanding and **will not be completed by us**:\n\n{{ctx.disengageOutstanding}}'},
{id:'deadlines-flagged', heading:'3. Critical filings & deadlines to flag', locked:true,
 body:'You should be aware of the following deadlines which will fall during or shortly after the disengagement period. **You are responsible for ensuring these are met**, whether by you, an in-house resource, or a successor practitioner:\n\n| Filing | Authority | Due date |\n|---|---|---|\n| Statutory accounts | Companies House | {{ctx.ctFilingDeadline}} |\n| Corporation tax (CT600) | HMRC | {{ctx.ctFilingDeadline}} |\n| VAT return | HMRC | {{ctx.vatDueDate}} |\n| Self Assessment (SA100) | HMRC | 31 January {{ctx.saFilingYear}} |\n| Confirmation statement (CS01) | Companies House | {{ctx.yeCs01Due}} |\n| Payroll RTI / P60 / P11D | HMRC | as scheduled |\n\nFailure to meet these deadlines is your responsibility once this disengagement takes effect.'},
{id:'records', heading:'4. Return of records',
 body:'Your books and records are available for collection from our office. We will provide a copy of working papers prepared by us on payment of any outstanding fees. We may exercise a **particular lien** over papers in our possession in respect of fees properly due and unpaid (£{{ctx.disengageFeesOutstanding}}).'},
{id:'successor', heading:'5. Professional clearance from successor',
 body:'Where you appoint a successor practitioner we will respond to their **professional clearance enquiry** in accordance with the {{firm.professionalBody}} Code of Ethics, subject to receipt of your written authority to disclose information.\n\nWe will provide reasonable handover information at no further charge.'},
{id:'aml-suspicion', heading:'6. Anti-money-laundering notice', locked:true,
 body:'Disengagement does not extinguish our continuing obligations under the **Money Laundering Regulations 2017** and the **Proceeds of Crime Act 2002**. Where we have made (or may yet make) a Suspicious Activity Report to the National Crime Agency, we are bound by the tipping-off rules and cannot disclose that fact.'},
{id:'sign', heading:'7. Acknowledgement',
 body:'I acknowledge receipt of this disengagement letter and the deadlines flagged above.\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'fee-quote', name:'Fee Quote / Estimate', version:'1.0',
 cobs:'pre-engagement', kind:'quote',
 description:'Pre-engagement fee quote — non-binding until engagement letter signed.',
 sections:[
{id:'header', heading:'Fee Quote',
 body:'**{{firm.name}}**\nQuote ref: {{ctx.quoteRef}}\nDate: {{today}}\nValid until: {{ctx.quoteValidUntil}}\n\nPrepared for: **{{client.displayName}}**'},
{id:'scope', heading:'1. Scope quoted',
 body:'This quote covers the following services for the period **{{ctx.quotePeriod}}**:\n\n{{ctx.quoteScope}}'},
{id:'fees', heading:'2. Fees',
 body:'| Service | Frequency | Fee (£, exc VAT) |\n|---|---|---:|\n| Annual accounts | annual | {{ctx.quoteFeeAccounts}} |\n| Corporation tax return (CT600) | annual | {{ctx.quoteFeeCt}} |\n| VAT returns | quarterly × 4 | {{ctx.quoteFeeVat}} |\n| Payroll ({{ctx.quotePayrollHeads}} employees) | monthly | {{ctx.quoteFeePayroll}} |\n| Self Assessment (director) | annual | {{ctx.quoteFeeSa}} |\n| Bookkeeping ({{ctx.quoteBookkeepingFreq}}) | as agreed | {{ctx.quoteFeeBookkeeping}} |\n| Companies House CS01 + admin | annual | {{ctx.quoteFeeCs01}} |\n| **Total annualised** | | **{{ctx.quoteFeeTotal}}** |\n| **Equivalent monthly direct-debit** | | **{{ctx.quoteFeeMonthly}}** |\n\nAll fees are quoted **exclusive of VAT** and **exclusive of disbursements** (Companies House filing fees, etc.).'},
{id:'assumptions', heading:'3. Assumptions',
 body:'This quote is based on the following assumptions:\n\n{{ctx.quoteAssumptions}}\n\nWhere any of these assumptions prove incorrect, or where additional work arises (for example HMRC enquiries, restructuring), we will discuss and agree any additional fee with you in advance.'},
{id:'next-steps', heading:'4. Next steps', locked:true,
 body:'This quote is **not a contract**. To proceed:\n\n1. Confirm acceptance in writing or by return email.\n2. We will issue a formal **Engagement Letter** and request information for our **client due diligence** (CDD) and AML supervisor checks before commencing work.\n3. We may decline to act if CDD is unsatisfactory or a conflict of interest is identified.\n\nThis quote is valid until **{{ctx.quoteValidUntil}}**.'}
]});
function mergeTemplates(customs){
 const map=new Map();
 for(const t of TEMPLATES_BUILTIN)map.set(t.id,JSON.parse(JSON.stringify(t)));
 for(const c of customs||[]){
 const base=map.get(c.id);
 if(!base){map.set(c.id,c);continue}
 if(c.sectionOverrides){
 for(const sec of base.sections){
 if(sec.locked)continue;
 if(c.sectionOverrides[sec.id]!=null)sec.body=c.sectionOverrides[sec.id];
 }
 }
 base._custom=true;
 }
 return Array.from(map.values());
}
// ════════════════════════════════════════════════════════════════
// INTERPOLATION · accountancy-specific context
// ════════════════════════════════════════════════════════════════
function getPath(obj,path){if(obj==null)return undefined;const parts=path.split('.');let cur=obj;for(const p of parts){if(cur==null)return undefined;cur=cur[p]}return cur}
function age(dob){if(!dob)return '';const b=new Date(dob);if(isNaN(b))return '';const t=new Date();let a=t.getFullYear()-b.getFullYear();const m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a}
function displayName(c){
 if(!c)return '—';
 if(c.entityType==='sole-trader'||!c.entityType||!c.entityName)return [c.title,c.firstName,c.lastName].filter(Boolean).join(' ').trim()||'(unnamed client)';
 return c.entityName||((c.firstName||'')+' '+(c.lastName||'')).trim();
}
function servicesList(c){
 const svcs=c&&c.servicesEngaged||[];
 if(!svcs.length)return '- (no services recorded — edit client to add)';
 const map={accounts:'Annual statutory accounts (Companies Act 2006)',ct:'Corporation tax return (CT600) and computation',vat:'VAT returns (VAT100, MTD-compatible)','sa':'Self Assessment (SA100) and computation',payroll:'Payroll bureau and RTI submission','tax-planning':'Tax planning and review','bookkeeping':'Bookkeeping and management accounts','companies-house-filings':'Companies House annual return (CS01) and administrative filings'};
 return svcs.map(s=>'- '+(map[s]||s)).join('\n');
}
function buildContext(clientId,extra){
 const client=state.clients.find(c=>c.id===clientId)||{};
 const firm=state.firm||{};
 const adviser=state.advisers.find(a=>a.id===(client.adviserId||state.ui.activeAdviserId))||{name:'(unassigned)',phone:'',email:''};
 const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
 const taxYearFromYear=2025;const taxYearToYear=2026;const taxYear=taxYearFromYear+'-'+String(taxYearToYear).slice(-2);
 const clientCopy=JSON.parse(JSON.stringify(client));
 clientCopy.displayName=displayName(client);
 clientCopy.age=age(client.dob);
 // Derived deadlines
 const ye=client.accountingPeriodEnd||(taxYearFromYear+'-04-05');
 const yeDate=new Date(ye);
 const addMonths=(d,m)=>{const n=new Date(d);n.setMonth(n.getMonth()+m);return n};
 const fmtDate=d=>isNaN(d)?'—':d.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
 const ctFilingDeadline=fmtDate(addMonths(yeDate,12));
 const ctPayDeadline=fmtDate(new Date(addMonths(yeDate,9).getTime()+86400000));
 const yeAccountsDue=fmtDate(addMonths(yeDate,9));
 const yeCs01Due=fmtDate(addMonths(new Date(client.createdAt||Date.now()),12));
 const ctxDefault={
 // services
 servicesList:servicesList(client),
 paymentTerms:'monthly in advance by direct debit',
 liabilityCap:'2,000,000',
 bodyDomain:(firm.professionalBody||'icaew').toLowerCase()+'.com',
 complaintsScheme:'Financial Ombudsman Service (where eligible) or ICAEW Professional Conduct',
 jurisdiction:'England and Wales',
 frsStandard:'FRS 102 Section 1A (or FRS 105 for micro-entities)',
 coverHighlights:'turnover, gross margin, director\'s remuneration and tax position',
 coverComments:'The year shows revenue growth of approximately X% with margins broadly stable. Working capital remains healthy and the company is in a strong cash position to meet upcoming tax liabilities.',
 chDeadline:yeAccountsDue,
 ctDeadline:ctFilingDeadline,
 ctLiability:'12,500',
 ctPayDeadline,
 ctFilingDeadline,
 // SA100 defaults
 taxYear,taxYearFromYear,taxYearToYear,
 saFilingYear:taxYearToYear+1,
 saNextYear:(taxYearToYear)+'-'+String(taxYearToYear+1).slice(-2),
 saEmploymentIncome:'45,000',saBik:'0',saSelfEmploymentProfit:'0',saPartnershipProfit:'0',
 saPropertyIncome:'0',saInterest:'120',saDividends:'8,000',saPensionIncome:'0',saOtherIncome:'0',
 saTotalIncome:'53,120',saPersonalAllowance:'12,570',saPsa:'500',saDividendAllowance:'500',
 saMarriageAllowance:'0',saReliefs:'13,570',saTaxableIncome:'39,550',
 saBasicAmount:'37,700',saBasicTax:'7,540',saHigherAmount:'1,850',saHigherTax:'740',
 saAdditionalAmount:'0',saAdditionalTax:'0',
 saDivOrdAmount:'7,500',saDivOrdTax:'656',saDivUpperAmount:'0',saDivUpperTax:'0',
 saDivAddAmount:'0',saDivAddTax:'0',saTotalIncomeTax:'8,936',
 saClass2:'179',saClass4:'0',saTotalLiability:'9,115',
 saPayeDeducted:'6,486',saPoaMade:'0',saBalanceDue:'2,629',
 saPoa1:'4,558',saPoa2:'4,557',
 // CT600 defaults
 ctTurnover:'420,000',ctCogs:'168,000',ctGrossProfit:'252,000',ctAdmin:'180,000',
 ctOtherIncome:'0',ctOperatingProfit:'72,000',ctInterestRec:'250',ctInterestPay:'1,200',
 ctPbt:'71,050',ctDepreciation:'14,000',ctEntertainment:'1,800',ctDisallowedLegal:'0',
 ctOtherDisallow:'0',ctCapAllowances:'18,000',ctRdUplift:'0',ctLossesBfwd:'0',
 ctTaxableProfit:'68,850',ctAugmentedProfits:'68,850',ctAssociated:'0',
 ctLowerLimit:'50,000',ctUpperLimit:'250,000',
 ctSmallRateTax:'0',ctMainRateTax:'17,213',ctMarginalRelief:'2,718',ctPaidInstalments:'0',
 ctBalancePayable:'14,495',ctLossesOpening:'0',ctLossArising:'0',ctLossesUtilised:'0',
 ctLossesSurrendered:'0',ctLossesCfwd:'0',
 // VAT
 vatPeriod:'Q4 2025-26',vatPeriodStart:'1 January 2026',vatPeriodEnd:'31 March 2026',
 vatDueDate:'7 May 2026',
 vatBox1:'24,800',vatBox2:'0',vatBox3:'24,800',vatBox4:'8,420',vatBox5:'16,380',
 vatBox6:'124,000',vatBox7:'42,100',vatBox8:'0',vatBox9:'0',
 vatSalesLedger:'124,000',vatAdjustments:'0',vatRates:'standard 20%',vatFrPercent:'14.5',vatFrTurnover:'148,800',
 // Management accounts
 mgmtPeriod:'Q3 2025-26',
 mgmtRevPeriod:'112,000',mgmtRevYtd:'318,000',mgmtRevPriorYtd:'298,000',mgmtRevVarPct:'+6.7',
 mgmtCogsPeriod:'44,800',mgmtCogsYtd:'127,200',mgmtCogsPriorYtd:'124,200',
 mgmtGpPeriod:'67,200',mgmtGpYtd:'190,800',mgmtGpPriorYtd:'173,800',
 mgmtGmPeriod:'60.0',mgmtGmYtd:'60.0',mgmtGmPriorYtd:'58.3',
 mgmtOverheadsPeriod:'48,200',mgmtOverheadsYtd:'139,400',mgmtOverheadsPriorYtd:'132,100',
 mgmtNetPeriod:'19,000',mgmtNetYtd:'51,400',mgmtNetPriorYtd:'41,700',
 mgmtNmPeriod:'17.0',mgmtNmYtd:'16.2',mgmtNmPriorYtd:'14.0',
 mgmtFixed:'42,000',mgmtFixedPrior:'48,000',mgmtStock:'8,400',mgmtStockPrior:'9,100',
 mgmtDebtors:'68,300',mgmtDebtorsPrior:'71,200',mgmtCash:'92,400',mgmtCashPrior:'74,600',
 mgmtCurrentAssets:'169,100',mgmtCurrentAssetsPrior:'154,900',
 mgmtCreditors:'31,200',mgmtCreditorsPrior:'34,800',mgmtTaxDue:'18,600',mgmtTaxDuePrior:'14,200',
 mgmtOtherCreditors:'4,200',mgmtOtherCreditorsPrior:'3,900',
 mgmtCurrentLiabilities:'54,000',mgmtCurrentLiabilitiesPrior:'52,900',
 mgmtNca:'115,100',mgmtNcaPrior:'102,000',mgmtLtDebt:'0',mgmtLtDebtPrior:'0',
 mgmtNetAssets:'157,100',mgmtNetAssetsPrior:'150,000',
 mgmtCashMovement:'+17,800',mgmtDebtorDays:'55',mgmtCreditorDays:'30',
 mgmtQuickRatio:'3.0',mgmtCurrentRatio:'3.1',mgmtCashProj:'108,000',
 mgmtRevGrowth:'+6.7',mgmtRevGrowthTarget:'+10',mgmtGmTarget:'60',mgmtNmTarget:'18',mgmtRunway:'14',
 mgmtCommentary:'Revenue is tracking 6.7% ahead of the prior year. Gross margin improvement of 1.7pts reflects a more profitable client mix. Debtor days have crept up from 48 to 55 — recommend chasing the top 3 overdue balances. Cash position remains strong with 14 months runway at current overhead.',
 // Year-end
 yeTurnover:'420,000',yeGrossProfit:'252,000',yePbt:'71,050',yeCt:'14,495',yePat:'56,555',
 yeNetAssets:'157,100',yeCash:'92,400',yeDividends:'30,000',yeDirectorSalary:'12,570',
 yeAccountsDue,yeCs01Due,yeOptimalSalary:'12,570',yeAiaUsed:'45,000',
 yeRecommendations:'1. Use full ISA allowance (£20,000) for the director where personal cash allows.\n2. Review pension contribution strategy — employer contributions of up to £60,000 (subject to taper) are CT-deductible.\n3. Consider declaring an interim dividend before 5 April to use the basic-rate band.\n4. R&D claim: review developer time against the merged scheme criteria.',
 // R&D
 rdTrade:'Software development',rdSizeCategory:'SME (post-merged-scheme RDEC)',rdStaffCount:'4',rdProjectCount:'1',
 rdCompanyContext:'The company develops bespoke SaaS analytics tooling for UK accountancy firms. The R&D activity in the period related to a single project described below.',
 rdField:'distributed query optimisation for browser-native IndexedDB',
 rdBaseline:'Published literature on browser IndexedDB query performance addresses single-key lookups and simple range scans. There is no readily available solution for executing federated joins across multiple IDB databases in a single browser context with sub-100ms latency at scale.',
 rdProjectName:'Cross-store IDB query engine',
 rdAdvance:'A query planner and execution engine that performs cost-based join ordering across multiple IndexedDB object stores in a single browser tab, achieving sub-100ms latency on joins of 10,000+ rows.',
 rdAdvanceWhy:'no off-the-shelf approach exists; it required derivation of a cost model adapted to the asynchronous and transactional constraints of the IndexedDB API.',
 rdUncertainty:'1. Whether a join could be executed within a single IDB transaction without blocking UI.\n2. Whether a hash-join could be evicted from main memory to disk via IDB without re-incurring serialisation cost.\n3. Whether the cost model could be calibrated reliably across browsers (Chrome / Firefox / Safari) with materially different IDB implementations.',
 rdResolution:'A series of prototypes were built, instrumented and benchmarked across browsers. The team iterated through three join strategies (nested-loop, sort-merge, hash-with-spill) before arriving at a hybrid hash-with-IDB-spill design that met the latency target on all three engines. Failed prototypes are preserved in the source control history.',
 rdStaffCosts:'82,400',rdEpw:'0',rdSubcontract:'12,000',rdSoftware:'1,800',rdConsumables:'600',rdCloud:'2,400',rdQualifying:'99,200',
 rdRdecGross:'19,840',rdRdecCtNotional:'3,770',rdNetBenefit:'16,070',
 rdSmeEnhanced:'85,312',rdSmeCredit:'12,370',rdSmeCashCredit:'12,370',
 // Payslip
 psEmployeeName:'Jane Smith',psPayrollNo:'001',psNino:'AB123456C',psTaxCode:'1257L',
 psPeriod:'Month 09 · December 2025',psPayDate:'31 December 2025',
 psBasicHours:'160',psBasicRate:'20.00',psBasic:'3,200.00',
 psOtHours:'0',psOtRate:'30.00',psOt:'0.00',psBonus:'0.00',psHoliday:'0.00',psOther:'0.00',
 psGross:'3,200.00',psPaye:'376.00',psEeNi:'196.16',psPensionEePct:'5',psPensionEe:'160.00',
 psSlPlan:'Plan 2',psStudentLoan:'42.00',psPgLoan:'0.00',psOtherDed:'0.00',psTotalDed:'774.16',
 psNet:'2,425.84',psErNi:'305.36',psPensionErPct:'3',psPensionEr:'96.00',psAppLevy:'0.00',
 psTotalCost:'3,601.36',
 psYtdGross:'28,800',psYtdPaye:'3,384',psYtdEeNi:'1,765',psYtdPensionEe:'1,440',psYtdNet:'21,832',
 // P60
 p60EmployeeName:'Jane Smith',p60Nino:'AB123456C',p60FinalCode:'1257L',p60Left:'—',
 p60Pay:'38,400.00',p60Tax:'4,512.00',p60PrevPay:'0',p60PrevTax:'0',
 p60TotalPay:'38,400.00',p60TotalTax:'4,512.00',
 p60NiCat:'A',p60NiLel:'6,396',p60NiLelPt:'5,879',p60NiPtUel:'25,725',p60EeNi:'2,058',
 p60Smp:'0',p60Spp:'0',p60Sap:'0',p60Shpp:'0',p60Snp:'0',
 p60StudentLoan:'504',p60PgLoan:'0',
 // P11D
 p11dEmployeeName:'Marcus Osei',p11dNino:'AB123456C',p11dJobTitle:'Director',p11dDirector:'Yes',
 p11dCarListPrice:'42,000',p11dCarCo2:'48',p11dCarPct:'13',p11dCarBenefit:'5,460',
 p11dFuelBenefit:'0',p11dVanBenefit:'0',p11dVanFuelBenefit:'0',p11dLoanAvg:'15,000',
 p11dOir:'2.25',p11dInterestCharged:'0',p11dLoanBenefit:'338',p11dMedical:'1,200',
 p11dAccommodation:'0',p11dMobiles:'0',p11dVouchers:'0',p11dAssetTransfers:'0',
 p11dExpenses:'0',p11dOther:'0',p11dOtherTotal:'0',p11dTotalBenefits:'6,998',p11dClass1A:'966',
 // Dividend
 divShareholderName:'Marcus Osei',divShareholderAddress:'12 Granary Square, London N1C 4AA',
 divShareClass:'Ordinary £1',divSharesHeld:'100',divPerShare:'150.00',
 divDeclared:'31 December 2025',divPaid:'31 December 2025',divAmount:'15,000.00',
 // DLA
 dlaDirectorName:'Marcus Osei',dlaOpening:'0',
 dlaDate1:'15 June 2025',dlaDesc1:'Cash withdrawal',dlaDebit1:'5,000',dlaCredit1:'0',dlaBal1:'5,000',
 dlaDate2:'30 September 2025',dlaDesc2:'Salary credit',dlaDebit2:'0',dlaCredit2:'3,000',dlaBal2:'2,000',
 dlaDate3:'15 December 2025',dlaDesc3:'Cash withdrawal',dlaDebit3:'9,500',dlaCredit3:'0',dlaBal3:'11,500',
 dlaClosing:'11,500',dlaOverdrawnYn:'overdrawn',dlaMaxOverdrawn:'11,500',dlaAvg:'6,200',
 dlaS455Outstanding:'11,500',dlaS455Charge:'3,881',
 dlaS455DueDate:fmtDate(new Date(addMonths(yeDate,9).getTime()+86400000)),
 dlaBik:'259',
 dlaRecommendation:'Repay the overdrawn balance before 9 months and 1 day after the period end to avoid the s.455 charge. If repayment is not feasible, declare a dividend (subject to distributable reserves) or bonus to clear the balance.',
 // Disengagement
 disengageEngagementDate:'1 April 2024',disengageEffectiveDate:fmtDate(addMonths(new Date(),1)),
 disengageReason:'mutual agreement following changes in the client\'s service requirements',
 disengageWorkDone:'- Annual accounts for the year ended {{client.accountingPeriodEnd}}\n- CT600 corporation tax return for the same period\n- VAT returns up to and including {{ctx.vatPeriod}}',
 disengageOutstanding:'- Self Assessment for the director (2025-26)\n- Confirmation statement (CS01) due in {{ctx.yeCs01Due}}',
 disengageFeesOutstanding:'0',
 // Fee quote
 quoteRef:'FQ-'+(client.id||'demo').slice(-6).toUpperCase()+'-'+new Date().toISOString().slice(0,10),
 quoteValidUntil:fmtDate(new Date(Date.now()+30*86400000)),
 quotePeriod:'12 months from engagement',
 quoteScope:'- Annual statutory accounts (FRS 102 1A)\n- Corporation tax return (CT600) with iXBRL-tagged accounts\n- Quarterly VAT returns (MTD)\n- Monthly payroll for up to 3 employees + RTI\n- Director\'s Self Assessment\n- Companies House confirmation statement (CS01)\n- Year-round email/telephone support',
 quoteFeeAccounts:'1,200',quoteFeeCt:'400',quoteFeeVat:'600',quotePayrollHeads:'3',quoteFeePayroll:'480',
 quoteFeeSa:'250',quoteBookkeepingFreq:'monthly bookkeeping (Xero)',quoteFeeBookkeeping:'1,440',
 quoteFeeCs01:'150',quoteFeeTotal:'4,520',quoteFeeMonthly:'377',
 quoteAssumptions:'1. Annual turnover < £500,000.\n2. Up to 3 employees on payroll, no complex BIKs.\n3. Records provided in digital form (Xero / QuickBooks / spreadsheet).\n4. No HMRC enquiry, group reorganisation, or extraordinary transactions in the period.\n5. Single shareholder / director company with simple capital structure.',
 };
 const compute=state.ui.fallbooksCompute||{};
 const ctx=Object.assign(ctxDefault,state.ui.extraContext||{},extra||{},compute.ctx||{});
 return {client:clientCopy, firm, adviser, engagement:client.engagement||{type:'ongoing',feeBasis:'fixed-monthly',feeAmount:250,feeFrequency:'month',nextReviewDue:fmtDate(new Date(Date.now()+365*86400000))}, ctx, today, taxYear};
}
function interpolate(body,ctx){
 return body.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g,function(_,path){
 const v=getPath(ctx,path);
 if(v==null||v==='')return '<span class="placeholder-empty">{{'+path+'}}</span>';
 if(Array.isArray(v))return v.join(', ');
 return String(v);
 });
}
function inlineMd(s){return s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/_([^_]+)_/g,'<em>$1</em>')}
function md2html(s){
 if(!s)return '';
 s=s.replace(/\[SIGNATURE_BLOCK\]/g,'<div class="sig-block"><div><div class="sig-line"></div>Signed (client)<br>Date: ________________</div><div><div class="sig-line"></div>Signed (firm)<br>Date: ________________</div></div>');
 s=s.replace(/(^\|.+\|$\n?){2,}/gm,function(block){
 const lines=block.trim().split('\n');
 if(lines.length<2)return block;
 const headers=lines[0].split('|').slice(1,-1).map(c=>c.trim());
 const align=lines[1].split('|').slice(1,-1).map(c=>c.trim().endsWith(':')?'right':'left');
 const rows=lines.slice(2).map(l=>l.split('|').slice(1,-1).map(c=>c.trim()));
 const ths=headers.map((h,i)=>'<th style="text-align:'+align[i]+'">'+inlineMd(h)+'</th>').join('');
 const trs=rows.map(r=>'<tr>'+r.map((c,i)=>'<td style="text-align:'+(align[i]||'left')+'">'+inlineMd(c)+'</td>').join('')+'</tr>').join('');
 return '<table><thead><tr>'+ths+'</tr></thead><tbody>'+trs+'</tbody></table>';
 });
 const lines=s.split('\n');
 let html='';let inList=null;
 for(let i=0;i<lines.length;i++){
 const ln=lines[i];
 const mUl=ln.match(/^\s*[-*]\s+(.*)$/);
 const mOl=ln.match(/^\s*\d+\.\s+(.*)$/);
 const mH2=ln.match(/^##\s+(.*)$/);
 if(mH2){if(inList){html+='</'+inList+'>';inList=null}html+='<h3>'+inlineMd(mH2[1])+'</h3>'}
 else if(mUl){if(inList!=='ul'){if(inList)html+='</'+inList+'>';html+='<ul>';inList='ul'}html+='<li>'+inlineMd(mUl[1])+'</li>'}
 else if(mOl){if(inList!=='ol'){if(inList)html+='</'+inList+'>';html+='<ol>';inList='ol'}html+='<li>'+inlineMd(mOl[1])+'</li>'}
 else{
 if(inList){html+='</'+inList+'>';inList=null}
 if(ln.trim()==='')html+='';
 else if(ln.trim().startsWith('<'))html+=ln;
 else html+='<p>'+inlineMd(ln)+'</p>';
 }
 }
 if(inList)html+='</'+inList+'>';
 return html;
}
function renderTemplate(tplId,clientId,extra){
 const tpl=state.templates.find(t=>t.id===tplId);
 if(!tpl)return {html:'',markdown:'',missing:[]};
 const ctx=buildContext(clientId,extra);
 const overrides=(state.ui.sectionOverrides||{})[tplId]||{};
 let html='<h1>'+esc(tpl.name)+'</h1>';
 html+='<div class="doc-meta">'+esc(tpl.cobs||'')+' · '+esc(ctx.today)+' · '+esc(state.firm?state.firm.name:'')+'</div>';
 let md='# '+tpl.name+'\n\n_'+(tpl.cobs||'')+' · '+ctx.today+'_\n\n';
 const missing=[];
 for(const sec of tpl.sections){
 if(sec.requiredFields){
 for(const f of sec.requiredFields){
 const v=getPath(ctx,f);
 if(v==null||v==='')missing.push(f);
 }
 }
 const rawBody=overrides[sec.id]!=null?overrides[sec.id]:sec.body;
 const interp=interpolate(rawBody,ctx);
 const sechtml=md2html(interp);
 if(sec.heading)html+='<h2>'+esc(sec.heading)+'</h2>';
 if(sec.locked)html+='<div class="clause-locked">'+sechtml+'</div>';
 else html+=sechtml;
 if(sec.heading)md+='## '+sec.heading+'\n\n';
 md+=interp.replace(/<[^>]+>/g,'')+'\n\n';
 }
 return {html, markdown:md, missing};
}

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { TOOLNAME };
export { VERSION };
