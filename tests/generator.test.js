// Run with: node --test tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../assets/js/wordlist.js');
const PWG = require('../assets/js/generator.js');
const WORDS = globalThis.PWG_WORDLIST;

const RUNS = 300;
const has = (re) => (s) => re.test(s);

test('wordlist is the full EFF long list', () => {
  assert.equal(WORDS.length, 7776);
  assert.equal(new Set(WORDS).size, 7776);
  assert.ok(WORDS.every((w) => /^[a-z-]+$/.test(w)));
});

test('randomInt stays in range and covers every value', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = PWG.randomInt(7);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 7);
    seen.add(n);
  }
  assert.equal(seen.size, 7);
  assert.throws(() => PWG.randomInt(0), RangeError);
});

test('randomInt is roughly uniform', () => {
  const buckets = new Array(10).fill(0);
  const N = 100000;
  for (let i = 0; i < N; i++) buckets[PWG.randomInt(10)]++;
  buckets.forEach((b) => assert.ok(Math.abs(b - N / 10) < N / 10 * 0.06, `bucket ${b}`));
});

test('default password: length 20 with all four character types', () => {
  for (let i = 0; i < RUNS; i++) {
    const { value } = PWG.generatePassword({});
    assert.equal(value.length, 20);
    assert.ok(has(/[A-Z]/)(value) && has(/[a-z]/)(value) && has(/[0-9]/)(value));
    assert.ok([...value].some((c) => PWG.DEFAULT_SYMBOLS.includes(c)));
  }
});

test('password respects disabled character types', () => {
  for (let i = 0; i < RUNS; i++) {
    const { value } = PWG.generatePassword({ upper: false, digits: false, symbols: false, length: 32 });
    assert.match(value, /^[a-z]{32}$/);
  }
});

test('password honours minimum numbers and symbols', () => {
  for (let i = 0; i < RUNS; i++) {
    const { value } = PWG.generatePassword({ length: 12, minDigits: 4, minSymbols: 3 });
    assert.ok((value.match(/[0-9]/g) || []).length >= 4);
    assert.ok([...value].filter((c) => PWG.DEFAULT_SYMBOLS.includes(c)).length >= 3);
  }
});

test('length is raised when minimums do not fit', () => {
  const r = PWG.generatePassword({ length: 5, minDigits: 9, minSymbols: 9 });
  assert.equal(r.length, 20); // 1 upper + 1 lower + 9 + 9
  assert.equal(r.value.length, 20);
});

test('avoid ambiguous and custom exclusions', () => {
  for (let i = 0; i < RUNS; i++) {
    const { value } = PWG.generatePassword({ length: 64, avoidAmbiguous: true, exclude: 'abcXYZ' });
    assert.doesNotMatch(value, /[0O1lI|abcXYZ]/);
  }
});

test('custom symbol set is used exclusively', () => {
  for (let i = 0; i < RUNS; i++) {
    const { value } = PWG.generatePassword({ length: 40, upper: false, lower: false, digits: false, symbolSet: '#!' });
    assert.match(value, /^[#!]{40}$/);
  }
});

test('length limits are enforced', () => {
  assert.equal(PWG.generatePassword({ length: 1 }).value.length, 5);
  assert.equal(PWG.generatePassword({ length: 999 }).value.length, 128);
  assert.equal(PWG.generatePassword({ length: 'abc' }).value.length, 20);
});

test('errors when nothing usable is selected', () => {
  assert.throws(() => PWG.generatePassword({ upper: false, lower: false, digits: false, symbols: false }), PWG.GeneratorError);
  assert.throws(() => PWG.generatePassword({ symbolSet: '   ' }), PWG.GeneratorError);
});

test('password entropy = length * log2(pool)', () => {
  const r = PWG.generatePassword({ length: 16, symbols: false });
  assert.equal(r.poolSize, 62);
  assert.ok(Math.abs(r.entropy - 16 * Math.log2(62)) < 1e-9);
});

test('default passphrase: 5 capitalised words, hyphens, one digit', () => {
  for (let i = 0; i < RUNS; i++) {
    const { value } = PWG.generatePassphrase({});
    // EFF words may contain hyphens themselves, so check structure loosely.
    assert.match(value, /^[A-Z]/);
    assert.equal((value.match(/[0-9]/g) || []).length, 1);
    assert.ok(value.split('-').length >= 5);
  }
});

test('passphrase options', () => {
  const plain = PWG.generatePassphrase({ words: 4, separator: 'space', capitalize: false, includeNumber: false });
  const parts = plain.value.split(' ');
  assert.equal(parts.length, 4);
  parts.forEach((w) => assert.ok(WORDS.includes(w)));
  assert.ok(Math.abs(plain.entropy - 4 * Math.log2(7776)) < 1e-9);

  const digitsSep = PWG.generatePassphrase({ words: 6, separator: 'digits', capitalize: false, includeNumber: false });
  assert.equal(digitsSep.value.split(/[0-9]/).length, 6);

  const none = PWG.generatePassphrase({ words: 3, separator: 'none' });
  assert.doesNotMatch(none.value, /[ .,_]/);

  assert.equal(PWG.generatePassphrase({ words: 50, separator: 'space', includeNumber: false }).value.split(' ').length, 20);
});

test('PIN is digits only with clamped length', () => {
  for (let i = 0; i < RUNS; i++) assert.match(PWG.generatePin({}).value, /^[0-9]{6}$/);
  assert.equal(PWG.generatePin({ length: 1 }).value.length, 4);
  assert.equal(PWG.generatePin({ length: 40 }).value.length, 12);
});

test('strength scoring and crack time text', () => {
  assert.equal(PWG.assessStrength(20).label, 'Very weak');
  assert.equal(PWG.assessStrength(30).label, 'Weak');
  assert.equal(PWG.assessStrength(50).label, 'Fair');
  assert.equal(PWG.assessStrength(70).label, 'Strong');
  assert.equal(PWG.assessStrength(128).label, 'Very strong');
  assert.equal(PWG.assessStrength(128).crackTime, 'longer than the age of the universe');
  assert.equal(PWG.formatDuration(0.2), 'less than a second');
  assert.equal(PWG.formatDuration(3600 * 3), '3 hours');
  assert.equal(PWG.formatDuration(86400 * 365.25 * 5000), '5 thousand years');
});
