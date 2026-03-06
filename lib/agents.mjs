import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { runClaude } from './claude-runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');

function loadPrompt(name) {
  return readFileSync(resolve(PACKAGE_ROOT, 'prompts', name), 'utf-8');
}

const PM_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep'];

const CODER_TOOLS = [
  'Bash(npm install*)',
  'Bash(npm run *)',
  'Bash(npm test*)',
  'Bash(npm ci*)',
  'Bash(npx *)',
  'Bash(node *)',
  'Bash(git status*)',
  'Bash(git diff*)',
  'Read', 'Edit', 'Write', 'Glob', 'Grep',
];

/**
 * Run the PM agent phase.
 */
export async function runPM(config) {
  const prompt = loadPrompt('pm.txt');
  return runClaude({
    role: 'PM',
    prompt,
    allowedTools: PM_TOOLS,
    maxTurns: config.pmMaxTurns,
    model: config.pmModel,
    cwd: config.projectRoot,
  });
}

/**
 * Run the Coder agent phase.
 */
export async function runCoder(config) {
  const prompt = loadPrompt('coder.txt');
  return runClaude({
    role: 'Coder',
    prompt,
    allowedTools: CODER_TOOLS,
    maxTurns: config.coderMaxTurns,
    model: config.coderModel,
    cwd: config.projectRoot,
  });
}
