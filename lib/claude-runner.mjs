import { spawn } from 'node:child_process';

/**
 * Run the `claude` CLI with the given arguments and stream output to stdout.
 *
 * @param {object} options
 * @param {string} options.role      - Display label ("PM" or "Coder")
 * @param {string} options.prompt    - System prompt text
 * @param {string[]} options.allowedTools - List of allowed tool patterns
 * @param {number} options.maxTurns  - Maximum conversation turns
 * @param {string} [options.model]   - Model override (e.g. "sonnet")
 * @param {string} options.cwd       - Working directory
 * @returns {Promise<{exitCode: number, turns: number|null}>}
 */
export function runClaude({ role, prompt, allowedTools, maxTurns, model, cwd }) {
  return new Promise((resolve) => {
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
    console.log(`[${role}] Starting at ${startTime.toISOString()}`);

    const child = spawn('claude', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    let turns = null;
    let buffer = '';

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

          // Stream text deltas to stdout
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            process.stdout.write(event.delta.text);
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
      resolve({ exitCode: code ?? 1, turns });
    });

    child.on('error', (err) => {
      console.error(`[${role}] Failed to spawn claude: ${err.message}`);
      resolve({ exitCode: 1, turns: null });
    });
  });
}
