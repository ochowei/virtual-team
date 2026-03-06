import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');

/**
 * Initialise the .virtual-team/ directory in a project.
 *
 * @param {string} projectRoot - Absolute path to the target project root.
 * @param {object} [options]
 * @param {boolean} [options.force=false] - Overwrite existing files.
 * @returns {{ created: string[], skipped: string[] }}
 */
export function initVirtualTeam(projectRoot, options = {}) {
  const { force = false } = options;
  const teamDir = resolve(projectRoot, '.virtual-team');
  const promptsDir = resolve(teamDir, 'prompts');
  const created = [];
  const skipped = [];

  // Ensure directories exist
  mkdirSync(promptsDir, { recursive: true });

  // Files to copy from package templates/prompts into the project
  const filesToCopy = [
    { src: 'prompts/pm.txt', dest: 'prompts/pm.txt' },
    { src: 'prompts/coder.txt', dest: 'prompts/coder.txt' },
    { src: 'templates/PLAYBOOK.md', dest: 'PLAYBOOK.md' },
    { src: 'templates/GOALS_TEMPLATE.md', dest: 'GOALS_TEMPLATE.md' },
    { src: 'templates/INTENT_SPEC_TEMPLATE.md', dest: 'INTENT_SPEC_TEMPLATE.md' },
  ];

  for (const { src, dest } of filesToCopy) {
    const srcPath = resolve(PACKAGE_ROOT, src);
    const destPath = resolve(teamDir, dest);

    if (existsSync(destPath) && !force) {
      skipped.push(dest);
      continue;
    }

    // Ensure parent dir exists
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
    created.push(dest);
  }

  // Create an empty GOALS.md if it doesn't exist
  const goalsPath = resolve(teamDir, 'GOALS.md');
  if (!existsSync(goalsPath) || force) {
    writeFileSync(goalsPath, `# Project Goals\n\n> Edit this file to define your project tasks.\n> See GOALS_TEMPLATE.md for format reference.\n\n## MVP Scope (Phase 1)\n\n(No tasks defined yet)\n`);
    created.push('GOALS.md');
  } else {
    skipped.push('GOALS.md');
  }

  // Create default config.json
  const configPath = resolve(teamDir, 'config.json');
  if (!existsSync(configPath) || force) {
    writeFileSync(configPath, JSON.stringify({
      sleepTime: 600,
      errorSleepTime: 300,
      stuckLimit: 3,
      pmMaxTurns: 45,
      coderMaxTurns: 65,
      pmModel: 'sonnet',
    }, null, 2) + '\n');
    created.push('config.json');
  } else {
    skipped.push('config.json');
  }

  // Append to .gitignore
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const gitignoreEntries = [
    '# virtual-team runtime files',
    '.virtual-team/PM_DONE',
    '.virtual-team/CODER_DONE',
    '.virtual-team/HUMAN_NEEDED.md',
    '.virtual-team/CURRENT_TASK.md',
    '.commit_msg',
  ].join('\n');

  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, 'utf-8');
    if (!existing.includes('.virtual-team/PM_DONE')) {
      writeFileSync(gitignorePath, existing + '\n' + gitignoreEntries + '\n');
      created.push('.gitignore (appended)');
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntries + '\n');
    created.push('.gitignore');
  }

  return { created, skipped };
}
