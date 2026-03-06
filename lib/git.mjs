import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/**
 * Ensure the project root is a git repository. Initialise if needed.
 */
export function ensureGitRepo(projectRoot) {
  if (!existsSync(resolve(projectRoot, '.git'))) {
    console.log('Initialising git repository...');
    git(['init'], projectRoot);
    git(['add', '.'], projectRoot);
    const name = projectRoot.split('/').pop();
    git(['commit', '-m', `chore: initial commit for ${name}`], projectRoot);
  }
}

/**
 * Hard-reset and clean the working tree so the next agent starts from a clean state.
 */
export function cleanWorkingTree(projectRoot) {
  git(['reset', '--hard', 'HEAD'], projectRoot);
  git(['clean', '-fd'], projectRoot);
}

/**
 * Stage all changes, read optional .commit_msg, and commit.
 * @returns {boolean} true if a commit was created, false if nothing to commit.
 */
export function commitChanges(projectRoot, signals, role, defaultMsg) {
  let msg = defaultMsg;

  // Read and remove .commit_msg before staging to avoid including it in the commit
  const agentMsg = signals.readCommitMsg();
  if (agentMsg) {
    msg = agentMsg;
    signals.removeCommitMsg();
  }

  git(['add', '.'], projectRoot);

  // Check if there are staged changes
  try {
    git(['diff', '--cached', '--quiet'], projectRoot);
    // If the above succeeds (exit 0), there are no changes
    console.log(`[${role}] No file changes detected, skipping commit.`);
    return false;
  } catch {
    // diff --cached --quiet exits non-zero when there ARE changes — commit them
    git(['commit', '-m', msg], projectRoot);
    return true;
  }
}
