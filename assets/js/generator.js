/*
 * Password generator core.
 * Pure logic, no DOM access, so it can be unit-tested in Node.
 * All randomness comes from crypto.getRandomValues (CSPRNG) with
 * rejection sampling, so there is no modulo bias.
 */
(function (global) {
  'use strict';

  const CHARSETS = Object.freeze({
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
  });
  const DEFAULT_SYMBOLS = '!@#$%^&*-_+=?';
  const AMBIGUOUS_CHARS = '0O1lI|';

  const SEPARATORS = Object.freeze({
    hyphen: '-',
    space: ' ',
    period: '.',
    comma: ',',
    underscore: '_',
    none: '',
  });
  // Separators drawn at random for each gap between words.
  const RANDOM_SEPARATORS = Object.freeze({
    digits: '0123456789',
    digitsSymbols: '0123456789' + DEFAULT_SYMBOLS,
  });

  const LIMITS = Object.freeze({
    passwordLength: [5, 128],
    minCount: [1, 9],
    words: [3, 20],
    pinLength: [4, 12],
  });

  const DEFAULTS = Object.freeze({
    password: Object.freeze({
      length: 20,
      upper: true,
      lower: true,
      digits: true,
      symbols: true,
      minDigits: 1,
      minSymbols: 1,
      avoidAmbiguous: false,
      symbolSet: DEFAULT_SYMBOLS,
      exclude: '',
    }),
    passphrase: Object.freeze({
      words: 5,
      separator: 'hyphen',
      capitalize: true,
      includeNumber: true,
    }),
    pin: Object.freeze({
      length: 6,
    }),
  });

  // Average-case offline attack: 10 billion guesses per second.
  const GUESSES_PER_SECOND = 1e10;

  class GeneratorError extends Error {
    constructor(message) {
      super(message);
      this.name = 'GeneratorError';
    }
  }

  /* ---------- randomness ---------- */

  function getCrypto() {
    const c = global.crypto;
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new GeneratorError('This browser does not provide a secure random number generator.');
    }
    return c;
  }

  const UINT32_RANGE = 0x100000000;

  /** Uniform random integer in [0, max). */
  function randomInt(max) {
    if (!Number.isInteger(max) || max < 1 || max > UINT32_RANGE) {
      throw new RangeError('randomInt: max must be an integer in [1, 2^32]');
    }
    const c = getCrypto();
    const limit = UINT32_RANGE - (UINT32_RANGE % max);
    const buf = new Uint32Array(1);
    for (;;) {
      c.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % max;
    }
  }

  function pick(list) {
    return list[randomInt(list.length)];
  }

  /** In-place Fisher–Yates shuffle. */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ---------- helpers ---------- */

  function uniqueChars(str) {
    return Array.from(new Set(Array.from(str || '')));
  }

  function clampInt(value, [min, max], fallback) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /* ---------- password ---------- */

  function normalizePasswordOptions(opts) {
    const d = DEFAULTS.password;
    const o = Object.assign({}, d, opts);
    return {
      length: clampInt(o.length, LIMITS.passwordLength, d.length),
      upper: Boolean(o.upper),
      lower: Boolean(o.lower),
      digits: Boolean(o.digits),
      symbols: Boolean(o.symbols),
      minDigits: clampInt(o.minDigits, LIMITS.minCount, d.minDigits),
      minSymbols: clampInt(o.minSymbols, LIMITS.minCount, d.minSymbols),
      avoidAmbiguous: Boolean(o.avoidAmbiguous),
      symbolSet: typeof o.symbolSet === 'string' ? o.symbolSet : d.symbolSet,
      exclude: typeof o.exclude === 'string' ? o.exclude : '',
    };
  }

  function buildPools(o) {
    const blocked = new Set(Array.from(o.exclude));
    if (o.avoidAmbiguous) Array.from(AMBIGUOUS_CHARS).forEach((ch) => blocked.add(ch));
    const usable = (s) => uniqueChars(s).filter((ch) => !blocked.has(ch) && ch.trim() !== '');

    const pools = [];
    if (o.upper) pools.push({ key: 'upper', chars: usable(CHARSETS.upper), min: 1 });
    if (o.lower) pools.push({ key: 'lower', chars: usable(CHARSETS.lower), min: 1 });
    if (o.digits) pools.push({ key: 'digits', chars: usable(CHARSETS.digits), min: o.minDigits });
    if (o.symbols) pools.push({ key: 'symbols', chars: usable(o.symbolSet), min: o.minSymbols });
    return pools;
  }

  /**
   * Shortest length the options allow: the length limit, or the sum of the
   * per-type minimums if that is larger.
   */
  function minPasswordLength(opts) {
    const pools = buildPools(normalizePasswordOptions(opts));
    const required = pools.reduce((sum, p) => sum + p.min, 0);
    return Math.max(LIMITS.passwordLength[0], required);
  }

  /**
   * Random password. Every enabled character type appears at least once
   * (numbers and symbols at least their configured minimum). If the minimums
   * add up to more than the requested length, the length is raised to fit.
   */
  function generatePassword(opts) {
    const o = normalizePasswordOptions(opts);
    const pools = buildPools(o);

    if (pools.length === 0) {
      throw new GeneratorError('Choose at least one character type.');
    }
    const empty = pools.find((p) => p.chars.length === 0);
    if (empty) {
      const names = { upper: 'uppercase letters', lower: 'lowercase letters', digits: 'numbers', symbols: 'symbols' };
      throw new GeneratorError(`No ${names[empty.key]} left to use. Check your symbol and exclusion settings.`);
    }

    const all = uniqueChars(pools.map((p) => p.chars.join('')).join(''));
    const required = pools.reduce((sum, p) => sum + p.min, 0);
    const length = Math.max(o.length, required);

    const chars = [];
    pools.forEach((p) => {
      for (let i = 0; i < p.min; i++) chars.push(pick(p.chars));
    });
    while (chars.length < length) chars.push(pick(all));
    shuffle(chars);

    return {
      value: chars.join(''),
      length,
      poolSize: all.length,
      entropy: length * Math.log2(all.length),
    };
  }

  /* ---------- passphrase ---------- */

  function normalizePassphraseOptions(opts) {
    const d = DEFAULTS.passphrase;
    const o = Object.assign({}, d, opts);
    const validSeparator = o.separator in SEPARATORS || o.separator in RANDOM_SEPARATORS;
    return {
      words: clampInt(o.words, LIMITS.words, d.words),
      separator: validSeparator ? o.separator : d.separator,
      capitalize: Boolean(o.capitalize),
      includeNumber: Boolean(o.includeNumber),
    };
  }

  function generatePassphrase(opts, wordlist) {
    const o = normalizePassphraseOptions(opts);
    const list = wordlist || global.PWG_WORDLIST;
    if (!list || list.length < 2) {
      throw new GeneratorError('The word list failed to load. Please reload the page.');
    }

    let words = [];
    for (let i = 0; i < o.words; i++) words.push(pick(list));
    let entropy = o.words * Math.log2(list.length);

    if (o.capitalize) {
      words = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    }
    if (o.includeNumber) {
      const idx = randomInt(words.length);
      words[idx] += String(randomInt(10));
      entropy += Math.log2(10 * words.length);
    }

    let value;
    if (o.separator in RANDOM_SEPARATORS) {
      const pool = uniqueChars(RANDOM_SEPARATORS[o.separator]);
      value = words.reduce((acc, w, i) => (i === 0 ? w : acc + pick(pool) + w), '');
      entropy += (words.length - 1) * Math.log2(pool.length);
    } else {
      value = words.join(SEPARATORS[o.separator]);
    }

    return { value, length: value.length, entropy };
  }

  /* ---------- PIN ---------- */

  function generatePin(opts) {
    const d = DEFAULTS.pin;
    const length = clampInt(Object.assign({}, d, opts).length, LIMITS.pinLength, d.length);
    const digits = Array.from(CHARSETS.digits);
    let value = '';
    for (let i = 0; i < length; i++) value += pick(digits);
    return { value, length, entropy: length * Math.log2(10) };
  }

  /* ---------- strength ---------- */

  const STRENGTH_LEVELS = Object.freeze([
    { min: 0, score: 0, label: 'Very weak' },
    { min: 28, score: 1, label: 'Weak' },
    { min: 36, score: 2, label: 'Fair' },
    { min: 60, score: 3, label: 'Strong' },
    { min: 100, score: 4, label: 'Very strong' },
  ]);

  function plural(n, unit) {
    return `${n.toLocaleString('en-US')} ${unit}${n === 1 ? '' : 's'}`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds > 4.4e17) return 'longer than the age of the universe';
    if (seconds < 1) return 'less than a second';
    if (seconds < 60) return plural(Math.round(seconds), 'second');
    const minutes = seconds / 60;
    if (minutes < 60) return plural(Math.round(minutes), 'minute');
    const hours = minutes / 60;
    if (hours < 24) return plural(Math.round(hours), 'hour');
    const days = hours / 24;
    if (days < 31) return plural(Math.round(days), 'day');
    if (days < 365.25) return plural(Math.round(days / 30.44), 'month');
    const years = days / 365.25;
    if (years < 1e3) return plural(Math.round(years), 'year');
    if (years < 1e6) return `${Math.round(years / 1e3).toLocaleString('en-US')} thousand years`;
    if (years < 1e9) return `${Math.round(years / 1e6).toLocaleString('en-US')} million years`;
    return `${Math.round(years / 1e9).toLocaleString('en-US')} billion years`;
  }

  /** Strength rating for a given number of bits of entropy. */
  function assessStrength(bits) {
    let level = STRENGTH_LEVELS[0];
    for (const l of STRENGTH_LEVELS) if (bits >= l.min) level = l;
    // Expected time to find it: half the search space.
    const seconds = Math.pow(2, bits - 1) / GUESSES_PER_SECOND;
    return {
      score: level.score,
      label: level.label,
      bits,
      crackTime: formatDuration(seconds),
    };
  }

  const api = Object.freeze({
    generatePassword,
    minPasswordLength,
    generatePassphrase,
    generatePin,
    assessStrength,
    formatDuration,
    randomInt,
    shuffle,
    GeneratorError,
    DEFAULTS,
    LIMITS,
    DEFAULT_SYMBOLS,
    AMBIGUOUS_CHARS,
    GUESSES_PER_SECOND,
  });

  global.PWG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
