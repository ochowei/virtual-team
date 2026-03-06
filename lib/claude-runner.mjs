import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

/**
 * Extract a short human-readable summary from a tool's input parameters.
 */
function getToolSummary(name, input) {
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return input.file_path ?? '';
    case 'Bash':
      return (input.command ?? '').slice(0, 120);
    case 'Glob':
      return input.pattern ?? '';
    case 'Grep': {
      const parts = [input.pattern ?? ''];
      if (input.path) parts.push(`in ${input.path}`);
      return parts.join(' ');
    }
    default:
      return JSON.stringify(input).slice(0, 120);
  }
}

/**
 * Run the `claude` CLI with the given arguments and stream output to stdout.
 * Tool calls are displayed inline and all output is written to a log file.
 *
 * @param {object} options
 * @param {string} options.role          - Display label ("PM" or "Coder")
 * @param {string} options.prompt        - System prompt text
 * @param {string[]} options.allowedTools - List of allowed tool patterns
 * @param {number} options.maxTurns      - Maximum conversation turns
 * @param {string} [options.model]       - Model override (e.g. "sonnet")
 * @param {string} options.cwd           - Working directory
 * @param {string} [options.teamDir]     - Team directory name (default: ".virtual-team")
 * @returns {Promise<{exitCode: number, turns: number|null}>}
 */
export function runClaude({ role, prompt, allowedTools, maxTurns, model, cwd, teamDir = '.virtual-team' }) {
  return new Promise((promiseResolve) => {
    const args = [
      '-p', prompt,
      '--allowedTools', allowedTools.join(','),
      '--max-turns', String(maxTurns),
    ];

    if (model) {
      args.push('--model', model);
    }

    // Try streaming JSON for turn counting if jq is available,
    // otherwise fall back to plain text.
    args.push('--output-format', 'stream-json', '--verbose');

    const startTime = new Date();
    const timestamp = startTime.toISOString().replace(/:/g, '-').slice(0, 19);

    // Set up log file at .virtual-team/logs/<timestamp>_<role>.log
    const logDir = resolvePath(cwd, teamDir, 'logs');
    mkdirSync(logDir, { recursive: true });
    const logPath = resolvePath(logDir, `${timestamp}_${role}.log`);
    const logStream = createWriteStream(logPath, { flags: 'a' });

    const logLine = (text) => logStream.write(`[${new Date().toISOString()}] ${text}\n`);

    console.log(`[${role}] Starting at ${startTime.toISOString()}`);
    console.log(`[${role}] Log: ${logPath}`);
    logLine(`[${role}] Starting at ${startTime.toISOString()}`);

    const child = spawn('claude', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    let turns = null;
    let buffer = '';

    // Track active tool_use content blocks by index: index -> { name, inputBuffer }
    const pendingTools = new Map();

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      buffer += text;

      // Process complete JSONL lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          // Stream text deltas to stdout and log
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            process.stdout.write(event.delta.text);
            logStream.write(event.delta.text);
          }

          // Tool call started — record tool name
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            pendingTools.set(event.index, {
              name: event.content_block.name,
              inputBuffer: '',
            });
          }

          // Accumulate partial JSON input for the tool
          if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
            const tool = pendingTools.get(event.index);
            if (tool) {
              tool.inputBuffer += event.delta.partial_json ?? '';
            }
          }

          // Tool call complete — display it
          if (event.type === 'content_block_stop') {
            const tool = pendingTools.get(event.index);
            if (tool) {
              pendingTools.delete(event.index);
              let input = {};
              try { input = JSON.parse(tool.inputBuffer || '{}'); } catch { /* ignore malformed */ }
              const summary = getToolSummary(tool.name, input);
              const display = `  \u25ba ${tool.name.padEnd(6)} ${summary}`;
              console.log(display);
              logLine(`► ${tool.name} ${summary}`);
            }
          }

          // Capture turn count from result event
          if (event.type === 'result' && event.num_turns != null) {
            turns = event.num_turns;
          }
        } catch {
          // Non-JSON line — print as-is
          process.stdout.write(line + '\n');
        }
      }
    });

    child.on('close', (code) => {
      const endTime = new Date();
      console.log(`\n[${role}] Finished at ${endTime.toISOString()} — ${turns ?? '?'}/${maxTurns} turns`);
      logLine(`[${role}] Finished at ${endTime.toISOString()} — ${turns ?? '?'}/${maxTurns} turns`);
      logStream.end();
      promiseResolve({ exitCode: code ?? 1, turns });
    });

    child.on('error', (err) => {
      console.error(`[${role}] Failed to spawn claude: ${err.message}`);
      logLine(`[${role}] Failed to spawn claude: ${err.message}`);
      logStream.end();
      promiseResolve({ exitCode: 1, turns: null });
    });
  });
}
