/**
 * Motor de Syntax Highlighting leve e Word-Level Diff para BlueLine.
 * 
 * Fornece:
 * 1. Tokenização e colorização de sintaxe sem dependências pesadas externas.
 * 2. Comparação palavra por palavra (word-level diff) para destacar trechos exatos modificados.
 * 3. Parser e formatador de hunks de diff com estatísticas de linhas.
 */

export type TokenType =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "type"
  | "function"
  | "operator"
  | "punctuation"
  | "variable"
  | "text";

export interface CodeToken {
  type: TokenType;
  text: string;
}

export interface WordDiffChunk {
  type: "same" | "add" | "del";
  text: string;
}

export interface CleanDiffLine {
  type: "add" | "del" | "ctx";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  wordChunks?: WordDiffChunk[];
}

export interface CleanDiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: CleanDiffLine[];
}

export interface ParsedDiffResult {
  fileSummary: {
    additions: number;
    deletions: number;
    hunkCount: number;
  };
  hunks: CleanDiffHunk[];
}

const PRIMITIVE_TYPES = new Set([
  "string", "number", "boolean", "any", "void", "never", "unknown", "undefined",
  "null", "symbol", "bigint", "object", "Promise", "Array", "Record", "Map", "Set",
]);

const KEYWORDS = new Set([
  // JS/TS
  "abstract", "as", "async", "await", "break", "case", "catch",
  "class", "const", "continue", "debugger", "declare", "default", "delete", "do",
  "else", "enum", "export", "extends", "false", "finally", "for", "from",
  "function", "get", "if", "implements", "import", "in", "instanceof", "interface",
  "is", "keyof", "let", "module", "namespace", "new", "of", "package", "private",
  "protected", "public", "readonly", "require", "return", "set", "static", "super",
  "switch", "this", "throw", "true", "try", "type", "typeof", "var",
  "while", "with", "yield",
  // Python
  "def", "elif", "except", "global", "lambda", "nonlocal", "pass", "raise",
  "None", "True", "False", "self", "cls",
  // Rust
  "fn", "pub", "struct", "impl", "trait", "mut", "ref", "match", "use", "mod",
  "where", "loop", "unsafe",
]);

/**
 * Tokeniza uma linha de código em tokens de sintaxe estilizados.
 */
export function highlightCodeLine(line: string): CodeToken[] {
  if (!line) return [{ type: "text", text: "" }];

  const tokens: CodeToken[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    const char = line[i];

    // Comentário de linha // ou #
    if ((char === "/" && line[i + 1] === "/") || char === "#") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }

    // Comentário em bloco /* ... */
    if (char === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end !== -1) {
        tokens.push({ type: "comment", text: line.slice(i, end + 2) });
        i = end + 2;
        continue;
      } else {
        tokens.push({ type: "comment", text: line.slice(i) });
        break;
      }
    }

    // Strings entre aspas simples, duplas ou crases
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let str = quote;
      let j = i + 1;
      let escaped = false;
      while (j < len) {
        const c = line[j];
        str += c;
        if (c === "\\" && !escaped) {
          escaped = true;
        } else if (c === quote && !escaped) {
          j++;
          break;
        } else {
          escaped = false;
        }
        j++;
      }
      tokens.push({ type: "string", text: str });
      i = j;
      continue;
    }

    // Números
    if (/\d/.test(char) && (i === 0 || /[\s,;([{\-+*/%=&|!<>:]/.test(line[i - 1]))) {
      let num = "";
      let j = i;
      while (j < len && /[\d.xXa-fA-F_]/.test(line[j])) {
        num += line[j];
        j++;
      }
      tokens.push({ type: "number", text: num });
      i = j;
      continue;
    }

    // Identificadores, palavras-chave e tipos
    if (/[a-zA-Z_$]/.test(char)) {
      let ident = "";
      let j = i;
      while (j < len && /[a-zA-Z0-9_$]/.test(line[j])) {
        ident += line[j];
        j++;
      }

      if (KEYWORDS.has(ident)) {
        tokens.push({ type: "keyword", text: ident });
      } else if (PRIMITIVE_TYPES.has(ident) || /^[A-Z][a-zA-Z0-9_$]*$/.test(ident)) {
        tokens.push({ type: "type", text: ident });
      } else if (j < len && line.slice(j).trim().startsWith("(")) {
        tokens.push({ type: "function", text: ident });
      } else {
        tokens.push({ type: "variable", text: ident });
      }
      i = j;
      continue;
    }

    // Pontuação e operadores
    if (/[{}()[\].,;:?]/.test(char)) {
      tokens.push({ type: "punctuation", text: char });
      i++;
      continue;
    }

    if (/[+\-*/%=&|!<>~^]/.test(char)) {
      tokens.push({ type: "operator", text: char });
      i++;
      continue;
    }

    // Espaços ou outros caracteres
    let text = "";
    while (i < len && !/[a-zA-Z0-9_$"'/`#{}()[\].,;:?+\-*/%=&|!<>~^]/.test(line[i])) {
      text += line[i];
      i++;
    }
    if (text) {
      tokens.push({ type: "text", text });
    }
  }

  return tokens;
}

/**
 * Divide uma string em tokens de palavras e pontuações para diff fino.
 */
function splitIntoWords(str: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let isWord = false;

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const charIsWord = /[a-zA-Z0-9_$]/.test(c);

    if (i === 0) {
      current = c;
      isWord = charIsWord;
      continue;
    }

    if (charIsWord === isWord) {
      current += c;
    } else {
      chunks.push(current);
      current = c;
      isWord = charIsWord;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Calcula o diff palavra a palavra (word-level diff) entre uma versão antiga e nova.
 */
export function computeWordDiff(oldText: string, newText: string): { oldChunks: WordDiffChunk[]; newChunks: WordDiffChunk[] } {
  const oldWords = splitIntoWords(oldText);
  const newWords = splitIntoWords(newText);

  // Se são idênticas
  if (oldText === newText) {
    return {
      oldChunks: [{ type: "same", text: oldText }],
      newChunks: [{ type: "same", text: newText }],
    };
  }

  // Matriz de maior subsequência comum (LCS simples para linhas)
  const dp: number[][] = Array(oldWords.length + 1)
    .fill(0)
    .map(() => Array(newWords.length + 1).fill(0));

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstrói as alterações
  let i = oldWords.length;
  let j = newWords.length;
  const oldRes: WordDiffChunk[] = [];
  const newRes: WordDiffChunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      oldRes.unshift({ type: "same", text: oldWords[i - 1] });
      newRes.unshift({ type: "same", text: newWords[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newRes.unshift({ type: "add", text: newWords[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      oldRes.unshift({ type: "del", text: oldWords[i - 1] });
      i--;
    }
  }

  return { oldChunks: mergeAdjacent(oldRes), newChunks: mergeAdjacent(newRes) };
}

function mergeAdjacent(chunks: WordDiffChunk[]): WordDiffChunk[] {
  if (chunks.length === 0) return [];
  const merged: WordDiffChunk[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = chunks[i];
    if (prev.type === cur.type) {
      prev.text += cur.text;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Faz o parse de diff limpo com hunks estruturados, contadores e word-diff pareado.
 */
export function parseCleanDiff(diffText: string): ParsedDiffResult {
  if (!diffText || !diffText.trim()) {
    return {
      fileSummary: { additions: 0, deletions: 0, hunkCount: 0 },
      hunks: [],
    };
  }

  const rawLines = diffText.split(/\r?\n/);
  const hunks: CleanDiffHunk[] = [];
  let currentHunk: CleanDiffHunk | null = null;
  let oldLine = 1;
  let newLine = 1;
  let totalAdd = 0;
  let totalDel = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Ignora headers brutos do git
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    }

    // Início de Hunk
    if (line.startsWith("@@ ")) {
      if (currentHunk) {
        pairAndHighlightHunkLines(currentHunk);
        hunks.push(currentHunk);
      }
      const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/.exec(line);
      const oldStart = match ? parseInt(match[1], 10) : 1;
      const oldCount = match && match[2] !== undefined ? parseInt(match[2], 10) : 1;
      const newStart = match ? parseInt(match[3], 10) : 1;
      const newCount = match && match[4] !== undefined ? parseInt(match[4], 10) : 1;
      const extraContext = match ? match[5].trim() : "";

      oldLine = oldStart;
      newLine = newStart;

      currentHunk = {
        header: extraContext ? `Linha ${newStart}: ${extraContext}` : `Linha ${newStart}`,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "add",
        newLineNumber: newLine++,
        content: line.slice(1),
      });
      totalAdd++;
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "del",
        oldLineNumber: oldLine++,
        content: line.slice(1),
      });
      totalDel++;
    } else if (line.startsWith(" ") || line === "") {
      currentHunk.lines.push({
        type: "ctx",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line.startsWith(" ") ? line.slice(1) : line,
      });
    }
  }

  if (currentHunk) {
    pairAndHighlightHunkLines(currentHunk);
    hunks.push(currentHunk);
  }

  return {
    fileSummary: {
      additions: totalAdd,
      deletions: totalDel,
      hunkCount: hunks.length,
    },
    hunks,
  };
}

/**
 * Pareia linhas consecutivas de del e add para aplicar word-level diff.
 */
function pairAndHighlightHunkLines(hunk: CleanDiffHunk) {
  let i = 0;
  while (i < hunk.lines.length) {
    const line = hunk.lines[i];
    if (line.type === "del" && i + 1 < hunk.lines.length && hunk.lines[i + 1].type === "add") {
      const delLine = line;
      const addLine = hunk.lines[i + 1];
      const { oldChunks, newChunks } = computeWordDiff(delLine.content, addLine.content);
      delLine.wordChunks = oldChunks;
      addLine.wordChunks = newChunks;
      i += 2;
    } else {
      i++;
    }
  }
}
