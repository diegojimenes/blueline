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

/** Função aninhada dentro de um método/função (nível 5). */
export interface LocalSymbol extends MethodSymbol {
  /** Nome do método/função que a contém. */
  owner: string;
}

export interface ClassSymbol {
  name: string;
  startLine: number;
  endLine?: number;
  methods: MethodSymbol[];
}

export interface ImportedItem {
  name: string;
  alias?: string;
}

export interface ImportSymbol {
  /** Caminho de origem cru (ex.: `./auth/AuthService`). */
  from: string;
  /** Símbolos importados (quando listáveis). */
  symbols?: string[];
  /** Itens importados com alias (ex.: import { x as y }). */
  items?: ImportedItem[];
  /** Nome da importação default ou namespace (ex.: import * as X / import X). */
  defaultOrNamespace?: string;
}

export interface CallSymbol {
  /** Nome do alvo da chamada (método/função). */
  target: string;
  /** Receptor da chamada quando aplicável (ex.: 'this', 'super', 'api'). */
  receiver?: string;
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
  /** Funções aninhadas dentro de métodos (nível 5). */
  locals: LocalSymbol[];
  imports: ImportSymbol[];
  calls: CallSymbol[];
}

export interface Parser {
  supports(file: string): boolean;
  parseFile(file: string, content: string): FileSymbols;
}
