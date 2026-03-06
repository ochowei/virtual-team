# @william9527/virtual-team

AI-driven virtual team framework — automate software development with PM and Coder agents powered by Claude CLI.

## What is this?

Virtual Team is an orchestration framework that runs two AI agents in a loop:

- **PM (Project Manager)** — reads a task list (`GOALS.md`), selects the next task, writes a detailed specification
- **Coder (Software Engineer)** — reads the specification, implements the code, runs tests, and reports back

The loop continues automatically until all tasks are complete, with safety mechanisms for stuck detection, truncation recovery, and human intervention requests.

## Prerequisites

- **Node.js** >= 18
- **Git**
- **Claude CLI** (`claude`) installed and authenticated

## Quick Start

```bash
# Install
npm install -g @william9527/virtual-team

# Initialise in your project
cd my-project
virtual-team init

# Define your tasks
vim .virtual-team/GOALS.md

# Start the development loop
virtual-team start
```

## CLI Commands

### `virtual-team init [--force]`

Creates the `.virtual-team/` directory with:
- `prompts/pm.txt` — PM system prompt
- `prompts/coder.txt` — Coder system prompt
- `PLAYBOOK.md` — Framework documentation
- `GOALS_TEMPLATE.md` — Template for creating task lists
- `INTENT_SPEC_TEMPLATE.md` — Template for task specifications
- `GOALS.md` — Empty task list for you to fill in
- `config.json` — Configuration file

### `virtual-team start [options]`

Starts the PM ↔ Coder development loop.

| Option | Description |
|--------|-------------|
| `--dry-run` | Log actions without executing agents |
| `--max-cycles <n>` | Limit PM→Coder cycles |
| `--sleep <seconds>` | Override cooldown time (default: 600) |
| `--project <path>` | Specify project root (default: cwd) |

### `virtual-team status`

Shows current task progress (TODO / IN PROGRESS / DONE counts).

## Configuration

Edit `.virtual-team/config.json`:

```json
{
  "sleepTime": 600,
  "errorSleepTime": 300,
  "stuckLimit": 3,
  "pmMaxTurns": 45,
  "coderMaxTurns": 65,
  "pmModel": "sonnet"
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `sleepTime` | `600` | Cooldown seconds between PM and Coder phases |
| `errorSleepTime` | `300` | Retry wait after API errors |
| `stuckLimit` | `3` | Consecutive no-change cycles before force exit |
| `pmMaxTurns` | `45` | Max conversation turns for PM |
| `coderMaxTurns` | `65` | Max conversation turns for Coder |
| `pmModel` | `"sonnet"` | Model for PM agent |

## Programmatic API

```js
import { loadConfig, startLoop, initVirtualTeam } from '@william9527/virtual-team';

// Initialise
initVirtualTeam('/path/to/project');

// Run the loop
const config = loadConfig('/path/to/project');
const result = await startLoop(config, { maxCycles: 5 });
console.log(result.status); // 'all_done' | 'human_needed' | 'stuck' | 'max_cycles_reached'
```

## Safety Mechanisms

| Mechanism | Description |
|-----------|-------------|
| **Task completion detection** | Loop ends when no `[TODO]` or `[IN PROGRESS]` in GOALS.md |
| **Truncation detection** | Missing signal file → rollback and retry |
| **Stuck detection** | N consecutive no-change cycles → force exit |
| **Human intervention** | `HUMAN_NEEDED.md` pauses the loop |
| **API error tolerance** | Retry with backoff on API/network errors |

## GOALS.md Format

```markdown
## Epic 1: Infrastructure

### Feature 1.1: Project Setup

- [ ] `[TODO]` Task 1.1.1: Initialise Node.js project
  - Goal: Set up package.json, TypeScript, and build tooling
  - Output: package.json, tsconfig.json, working `npm run build`
```

Task statuses: `[TODO]` → `[IN PROGRESS]` → `[DONE]`

## License

MIT
