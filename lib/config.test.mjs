import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from './config.mjs';

test('loadConfig returns defaults when no config.json exists', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'vt-test-'));
  const config = loadConfig(tmp);

  assert.equal(config.sleepTime, 600);
  assert.equal(config.errorSleepTime, 300);
  assert.equal(config.stuckLimit, 3);
  assert.equal(config.pmMaxTurns, 45);
  assert.equal(config.coderMaxTurns, 65);
  assert.equal(config.pmModel, 'sonnet');
  assert.equal(config.projectRoot, tmp);
});

test('loadConfig merges user config over defaults', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'vt-test-'));
  const teamDir = join(tmp, '.virtual-team');
  mkdirSync(teamDir, { recursive: true });
  writeFileSync(join(teamDir, 'config.json'), JSON.stringify({ sleepTime: 120, pmMaxTurns: 20 }));

  const config = loadConfig(tmp);

  assert.equal(config.sleepTime, 120);
  assert.equal(config.pmMaxTurns, 20);
  // Defaults preserved for unspecified keys
  assert.equal(config.errorSleepTime, 300);
  assert.equal(config.stuckLimit, 3);
});

test('loadConfig handles invalid JSON gracefully', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'vt-test-'));
  const teamDir = join(tmp, '.virtual-team');
  mkdirSync(teamDir, { recursive: true });
  writeFileSync(join(teamDir, 'config.json'), 'not valid json{{{');

  const config = loadConfig(tmp);
  assert.equal(config.sleepTime, 600); // falls back to default
});
