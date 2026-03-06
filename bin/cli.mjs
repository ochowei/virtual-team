#!/usr/bin/env node

import { resolve } from 'node:path';

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
virtual-team — AI-driven development automation

Usage:
  virtual-team init    [--force]           Initialise .virtual-team/ in current project
  virtual-team start   [options]           Start the PM ↔ Coder development loop
  virtual-team status                      Show current task status
  virtual-team help                        Show this help message

Start options:
  --dry-run            Log actions without executing agents
  --max-cycles <n>     Limit the number of PM→Coder cycles
  --sleep <seconds>    Override cooldown time between phases (default: 600)
  --project <path>     Specify project root (default: cwd)
`);
}

async function main() {
  switch (command) {
    case 'init': {
      const { initVirtualTeam } = await import('../lib/init.mjs');
      const force = args.includes('--force');
      const projectRoot = resolve(getFlag('--project') || process.cwd());

      console.log(`Initialising virtual team in ${projectRoot}...`);
      const result = initVirtualTeam(projectRoot, { force });

      if (result.created.length) {
        console.log('\nCreated:');
        result.created.forEach((f) => console.log(`  + ${f}`));
      }
      if (result.skipped.length) {
        console.log('\nSkipped (already exists):');
        result.skipped.forEach((f) => console.log(`  - ${f}`));
      }

      console.log('\nDone! Edit .virtual-team/GOALS.md to define your tasks, then run:');
      console.log('  virtual-team start');
      break;
    }

    case 'start': {
      const { loadConfig } = await import('../lib/config.mjs');
      const { startLoop } = await import('../lib/orchestrator.mjs');

      const projectRoot = resolve(getFlag('--project') || process.cwd());
      const config = loadConfig(projectRoot);

      // Apply CLI overrides
      const sleepOverride = getFlag('--sleep');
      if (sleepOverride) config.sleepTime = Number(sleepOverride);

      const dryRun = args.includes('--dry-run');
      const maxCyclesStr = getFlag('--max-cycles');
      const maxCycles = maxCyclesStr ? Number(maxCyclesStr) : undefined;

      const result = await startLoop(config, { dryRun, maxCycles });
      console.log(`\nLoop ended: ${result.status} (${result.cycles} cycles completed)`);

      process.exit(result.status === 'all_done' ? 0 : 1);
    }

    case 'status': {
      const { existsSync, readFileSync } = await import('node:fs');
      const projectRoot = resolve(getFlag('--project') || process.cwd());
      const goalsPath = resolve(projectRoot, '.virtual-team', 'GOALS.md');
      const taskPath = resolve(projectRoot, '.virtual-team', 'CURRENT_TASK.md');

      if (!existsSync(goalsPath)) {
        console.error('No .virtual-team/GOALS.md found. Run "virtual-team init" first.');
        process.exit(1);
      }

      const goals = readFileSync(goalsPath, 'utf-8');
      const todoCount = (goals.match(/\[TODO\]/g) || []).length;
      const inProgressCount = (goals.match(/\[IN PROGRESS\]/g) || []).length;
      const doneCount = (goals.match(/\[DONE\]/g) || []).length;

      console.log('Task Status:');
      console.log(`  TODO:        ${todoCount}`);
      console.log(`  IN PROGRESS: ${inProgressCount}`);
      console.log(`  DONE:        ${doneCount}`);
      console.log(`  Total:       ${todoCount + inProgressCount + doneCount}`);

      if (existsSync(taskPath)) {
        const task = readFileSync(taskPath, 'utf-8');
        const titleMatch = task.match(/^## 任務：(.+)$/m) || task.match(/^## Task:\s*(.+)$/m);
        if (titleMatch) {
          console.log(`\nCurrent task: ${titleMatch[1]}`);
        }
      }

      const humanPath = resolve(projectRoot, '.virtual-team', 'HUMAN_NEEDED.md');
      if (existsSync(humanPath)) {
        console.log('\n⚠ HUMAN_NEEDED.md exists — the loop is waiting for human intervention.');
      }
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printUsage();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
