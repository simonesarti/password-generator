/* UI wiring for the password generator. */
(function () {
  'use strict';

  const PWG = window.PWG;
  const SETTINGS_KEY = 'pwg:settings:v1';
  const THEME_KEY = 'pwg:theme';
  const HISTORY_MAX = 20;
  const MODES = ['password', 'passphrase', 'pin'];
  const MODE_LABELS = { password: 'Password', passphrase: 'Passphrase', pin: 'PIN' };

  const $ = (id) => document.getElementById(id);

  /* ---------- storage (settings and theme only, never generated values) ---------- */

  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    },
  };

  function defaultSettings() {
    return {
      mode: 'password',
      password: Object.assign({}, PWG.DEFAULTS.password),
      passphrase: Object.assign({}, PWG.DEFAULTS.passphrase),
      pin: Object.assign({}, PWG.DEFAULTS.pin),
    };
  }

  function loadSettings() {
    const s = defaultSettings();
    try {
      const saved = JSON.parse(storage.get(SETTINGS_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        if (MODES.includes(saved.mode)) s.mode = saved.mode;
        MODES.forEach((m) => {
          if (!saved[m] || typeof saved[m] !== 'object') return;
          Object.keys(s[m]).forEach((k) => {
            if (typeof saved[m][k] === typeof s[m][k]) s[m][k] = saved[m][k];
          });
        });
      }
    } catch (e) { /* corrupted settings: use defaults */ }
    return s;
  }

  const settings = loadSettings();
  const saveSettings = () => storage.set(SETTINGS_KEY, JSON.stringify(settings));

  /* ---------- control bindings ---------- */

  // Each entry maps an input to a settings field.
  const BINDINGS = [
    { id: 'pw-length', range: 'pw-length-range', mode: 'password', key: 'length', type: 'int', limits: PWG.LIMITS.passwordLength },
    { id: 'pw-upper', mode: 'password', key: 'upper', type: 'bool', charType: true },
    { id: 'pw-lower', mode: 'password', key: 'lower', type: 'bool', charType: true },
    { id: 'pw-digits', mode: 'password', key: 'digits', type: 'bool', charType: true },
    { id: 'pw-symbols', mode: 'password', key: 'symbols', type: 'bool', charType: true },
    { id: 'pw-ambiguous', mode: 'password', key: 'avoidAmbiguous', type: 'bool' },
    { id: 'pw-min-digits', mode: 'password', key: 'minDigits', type: 'int', limits: PWG.LIMITS.minCount },
    { id: 'pw-min-symbols', mode: 'password', key: 'minSymbols', type: 'int', limits: PWG.LIMITS.minCount },
    { id: 'pw-symbol-set', mode: 'password', key: 'symbolSet', type: 'text' },
    { id: 'pw-exclude', mode: 'password', key: 'exclude', type: 'text' },
    { id: 'pp-words', range: 'pp-words-range', mode: 'passphrase', key: 'words', type: 'int', limits: PWG.LIMITS.words },
    { id: 'pp-separator', mode: 'passphrase', key: 'separator', type: 'text' },
    { id: 'pp-capitalize', mode: 'passphrase', key: 'capitalize', type: 'bool' },
    { id: 'pp-number', mode: 'passphrase', key: 'includeNumber', type: 'bool' },
    { id: 'pin-length', range: 'pin-length-range', mode: 'pin', key: 'length', type: 'int', limits: PWG.LIMITS.pinLength },
  ];

  const clamp = (n, [min, max]) => Math.min(max, Math.max(min, n));

  // Password length can't go below the sum of the per-type minimums.
  function limitsFor(b) {
    if (b.id === 'pw-length') {
      return [PWG.minPasswordLength(settings.password), b.limits[1]];
    }
    return b.limits;
  }

  function applyLimits(b) {
    const [min, max] = limitsFor(b);
    const el = $(b.id);
    el.setAttribute('aria-valuemin', String(min));
    el.setAttribute('aria-valuemax', String(max));
    el.setAttribute('aria-valuenow', String(settings[b.mode][b.key]));
    if (b.range) {
      const r = $(b.range);
      r.min = String(min);
      r.max = String(max);
      r.step = '1';
    }
  }

  // Keep only digits and drop leading zeros ("045" -> "45", "0" -> "").
  const cleanDigits = (s) => s.replace(/\D/g, '').replace(/^0+/, '');

  function setRangeFill(rangeEl) {
    const min = Number(rangeEl.min);
    const max = Number(rangeEl.max);
    const pct = ((Number(rangeEl.value) - min) / (max - min)) * 100;
    rangeEl.style.setProperty('--fill', pct + '%');
  }

  function renderControls() {
    BINDINGS.forEach((b) => {
      const el = $(b.id);
      const value = settings[b.mode][b.key];
      if (b.limits) applyLimits(b);
      if (b.type === 'bool') el.checked = value;
      else if (el.value !== String(value)) el.value = String(value);
      if (b.range) {
        const r = $(b.range);
        r.value = String(value);
        setRangeFill(r);
      }
    });
    const p = settings.password;
    $('pw-min-digits').disabled = !p.digits;
    $('pw-min-symbols').disabled = !p.symbols;
    $('pw-symbol-set').disabled = !p.symbols;
    const preview = Array.from(p.symbolSet).filter((c) => c.trim()).join('');
    $('pw-symbols-preview').textContent = preview.length > 10 ? preview.slice(0, 10) + '…' : preview || 'none';
  }

  function onChange() {
    saveSettings();
    renderControls();
    generate();
  }

  function bindControls() {
    BINDINGS.forEach((b) => {
      const el = $(b.id);
      el.setAttribute('autocomplete', 'off');

      if (b.type === 'bool') {
        el.addEventListener('change', () => {
          if (b.charType && !el.checked) {
            const others = BINDINGS.filter((o) => o.charType && o !== b).some((o) => settings.password[o.key]);
            if (!others) {
              el.checked = true;
              toast('At least one character type is required');
              return;
            }
          }
          settings[b.mode][b.key] = el.checked;
          onChange();
        });
      } else if (b.type === 'int') {
        const commit = (raw, strict) => {
          const n = parseInt(raw, 10);
          if (Number.isNaN(n)) {
            if (strict) renderControls();
            return;
          }
          const clamped = clamp(n, limitsFor(b));
          if (!strict && clamped !== n) return; // still typing, e.g. "1" on the way to "16"
          if (clamped === settings[b.mode][b.key]) {
            // Nothing changed (e.g. slider pushed past its limit): snap the
            // controls back, but keep the current value instead of regenerating.
            if (strict) renderControls();
            return;
          }
          settings[b.mode][b.key] = clamped;
          onChange();
        };
        el.addEventListener('input', () => {
          const cleaned = cleanDigits(el.value);
          if (cleaned !== el.value) {
            // Keep the caret where it was relative to the remaining digits.
            const caret = cleanDigits(el.value.slice(0, el.selectionStart ?? el.value.length)).length;
            el.value = cleaned;
            el.setSelectionRange(caret, caret);
          }
          commit(cleaned, false);
        });
        el.addEventListener('change', () => commit(el.value, true));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            commit(el.value, true);
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = e.key === 'ArrowUp' ? 1 : -1;
            commit(String(settings[b.mode][b.key] + step), true);
          }
        });
        if (b.range) {
          $(b.range).addEventListener('input', (e) => commit(e.target.value, true));
        }
      } else {
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, () => {
          settings[b.mode][b.key] = el.value;
          saveSettings();
          // Don't re-render text inputs while typing (would move the caret).
          if (el.tagName === 'SELECT') renderControls();
          else $('pw-symbols-preview').textContent = Array.from(el.value).filter((c) => c.trim()).slice(0, 10).join('') || 'none';
          generate();
        });
      }
    });

    $('pw-reset').addEventListener('click', () => {
      settings.password = Object.assign({}, PWG.DEFAULTS.password);
      onChange();
      toast('Password options reset');
    });
  }

  /* ---------- tabs ---------- */

  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

  function setMode(mode, focus) {
    settings.mode = mode;
    tabs.forEach((t) => {
      const active = t.dataset.mode === mode;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      if (active && focus) t.focus();
    });
    MODES.forEach((m) => { $('panel-' + m).hidden = m !== mode; });
    saveSettings();
    generate();
  }

  function bindTabs() {
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => setMode(t.dataset.mode, false));
      t.addEventListener('keydown', (e) => {
        let next = null;
        if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next !== null) {
          e.preventDefault();
          setMode(tabs[next].dataset.mode, true);
        }
      });
    });
  }

  /* ---------- generation + rendering ---------- */

  let current = null;
  const resultEl = $('result');
  const copyBtn = $('copy');

  function charClass(ch) {
    if (ch >= '0' && ch <= '9') return 'c-digit';
    if (/\p{L}/u.test(ch)) return null;
    if (ch === ' ') return 'c-space';
    return 'c-symbol';
  }

  function renderValue(value) {
    const frag = document.createDocumentFragment();
    let run = '';
    const flush = () => {
      if (run) frag.appendChild(document.createTextNode(run));
      run = '';
    };
    for (const ch of value) {
      const cls = charClass(ch);
      if (!cls) { run += ch; continue; }
      flush();
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = ch;
      frag.appendChild(span);
    }
    flush();
    resultEl.replaceChildren(frag);
    const len = Array.from(value).length;
    resultEl.dataset.size = len > 72 ? 'xs' : len > 40 ? 'sm' : 'md';
  }

  function renderStrength(entropy) {
    const s = PWG.assessStrength(entropy);
    $('strength').dataset.score = String(s.score);
    $('strength-label').textContent = s.label;
    const bits = Math.round(entropy);
    const detail = settings.mode === 'pin'
      ? `${bits} bits · only safe where wrong attempts are limited`
      : `${bits} bits · ${s.crackTime} to crack`;
    $('strength-detail').textContent = detail;
  }

  function renderError(message) {
    current = null;
    resultEl.replaceChildren(document.createTextNode(message));
    resultEl.dataset.size = 'error';
    $('strength').dataset.score = 'none';
    $('strength-label').textContent = '';
    $('strength-detail').textContent = '';
    copyBtn.disabled = true;
  }

  function generate() {
    try {
      let r;
      if (settings.mode === 'password') {
        r = PWG.generatePassword(settings.password);
        if (r.length !== settings.password.length) {
          // Minimums didn't fit; length was raised (like Bitwarden does).
          settings.password.length = r.length;
          saveSettings();
          renderControls();
        }
      } else if (settings.mode === 'passphrase') {
        r = PWG.generatePassphrase(settings.passphrase);
      } else {
        r = PWG.generatePin(settings.pin);
      }
      current = { value: r.value, mode: settings.mode };
      copyBtn.disabled = false;
      resetCopyButton();
      resultEl.dataset.mode = settings.mode;
      renderValue(r.value);
      renderStrength(r.entropy);
    } catch (err) {
      renderError(err instanceof PWG.GeneratorError ? err.message : 'Something went wrong. Please reload the page.');
      if (!(err instanceof PWG.GeneratorError)) console.error(err);
    }
  }

  /* ---------- clipboard ---------- */

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall through to legacy copy */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'offscreen';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  let copyResetTimer = 0;

  function resetCopyButton() {
    clearTimeout(copyResetTimer);
    $('copy-label').textContent = 'Copy';
    copyBtn.classList.remove('is-copied');
  }

  async function copyCurrent() {
    if (!current) return;
    const ok = await copyText(current.value);
    if (!ok) {
      toast('Copy failed. Select the text and copy it manually.');
      return;
    }
    addToHistory(current.value, current.mode);
    $('copy-label').textContent = 'Copied';
    copyBtn.classList.add('is-copied');
    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(resetCopyButton, 1600);
    toast('Copied to clipboard');
  }

  /* ---------- history (in memory only) ---------- */

  const history = [];

  function addToHistory(value, mode) {
    const existing = history.findIndex((h) => h.value === value);
    if (existing !== -1) history.splice(existing, 1);
    history.unshift({ value, mode, time: new Date() });
    history.length = Math.min(history.length, HISTORY_MAX);
    renderHistory();
  }

  function renderHistory() {
    const list = $('history-list');
    const frag = document.createDocumentFragment();
    history.forEach((h) => {
      const li = document.createElement('li');

      const text = document.createElement('div');
      text.className = 'history-text';
      const code = document.createElement('code');
      code.textContent = h.value;
      const meta = document.createElement('span');
      meta.className = 'history-meta';
      meta.textContent = `${MODE_LABELS[h.mode]} · ${h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      text.append(code, meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-btn';
      btn.setAttribute('aria-label', 'Copy ' + MODE_LABELS[h.mode].toLowerCase() + ' again');
      btn.title = 'Copy';
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>';
      btn.addEventListener('click', async () => {
        toast((await copyText(h.value)) ? 'Copied to clipboard' : 'Copy failed');
      });

      li.append(text, btn);
      frag.appendChild(li);
    });
    list.replaceChildren(frag);
    $('history-empty').hidden = history.length > 0;
    $('history-clear').hidden = history.length === 0;
  }

  /* ---------- toast ---------- */

  let toastTimer = 0;
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2000);
  }

  /* ---------- theme ---------- */

  function effectiveTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function renderThemeButton() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    $('theme-toggle').setAttribute('aria-label', `Switch to ${next} theme`);
  }

  function bindTheme() {
    $('theme-toggle').addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      storage.set(THEME_KEY, next);
      renderThemeButton();
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderThemeButton);
    renderThemeButton();
  }

  /* ---------- init ---------- */

  function init() {
    bindControls();
    bindTabs();
    bindTheme();
    renderControls();

    $('regenerate').addEventListener('click', () => {
      generate();
      const icon = $('regenerate');
      icon.classList.remove('is-spinning');
      void icon.offsetWidth; // restart animation
      icon.classList.add('is-spinning');
    });
    copyBtn.addEventListener('click', copyCurrent);
    $('history-clear').addEventListener('click', () => {
      history.length = 0;
      renderHistory();
    });

    setMode(settings.mode, false);
    renderHistory();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('preload');
    }));
  }

  init();
})();
