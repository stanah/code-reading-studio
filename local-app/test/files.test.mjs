import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ancestorPaths, buildTree, fileUrl, filterFiles, lineWindow, readLocation, renderCode, renderTree, validPath} from '../public/files.js';

const entries = [
  {path:'Cargo.toml', type:'blob', size:20},
  {path:'bin/reth/src/main.rs', type:'blob', size:100},
  {path:'crates/node/builder/src/launch/common.rs', type:'blob'},
  {path:'crates/engine/tree/src/tree/mod.rs', type:'blob'},
  {path:'docs/図 & "仕様".md', type:'blob'},
];

test('file navigation keeps full repository paths across unrelated directories and non-Rust files', () => {
  const tree = buildTree(entries);
  assert.deepEqual(tree.root.children.map(node => node.name), ['bin', 'crates', 'docs', 'Cargo.toml']);
  for (const entry of entries) {
    const href = fileUrl(entry.path, 37);
    const target = readLocation(new URL(href, 'http://localhost').search);
    assert.deepEqual(target, {path:entry.path, line:37});
    assert.equal(tree.nodes.get(target.path).type, 'blob');
  }
  assert.deepEqual(ancestorPaths('crates/engine/tree/src/tree/mod.rs'), ['crates', 'crates/engine', 'crates/engine/tree', 'crates/engine/tree/src', 'crates/engine/tree/src/tree']);
  assert.equal(readLocation('').path, '');
  assert.equal(tree.nodes.get('').type, 'tree');
});

test('file search matches all path terms with bounded results, including files outside Rust crates', () => {
  const tree = buildTree(entries);
  assert.deepEqual(filterFiles(tree.files, 'RETH main').items.map(file => file.path), ['bin/reth/src/main.rs']);
  assert.deepEqual(filterFiles(tree.files, 'cargo.toml').items.map(file => file.path), ['Cargo.toml']);
  assert.equal(filterFiles(tree.files, 'unknown').total, 0);
  const many = Array.from({length:350}, (_, i) => ({path:`files/${i}.rs`}));
  assert.equal(filterFiles(many, '.rs').total, 350);
  assert.equal(filterFiles(many, '.rs').items.length, 100);
  assert.equal(filterFiles(many, '.rs', 200).items.length, 200);
});

test('closed folders do not produce descendant DOM and selected branches remain directly navigable', () => {
  const tree = buildTree(entries);
  const collapsed = renderTree(tree, new Set(), 'bin/reth/src/main.rs');
  assert.doesNotMatch(collapsed, /main\.rs/);
  const opened = renderTree(tree, new Set(ancestorPaths('bin/reth/src/main.rs')), 'bin/reth/src/main.rs');
  assert.match(opened, /main\.rs/);
  assert.match(opened, /aria-current="page"/);
  assert.doesNotMatch(opened, /common\.rs/);
  const large = buildTree(Array.from({length:1000}, (_, i) => ({path:`file-${i}`, type:'blob'})));
  assert.equal((renderTree(large, new Set(), '').match(/class="files-tree-row"/g) || []).length, 600);
});

test('every source line is reachable through bounded previous/next windows and direct line links', () => {
  const source = Array.from({length:1203}, (_, i) => `line ${i + 1}`).join('\n');
  let next = 1;
  const visited = [];
  while (next) {
    const code = renderCode(source, 'README.md', next);
    assert.ok(code.end - code.start < 400);
    visited.push([code.start, code.end]);
    next = code.next;
  }
  assert.deepEqual(visited, [[1,400], [401,800], [801,1200], [1201,1203]]);
  const direct = renderCode(source, 'README.md', 899);
  assert.equal(direct.start, 801);
  assert.equal(direct.previous, 401);
  assert.match(direct.html, /is-selected" id="L899"/);
  assert.match(direct.html, /href="\/files\?path=README.md&amp;line=899"/);
  assert.equal(lineWindow(12, 9999).line, 12);
  assert.equal(renderCode('last line\n', 'README.md').total, 1);
  assert.equal(renderCode('', 'empty').total, 1);
  const rangeUrl = fileUrl('README.md', 40, 44);
  assert.deepEqual(readLocation(new URL(rangeUrl, 'http://localhost').search), {path:'README.md', line:40, end:44});
  assert.equal((renderCode(source, 'README.md', 40, 44).html.match(/is-selected/g) || []).length, 5);
  const crossing = renderCode(source, 'README.md', 375, 403);
  assert.equal(crossing.start, 375);
  assert.equal((crossing.html.match(/is-selected/g) || []).length, 29, 'a short guide range stays visible across a standard page boundary');
  for (const line of ['0', '-1', '4x', '1.5', '99999999999999999999']) assert.equal(readLocation('?line=' + line).line, 1);
});

test('repository filenames and source are inert text, while path traversal entries are rejected', () => {
  const path = 'docs/" onmouseover="alert(1)<script>.md';
  const tree = buildTree([{path, type:'blob'}, {path:'../outside', type:'blob'}, {path:'/absolute', type:'blob'}]);
  assert.equal(tree.files.length, 1);
  const html = renderTree(tree, new Set(['docs']), path);
  assert.doesNotMatch(html, /<script>| onmouseover="/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot;/);
  const code = renderCode('<img src=x onerror="alert(1)">\n<script>alert(1)</script>', path, 2);
  assert.doesNotMatch(code.html, /<img|<script>/);
  assert.match(code.html, /&lt;img/);
  assert.equal(readLocation(new URL(fileUrl(path, 2), 'http://localhost').search).path, path);
  for (const invalid of ['../secret', 'a/../secret', '/secret', 'a//b', 'a/./b', 'a\0b']) assert.equal(validPath(invalid), false);
});
