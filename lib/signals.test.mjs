import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SignalManager } from './signals.mjs';

function makeTmp() {
  const tmp = mkdtempSync(join(tmpdir(), 'vt-sig-'));
  mkdirSync(join(tmp, '.virtual-team'), { recursive: true });
  return tmp;
}

test('SignalManager detects PM_DONE', () => {
  const tmp = makeTmp();
  const signals = new SignalManager(tmp);

  assert.equal(signals.hasPmDone(), false);

  writeFileSync(signals.pmDonePath(), '');
  assert.equal(signals.hasPmDone(), true);

  signals.removePmDone();
  assert.equal(signals.hasPmDone(), false);
});

test('SignalManager detects CODER_DONE', () => {
  const tmp = makeTmp();
  const signals = new SignalManager(tmp);

  assert.equal(signals.hasCoderDone(), false);

  writeFileSync(signals.coderDonePath(), '1.1.1');
  assert.equal(signals.hasCoderDone(), true);

  signals.removeCoderDone();
  assert.equal(signals.hasCoderDone(), false);
});

test('SignalManager reads HUMAN_NEEDED.md', () => {
  const tmp = makeTmp();
  const signals = new SignalManager(tmp);

  assert.equal(signals.readHumanNeeded(), null);

  writeFileSync(signals.humanNeededPath(), '# Help needed\nSomething went wrong');
  assert.equal(signals.hasHumanNeeded(), true);
  assert.ok(signals.readHumanNeeded().includes('Help needed'));
});

test('SignalManager reads and removes .commit_msg', () => {
  const tmp = makeTmp();
  const signals = new SignalManager(tmp);

  assert.equal(signals.readCommitMsg(), null);

  writeFileSync(signals.commitMsgPath(), 'feat: add new feature\n');
  assert.equal(signals.readCommitMsg(), 'feat: add new feature');

  signals.removeCommitMsg();
  assert.equal(signals.hasCommitMsg(), false);
});
