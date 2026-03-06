import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Manages signal files used for inter-agent communication.
 *
 * Signal files:
 *   PM_DONE        — PM completed its phase
 *   CODER_DONE     — Coder completed its phase
 *   HUMAN_NEEDED.md — An agent requests human intervention
 *   .commit_msg    — Commit message written by an agent
 */
export class SignalManager {
  #teamDir;
  #projectRoot;

  constructor(projectRoot, teamDir = '.virtual-team') {
    this.#projectRoot = projectRoot;
    this.#teamDir = resolve(projectRoot, teamDir);
  }

  // --- Path helpers ---

  pmDonePath() {
    return resolve(this.#teamDir, 'PM_DONE');
  }

  coderDonePath() {
    return resolve(this.#teamDir, 'CODER_DONE');
  }

  humanNeededPath() {
    return resolve(this.#teamDir, 'HUMAN_NEEDED.md');
  }

  commitMsgPath() {
    return resolve(this.#projectRoot, '.commit_msg');
  }

  // --- Checks ---

  hasPmDone() {
    return existsSync(this.pmDonePath());
  }

  hasCoderDone() {
    return existsSync(this.coderDonePath());
  }

  hasHumanNeeded() {
    return existsSync(this.humanNeededPath());
  }

  hasCommitMsg() {
    return existsSync(this.commitMsgPath());
  }

  // --- Read ---

  readHumanNeeded() {
    if (!this.hasHumanNeeded()) return null;
    return readFileSync(this.humanNeededPath(), 'utf-8');
  }

  readCommitMsg() {
    if (!this.hasCommitMsg()) return null;
    return readFileSync(this.commitMsgPath(), 'utf-8').trim();
  }

  // --- Cleanup ---

  removePmDone() {
    if (this.hasPmDone()) unlinkSync(this.pmDonePath());
  }

  removeCoderDone() {
    if (this.hasCoderDone()) unlinkSync(this.coderDonePath());
  }

  removeCommitMsg() {
    if (this.hasCommitMsg()) unlinkSync(this.commitMsgPath());
  }

  removeHumanNeeded() {
    if (this.hasHumanNeeded()) unlinkSync(this.humanNeededPath());
  }
}
