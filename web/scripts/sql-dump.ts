// mysqldump(.sql) 파서 — CREATE TABLE 컬럼 순서 + INSERT VALUES 행 추출.
// 확장 INSERT(`(..),(..)`)와 백슬래시 이스케이프 문자열을 처리한다.
import { readFileSync } from "node:fs";

export type Row = (string | null)[];

export type Dump = {
  columns: Record<string, string[]>;
  rows: Record<string, Row[]>;
};

function decodeString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) {
      const n = raw[++i];
      switch (n) {
        case "n": out += "\n"; break;
        case "r": out += "\r"; break;
        case "t": out += "\t"; break;
        case "0": out += "\0"; break;
        case "b": out += "\b"; break;
        case "Z": out += "\x1a"; break;
        default: out += n; // \' \" \\ 등
      }
    } else {
      out += c;
    }
  }
  return out;
}

// VALUES 페이로드에서 튜플 단위로 값 배열을 yield
function* splitTuples(s: string): Generator<Row> {
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s[i] !== "(") { i++; continue; }
    i++; // skip '('
    const vals: Row = [];
    let buf = "";
    let quoted = false;
    let inStr = false;
    while (i < n) {
      const c = s[i];
      if (inStr) {
        if (c === "\\") { buf += c + (s[i + 1] ?? ""); i += 2; continue; }
        if (c === "'") { inStr = false; i++; continue; }
        buf += c; i++; continue;
      }
      if (c === "'") { inStr = true; quoted = true; i++; continue; }
      if (c === ",") {
        vals.push(quoted ? decodeString(buf) : buf === "NULL" ? null : buf);
        buf = ""; quoted = false; i++; continue;
      }
      if (c === ")") {
        vals.push(quoted ? decodeString(buf) : buf === "NULL" ? null : buf);
        i++; break;
      }
      buf += c; i++;
    }
    yield vals;
    while (i < n && s[i] !== "(") i++;
  }
}

/** 지정한 테이블들의 컬럼순서와 데이터 행을 파싱한다. */
export function parseDump(path: string, tables: string[]): Dump {
  const want = new Set(tables);
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);

  const columns: Record<string, string[]> = {};
  const rows: Record<string, Row[]> = {};
  for (const t of tables) { columns[t] = []; rows[t] = []; }

  let cur: string | null = null;
  for (const line of lines) {
    const create = line.match(/^CREATE TABLE `([^`]+)`/);
    if (create) { cur = want.has(create[1]) ? create[1] : null; continue; }
    if (cur) {
      const col = line.match(/^\s+`([^`]+)`/);
      if (col) { columns[cur].push(col[1]); continue; }
      if (line.startsWith(")")) { cur = null; continue; }
    }
    const ins = line.match(/^INSERT INTO `([^`]+)` VALUES (.*);\s*$/);
    if (ins && want.has(ins[1])) {
      for (const r of splitTuples(ins[2])) rows[ins[1]].push(r);
    }
  }
  return { columns, rows };
}

/** 컬럼명→인덱스 접근기. */
export function accessor(cols: string[]) {
  const idx: Record<string, number> = {};
  cols.forEach((c, i) => (idx[c] = i));
  return (row: Row, name: string, dflt = ""): string => {
    const i = idx[name];
    if (i == null || i >= row.length) return dflt;
    const v = row[i];
    return v == null ? dflt : v;
  };
}
