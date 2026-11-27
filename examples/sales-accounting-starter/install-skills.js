#!/usr/bin/env node
/**
 * Install the curated sales + accounting skill set into Claude Code.
 *
 * Usage:
 *   node install-skills.js                 # install into ~/.claude/skills (all projects)
 *   node install-skills.js --project <dir> # install into <dir>/.claude/skills (one project)
 *   node install-skills.js --dry-run       # show what would happen, change nothing
 *
 * Existing skills with the same name are left untouched unless --force is given,
 * in which case the old copy is moved to <name>.backup-<timestamp> first.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const kitDir = __dirname;
const skillsSource = path.resolve(kitDir, '..', '..', 'skills');
const listFile = path.join(kitDir, 'skills.txt');

function parseArgs(argv) {
  const options = { project: null, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--project') {
      options.project = argv[i + 1];
      i += 1;
      if (!options.project) throw new Error('--project needs a folder path');
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function readSkillList(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return 0;
  }

  const destination = options.project
    ? path.join(path.resolve(options.project), '.claude', 'skills')
    : path.join(os.homedir(), '.claude', 'skills');

  const names = readSkillList(listFile);
  const missing = names.filter(name => !fs.existsSync(path.join(skillsSource, name, 'SKILL.md')));
  if (missing.length > 0) {
    console.error(`[install-skills] Not found in ${skillsSource}: ${missing.join(', ')}`);
    console.error('[install-skills] Run this script from inside a full ECC checkout.');
    return 1;
  }

  console.log(`[install-skills] ${names.length} skills -> ${destination}${options.dryRun ? ' (dry run)' : ''}`);
  if (!options.dryRun) fs.mkdirSync(destination, { recursive: true });

  const counts = { installed: 0, skipped: 0, replaced: 0 };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  for (const name of names) {
    const target = path.join(destination, name);
    const exists = fs.existsSync(target);

    if (exists && !options.force) {
      console.log(`  - ${name} (already installed, skipped)`);
      counts.skipped += 1;
      continue;
    }

    if (!options.dryRun) {
      if (exists) fs.renameSync(target, `${target}.backup-${stamp}`);
      fs.cpSync(path.join(skillsSource, name), target, { recursive: true });
    }
    console.log(`  ${exists ? '~' : '+'} ${name}${exists ? ' (old copy backed up)' : ''}`);
    counts[exists ? 'replaced' : 'installed'] += 1;
  }

  console.log(
    `[install-skills] Done: ${counts.installed} installed, ${counts.replaced} replaced, ${counts.skipped} skipped.`
  );
  console.log('[install-skills] Restart Claude Code so it picks up the new skills.');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`[install-skills] ${error.message}`);
  process.exitCode = 1;
}
