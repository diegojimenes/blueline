import type { FileSymbols, Parser } from "./types";

/**
 * Agrega múltiplos parsers de linguagem (TS/JS, Python, etc.)
 * num único ponto de entrada para o pipeline de análise (M11).
 */
export class CompositeParser implements Parser {
  private parsers: Parser[] = [];

  constructor(parsers: Parser[] = []) {
    this.parsers = parsers;
  }

  register(parser: Parser): void {
    this.parsers.push(parser);
  }

  supports(file: string): boolean {
    return this.parsers.some((p) => p.supports(file));
  }

  parseFile(file: string, content: string): FileSymbols {
    const parser = this.parsers.find((p) => p.supports(file));
    if (!parser) {
      return {
        file,
        classes: [],
        methods: [],
        locals: [],
        imports: [],
        calls: [],
      };
    }
    return parser.parseFile(file, content);
  }
}
