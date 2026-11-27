'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const kitRoot = path.join(repoRoot, 'examples', 'sales-accounting-starter');
const installer = path.join(kitRoot, 'install-skills.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function skillNames() {
  return fs
    .readFileSync(path.join(kitRoot, 'skills.txt'), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

function runInstaller(args, home) {
  return spawnSync(process.execPath, [installer, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-sales-kit-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\n=== Testing sales-accounting starter kit ===\n');

test('every listed skill exists in skills/ with a SKILL.md', () => {
  const names = skillNames();
  assert.ok(names.length > 0, 'skills.txt lists no skills');
  assert.strictEqual(new Set(names).size, names.length, 'skills.txt has duplicates');
  for (const name of names) {
    assert.ok(fs.existsSync(path.join(repoRoot, 'skills', name, 'SKILL.md')), `Missing skill: ${name}`);
  }
});

test('README documents every listed skill', () => {
  const readme = fs.readFileSync(path.join(kitRoot, 'README.md'), 'utf8');
  for (const name of skillNames()) {
    assert.ok(readme.includes(`\`${name}\``), `README does not mention ${name}`);
  }
});

test('CLAUDE.md carries the prompt defense baseline and core accounting invariants', () => {
  const source = fs.readFileSync(path.join(kitRoot, 'CLAUDE.md'), 'utf8');
  assert.ok(source.includes('## Prompt Defense Baseline'));
  assert.ok(/integers in the smallest unit/i.test(source), 'money-as-integers rule missing');
  assert.ok(/debits equal credits/i.test(source), 'double-entry rule missing');
  assert.ok(/Nothing is deleted/i.test(source), 'immutability rule missing');
});

test('dry run writes nothing', () => {
  withTempDir(home => {
    const result = runInstaller(['--dry-run'], home);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(!fs.existsSync(path.join(home, '.claude')), 'dry run created files');
  });
});

test('installs into ~/.claude/skills, skips existing, and backs up on --force', () => {
  withTempDir(home => {
    const names = skillNames();
    const skillsDir = path.join(home, '.claude', 'skills');

    assert.strictEqual(runInstaller([], home).status, 0);
    for (const name of names) {
      assert.ok(fs.existsSync(path.join(skillsDir, name, 'SKILL.md')), `Not installed: ${name}`);
    }

    const marker = path.join(skillsDir, names[0], 'SKILL.md');
    fs.writeFileSync(marker, 'local edit');
    const second = runInstaller([], home);
    assert.strictEqual(second.status, 0);
    assert.strictEqual(fs.readFileSync(marker, 'utf8'), 'local edit', 'existing skill was overwritten');
    assert.ok(second.stdout.includes(`${names.length} skipped`));

    assert.strictEqual(runInstaller(['--force'], home).status, 0);
    assert.notStrictEqual(fs.readFileSync(marker, 'utf8'), 'local edit');
    const backups = fs.readdirSync(skillsDir).filter(entry => entry.startsWith(`${names[0]}.backup-`));
    assert.strictEqual(backups.length, 1, 'expected one backup');
  });
});

test('--project installs into <dir>/.claude/skills', () => {
  withTempDir(home => {
    const project = path.join(home, 'shop');
    const result = runInstaller(['--project', project], home);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(project, '.claude', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(!fs.existsSync(path.join(home, '.claude')), 'also wrote to home');
  });
});

test('rejects unknown options', () => {
  withTempDir(home => {
    const result = runInstaller(['--bogus'], home);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('Unknown option'));
  });
});

if (failed > 0) {
  console.log(`\nFailed: ${failed}`);
  process.exit(1);
}

console.log(`\nPassed: ${passed}`);
