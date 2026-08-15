/**
 * Contrato de parsing (specs/04-analysis-pipeline.md).
 *
 * `Parser` é o ponto de extensão de linguagem (D5): MVP implementa apenas
 * TypeScript/JavaScript; outras linguagens entram com novas implementações.
 */

export interface MethodSymbol {
  name: string;
  /** Linha 1-based. */
  startLine: number;
  /** Linha 1-based (inclusive). */
  endLine: number;
}

export interface ClassSymbol {
  name: string;
  startLine: number;
  methods: MethodSymbol[];
}

export interface ImportSymbol {
  /** Caminho de origem cru (ex.: `./auth/AuthService`). */
  from: string;
  /** Símbolos importados (quando listáveis). */
  symbols?: string[];
}

export interface CallSymbol {
  /** Nome do alvo da chamada (método/função). */
  target: string;
  line: number;
  col: number;
  /** Nome do método que contém a chamada (preenchido na atribuição por range). */
  owner?: string;
}

export interface FileSymbols {
  /** Caminho relativo ao projeto (forward slashes). */
  file: string;
  classes: ClassSymbol[];
  /** Funções/funções-arrow de topo de arquivo. */
  methods: MethodSymbol[];
  imports: ImportSymbol[];
  calls: CallSymbol[];
}

export interface Parser {
  supports(file: string): boolean;
  parseFile(file: string, content: string): FileSymbols;
}
