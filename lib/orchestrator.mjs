import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SignalManager } from './signals.mjs';
import { ensureGitRepo, cleanWorkingTree, commitChanges } from './git.mjs';
import { runPM, runCoder } from './agents.mjs';

function sleep(seconds) {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

function hasOpenTasks(goalsPath) {
  if (!existsSync(goalsPath)) return false;
  const content = readFileSync(goalsPath, 'utf-8');
  return /\[TODO\]|\[IN PROGRESS\]/.test(content);
}

/**
 * Run the PM ↔ Coder development loop until all tasks in GOALS.md are done.
 *
 * @param {object} config - Configuration from loadConfig()
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false] - Log actions without executing agents
 * @param {number}  [options.maxCycles]    - Maximum PM→Coder cycles (default: unlimited)
 * @returns {Promise<{status: string, cycles: number}>}
 */
export async function startLoop(config, options = {}) {
  const { dryRun = false, maxCycles = Infinity } = options;
  const { projectRoot, sleepTime, errorSleepTime, stuckLimit } = config;
  const goalsPath = resolve(projectRoot, config.teamDir, 'GOALS.md');
  const signals = new SignalManager(projectRoot, config.teamDir);

  if (!dryRun) {
    ensureGitRepo(projectRoot);
  }

  let consecutiveNoChanges = 0;
  let cycles = 0;

  console.log('Starting virtual team development loop...\n');

  while (cycles < maxCycles) {
    console.log('==================================================');

    // Check for human intervention requests
    if (signals.hasHumanNeeded()) {
      const content = signals.readHumanNeeded();
      console.error('\n[HUMAN NEEDED] The AI team requests human assistance:');
      console.error(content);
      console.error('\nLoop paused. Resolve the issue, remove .virtual-team/HUMAN_NEEDED.md, then restart.');
      return { status: 'human_needed', cycles };
    }

    // Check if all tasks are done
    if (!hasOpenTasks(goalsPath)) {
      console.log('All tasks in GOALS.md are complete!');
      return { status: 'all_done', cycles };
    }

    if (dryRun) {
      console.log('[DRY RUN] Would run PM phase');
      console.log('[DRY RUN] Would run Coder phase');
      cycles++;
      continue;
    }

    // --- PM Phase ---
    cleanWorkingTree(projectRoot);
    console.log('\n[PM] Reading progress, planning next task...');

    const pmResult = await runPM(config);

    if (pmResult.exitCode !== 0) {
      console.error(`[PM] Exited with error (code ${pmResult.exitCode}). Retrying in ${errorSleepTime}s...`);
      await sleep(errorSleepTime);
      continue;
    }

    // Verify PM completed normally (not truncated)
    if (!signals.hasPmDone()) {
      console.warn('[PM] No PM_DONE signal — likely truncated by max-turns. Rolling back...');
      cleanWorkingTree(projectRoot);
      await sleep(errorSleepTime);
      continue;
    }
    signals.removePmDone();

    // Check human needed after PM
    if (signals.hasHumanNeeded()) {
      const content = signals.readHumanNeeded();
      console.error('\n[HUMAN NEEDED] PM requests human assistance:');
      console.error(content);
      return { status: 'human_needed', cycles };
    }

    // Commit PM changes
    const pmChanged = commitChanges(projectRoot, signals, 'PM', 'chore(pm): update plan and CURRENT_TASK.md');
    if (!pmChanged) {
      consecutiveNoChanges++;
    } else {
      consecutiveNoChanges = 0;
    }

    if (consecutiveNoChanges >= stuckLimit) {
      console.error(`Detected ${stuckLimit} consecutive cycles with no changes. AI is stuck — exiting.`);
      return { status: 'stuck', cycles };
    }

    console.log(`\n[PM] Done. Cooling down for ${sleepTime}s...`);
    await sleep(sleepTime);

    // --- Coder Phase ---
    console.log('==================================================');
    cleanWorkingTree(projectRoot);
    console.log('\n[Coder] Reading CURRENT_TASK.md and implementing...');

    const coderResult = await runCoder(config);

    if (coderResult.exitCode !== 0) {
      console.error(`[Coder] Exited with error (code ${coderResult.exitCode}). Retrying in ${errorSleepTime}s...`);
      await sleep(errorSleepTime);
      continue;
    }

    // Verify Coder completed normally
    if (!signals.hasCoderDone()) {
      console.warn('[Coder] No CODER_DONE signal — likely truncated. Rolling back...');
      cleanWorkingTree(projectRoot);
      await sleep(errorSleepTime);
      continue;
    }
    signals.removeCoderDone();

    // Check human needed after Coder
    if (signals.hasHumanNeeded()) {
      const content = signals.readHumanNeeded();
      console.error('\n[HUMAN NEEDED] Coder requests human assistance:');
      console.error(content);
      return { status: 'human_needed', cycles };
    }

    // Commit Coder changes
    const coderChanged = commitChanges(projectRoot, signals, 'Coder', 'feat(coder): implement assigned task');
    if (!coderChanged) {
      consecutiveNoChanges++;
    } else {
      consecutiveNoChanges = 0;
    }

    if (consecutiveNoChanges >= stuckLimit) {
      console.error(`Detected ${stuckLimit} consecutive cycles with no changes. AI is stuck — exiting.`);
      return { status: 'stuck', cycles };
    }

    cycles++;
    console.log(`\n[Coder] Done. Cycle ${cycles} complete. Cooling down for ${sleepTime}s...`);
    await sleep(sleepTime);
  }

  return { status: 'max_cycles_reached', cycles };
}
