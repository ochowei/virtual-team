import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Default configuration values for the virtual team orchestrator.
 */
const DEFAULTS = {
  sleepTime: 600,
  errorSleepTime: 300,
  stuckLimit: 3,
  pmMaxTurns: 45,
  coderMaxTurns: 65,
  pmModel: 'sonnet',
  coderModel: undefined, // uses claude default
  teamDir: '.virtual-team',
};

/**
 * Load configuration from .virtual-team/config.json (if present) merged with defaults.
 * @param {string} projectRoot - Absolute path to the project root.
 * @returns {object} Merged configuration object.
 */
export function loadConfig(projectRoot) {
  const configPath = resolve(projectRoot, '.virtual-team', 'config.json');
  let userConfig = {};

  if (existsSync(configPath)) {
    try {
      userConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      console.warn(`Warning: could not parse ${configPath}, using defaults.`);
    }
  }

  return { ...DEFAULTS, ...userConfig, projectRoot };
}
