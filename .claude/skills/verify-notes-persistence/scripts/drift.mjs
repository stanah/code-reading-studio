#!/usr/bin/env node
// Fails when a line of local-app/server.mjs that the model describes has changed since the sync commit.
// Each covered line is found by a pattern and compared by SHA-256, so moving lines does not count as drift.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const coverage = JSON.parse(readFileSync(join(here, '../coverage.json'), 'utf8'));
const write = process.argv.includes('--write');
let drift = 0;
for (const file of coverage.files) {
  const lines = readFileSync(join(root, file.path), 'utf8').split('\n');
  for (const check of file.lines) {
    const hits = lines.map((text, i) => ({text, line: i + 1})).filter(({text}) => text.includes(check.match));
    const hash = hits.length === 1 ? createHash('sha256').update(hits[0].text).digest('hex') : null;
    if (write && hash) check.sha256 = hash;
    const ok = hash && hash === check.sha256;
    if (!ok) drift++;
    console.log(`${ok ? '  ' : '!!'} ${file.path}:${hits[0]?.line ?? '?'} ${check.model}: ${hits.length !== 1 ? `${hits.length} lines match "${check.match}"` : ok ? 'unchanged' : 'CHANGED since ' + coverage.syncCommit}`);
  }
}
if (write) { (await import('node:fs')).writeFileSync(join(here, '../coverage.json'), JSON.stringify(coverage, null, 2) + '\n'); console.log('coverage.json hashes rewritten; now move syncCommit forward by hand.'); }
else if (drift) console.log('Covered code changed. Re-read it against model/NotesPersistence.tla before trusting the TLC results (see SKILL.md, "When the covered code changed").');
process.exit(write ? 0 : drift ? 1 : 0);
