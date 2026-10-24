# ファイルから読む

ファイル表示では、固定コミットの全ファイルをツリーと名前検索でたどり、行番号つきの本文を400行ずつ読める。

## Sub-features

- `files-tree`：ルートにトップレベルのディレクトリが並び、ディレクトリを展開できる。
- `files-search`：名前とパスの部分一致で検索し、件数と結果を出す。一致がなければ空の案内を出す。
- `files-open`：検索結果やツリーからファイルを開き、パンくずとファイル名を出す。
- `files-range`：`line` と `end` を指定したリンクで、その行範囲を選択状態で出す。
- `files-paging`：400行を超えるファイルで、前後の400行へ移動できる。
- `files-goto-line`：「行へ移動」で指定した行の窓へ移る。

## How to get to it (user POV)

- 上部ナビゲーションの「ファイルから読む」を選ぶ。
- 起動ガイドの読みどころで「この範囲のコードを開く →」を選ぶ（`files-range`）。
- 読解ノートのコード画面で「ファイル全体・ツリー」を選ぶ。
- 共有リンク `/files?path=<path>&line=<n>&end=<m>` を開く。

## Driving it with studio.mjs

Preconditions:

- `$STUDIO doctor` が `ok: true` を返す。

- **ツリーを開く。** ファイル表示を開く。`$STUDIO browser goto "/files"` を実行する。`$STUDIO browser text --selector "#files-content"` に `bin/` と `crates/` が含まれる。
- **ディレクトリを展開する。** `$STUDIO browser click --role button --name "binを展開"` を実行する。ツリーに `reth` が出て、ボタン名が「binを折りたたむ」になる。
- **検索で一致させる。** `$STUDIO browser fill --label "名前・パスで探す" --value "launch.rs"` を実行する。`$STUDIO browser text --selector "#files-search-count"` が `1 件` を返し、`$STUDIO browser text --selector "#files-tree"` に `crates/engine/tree/src/launch.rs` が含まれる。
- **検索結果を開く。** `$STUDIO browser click --role link --name "launch.rs"` を実行する。URL が `/files?path=crates%2Fengine%2Ftree%2Fsrc%2Flaunch.rs` になり、タイトルが `launch.rs · Code Reading Studio` になる。
- **一致なし。** `$STUDIO browser goto "/files"` のあと `$STUDIO browser fill --label "名前・パスで探す" --value "zzqqnotafile"` を実行する。件数が `0 件` になり、`#files-tree` に「一致するファイルがありません。」が出る。
- **大きなファイルの窓。** `$STUDIO browser goto "/files?path=crates/engine/tree/src/tree/mod.rs&line=950"` を実行する。本文の上に `801–1200 / 3,768 行` が出て、リンク「← 前の400行」と「次の400行 →」がある。
- **次の窓へ移る。** `$STUDIO browser click --role link --name "次の400行 →"` を実行する。URL の `line` が `1201` になり、`1201–1600 / 3,768 行` が出る。
- **行へ移動する。** `$STUDIO browser fill --label "行へ移動" --value "3700"` と `$STUDIO browser click --role button --name "表示" --exact` を実行する。`3601–3768 / 3,768 行` が出て、`$STUDIO browser text --selector '[aria-current="location"]'` が `3700` を返す。
- **証拠。** `$STUDIO browser snapshot --path files/mod-rs-window.aria.txt` と `$STUDIO browser screenshot --path files/mod-rs-window.png` を実行する。スナップショットにパンくず `crates / engine / tree / src / tree` と `mod.rs` が含まれる。

## Gotchas

- 検索は入力イベントで更新される。`fill` の直後に件数を読めば足り、固定時間の待機は要らない。
- 「この行のリンクをコピー」は headless Chromium のクリップボード権限に左右される。コピーの成否で機能の正しさを判定しない。
- ツリーは600項目までに絞って描画する。深いパスを探すときは検索を使う。
- 2 MiB を超えるファイルとバイナリは本文を出さず、理由の文だけを出す。これは仕様である。
- 作業ツリーの未コミット変更は表示されない。表示の根拠は常に固定コミットである。
