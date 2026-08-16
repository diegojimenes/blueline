import type { CodeGraph, Edge, EdgeId, Node, NodeId, ProjectConfig } from "../model/types";
import { basename, dirname, resolveRelative, stripExtension } from "../path";
import type { CallSymbol, FileSymbols, MethodSymbol } from "../parse/types";

export interface BuildFileInput {
  path: string;
  symbols: FileSymbols;
}

export interface BuildStats {
  files: number;
  importsResolved: number;
  importsUnresolved: number;
  callsResolved: number;
  callsUnresolved: number;
}

export interface BuildResult {
  graph: CodeGraph;
  stats: BuildStats;
}

const TS_EXTS = [".ts", ".tsx", ".js", ".jsx"];
const DEFAULT_ROOT_PREFIXES = ["src", "lib", "app"];

interface MethodRecord {
  symbol: MethodSymbol;
  id: NodeId;
}

/**
 * Constrói o CodeGraph a partir dos símbolos por arquivo (specs/03-data-model.md).
 * IDs estáveis: derivados de caminho + símbolo, nunca de posição.
 */
export function buildGraph(files: BuildFileInput[], projectRoot: string, config: ProjectConfig = {}): BuildResult {
  const nodes = new Map<NodeId, Node>();
  const edges = new Map<EdgeId, Edge>();
  const byFile = new Map<string, NodeId[]>();
  const byModule = new Map<NodeId, NodeId[]>();
  const callsIn = new Map<NodeId, NodeId[]>();
  const callsOut = new Map<NodeId, NodeId[]>();

  const fileSet = new Set(files.map((f) => f.path));

  const projectId = "project";
  nodes.set(projectId, { kind: "project", id: projectId, name: basename(projectRoot) || projectRoot });

  const fileClasses = new Map<string, NodeId[]>();
  const methodRecordsByFile = new Map<string, MethodRecord[]>();
  const methodsByName = new Map<string, NodeId[]>();

  for (const { path, symbols } of files) {
    const moduleId = moduleNode(nodes, path, config, projectRoot);

    const classIds: NodeId[] = [];
    const records: MethodRecord[] = [];

    const fileBase = stripExtension(basename(path));

    if (symbols.classes.length === 0) {
      if (symbols.methods.length > 0) {
        const name = fileBase;
        const classId = `class:${path}:${name}`;
        nodes.set(classId, { kind: "class", id: classId, name, file: path, startLine: 1, endLine: symbols.methods[symbols.methods.length - 1]?.endLine, isSecondary: false });
        classIds.push(classId);
      }
    } else {
      for (const cls of symbols.classes) {
        const classId = `class:${path}:${cls.name}`;
        const isSecondary = cls.name.toLowerCase() !== fileBase.toLowerCase();
        nodes.set(classId, {
          kind: "class",
          id: classId,
          name: cls.name,
          file: path,
          startLine: cls.startLine,
          endLine: cls.endLine,
          isSecondary,
        });
        classIds.push(classId);
      }
    }

    for (const cls of symbols.classes) {
      const classId = `class:${path}:${cls.name}`;
      for (const m of cls.methods) {
        records.push(addMethod(m, classId, path));
      }
    }
    if (classIds.length > 0 && symbols.methods.length > 0) {
      // Arquivo com classes + funções top-level: funções vão para o nó de arquivo.
      const fileClassId = `class:${path}:${fileBase}`;
      if (!nodes.has(fileClassId)) {
        nodes.set(fileClassId, {
          kind: "class",
          id: fileClassId,
          name: fileBase,
          file: path,
          startLine: 1,
          endLine: symbols.methods[symbols.methods.length - 1]?.endLine,
          isSecondary: false,
        });
        classIds.push(fileClassId);
      }
    }
    for (const m of symbols.methods) {
      const fileClassId = `class:${path}:${fileBase}`;
      if (nodes.has(fileClassId)) records.push(addMethod(m, fileClassId, path));
    }

    byFile.set(path, classIds);
    fileClasses.set(path, classIds);
    methodRecordsByFile.set(path, records);
    for (const record of records) {
      const list = methodsByName.get(record.symbol.name) ?? [];
      list.push(record.id);
      methodsByName.set(record.symbol.name, list);
    }
    // Funções aninhadas (nível 5): nós `local` filiados ao método que as contém.
    const localIdByName = new Map<string, NodeId>();
    for (const local of symbols.locals) {
      const ownerId =
        localIdByName.get(local.owner) ?? records.find((r) => r.symbol.name === local.owner)?.id;
      if (!ownerId) continue;
      const localId = `local:${path}:${ownerId}:${local.name}`;
      nodes.set(localId, {
        kind: "local",
        id: localId,
        name: local.name,
        file: path,
        startLine: local.startLine,
        endLine: local.endLine,
        owner: ownerId,
      });
      const memberEdgeId = `member:${ownerId}:${localId}`;
      edges.set(memberEdgeId, { id: memberEdgeId, type: "member", from: ownerId, to: localId });
      localIdByName.set(local.name, localId);
    }
    for (const classId of classIds) {
      const list = byModule.get(moduleId) ?? [];
      if (!list.includes(classId)) list.push(classId);
      byModule.set(moduleId, list);
    }
  }

  const stats: BuildStats = {
    files: files.length,
    importsResolved: 0,
    importsUnresolved: 0,
    callsResolved: 0,
    callsUnresolved: 0,
  };

  for (const { path, symbols } of files) {
    const fromClasses = fileClasses.get(path) ?? [];
    for (const imp of symbols.imports) {
      const targetFile = resolveImportTarget(imp.from, path, fileSet);
      const targetClasses = targetFile ? (fileClasses.get(targetFile) ?? []) : [];
      if (!targetFile || targetClasses.length === 0) {
        stats.importsUnresolved++;
        continue;
      }
      stats.importsResolved++;
      for (const fromClass of fromClasses) {
        for (const toClass of targetClasses) {
          if (fromClass === toClass) continue;
          const edgeId = `import:${fromClass}:${toClass}`;
          edges.set(edgeId, {
            id: edgeId,
            type: "import",
            from: fromClass,
            to: toClass,
            meta: { symbol: imp.symbols?.join(",") },
          });
        }
      }
    }
  }

  for (const { path, symbols } of files) {
    const records = methodRecordsByFile.get(path) ?? [];
    for (const call of symbols.calls) {
      const ownerRecord = findOwnerRecord(records, call);
      if (!ownerRecord) continue;
      const ownerId = ownerRecord.id;

      const targetId = resolveCallTargetDetailed(
        call,
        path,
        ownerRecord,
        symbols.imports,
        fileSet,
        methodRecordsByFile,
        methodsByName,
      );

      if (!targetId) {
        stats.callsUnresolved++;
        continue;
      }
      stats.callsResolved++;
      const edgeId = `call:${ownerId}:${targetId}`;
      edges.set(edgeId, {
        id: edgeId,
        type: "call",
        from: ownerId,
        to: targetId,
        meta: { line: call.line },
      });
      push(callsOut, ownerId, targetId);
      push(callsIn, targetId, ownerId);
    }
  }

  return {
    graph: { projectRoot, revision: 0, nodes, edges, indexes: { byFile, byModule, callsIn, callsOut } },
    stats,
  };

  function addMethod(m: MethodSymbol, ownerClassId: NodeId, path: string): MethodRecord {
    const methodId = `method:${path}:${ownerClassId}:${m.name}`;
    nodes.set(methodId, {
      kind: "method",
      id: methodId,
      name: m.name,
      file: path,
      startLine: m.startLine,
      endLine: m.endLine,
      owner: ownerClassId,
    });
    const memberId = `member:${ownerClassId}:${methodId}`;
    edges.set(memberId, { id: memberId, type: "member", from: ownerClassId, to: methodId });
    return { symbol: m, id: methodId };
  }
}

function moduleNode(nodes: Map<NodeId, Node>, path: string, config: ProjectConfig, projectRoot: string): NodeId {
  const modulePath = moduleOfPath(path, config);
  const moduleId = `module:${modulePath}`;
  if (!nodes.has(moduleId)) {
    const name = modulePath === "<root>" ? basename(projectRoot) || projectRoot : modulePath.split("/").pop() ?? "<root>";
    nodes.set(moduleId, { kind: "module", id: moduleId, name, path: modulePath });
  }
  return moduleId;
}

/** Agrupamento de módulo por convenção de caminho (specs/04-analysis-pipeline.md). */
export function moduleOfPath(relPath: string, config: ProjectConfig = {}): string {
  const dirs = dirname(relPath) === "" ? [] : dirname(relPath).split("/");
  const prefixes = config.rootPrefixes ?? DEFAULT_ROOT_PREFIXES;
  if (dirs.length > 0 && prefixes.includes(dirs[0])) dirs.shift();
  return dirs.join("/") || "<root>";
}

/** Resolve um import relativo para um arquivo conhecido (com extensões e /index). */
export function resolveImportTarget(spec: string, fromFile: string, fileSet: Set<string>): string | undefined {
  const base = resolveRelative(fromFile, spec);
  for (const ext of TS_EXTS) {
    if (fileSet.has(base + ext)) return base + ext;
  }
  for (const ext of TS_EXTS) {
    if (fileSet.has(base + "/index" + ext)) return base + "/index" + ext;
  }
  return undefined;
}

function resolveCallTargetDetailed(
  call: CallSymbol,
  currentFile: string,
  ownerRecord: MethodRecord,
  imports: FileSymbols["imports"],
  fileSet: Set<string>,
  methodRecordsByFile: Map<string, MethodRecord[]>,
  methodsByName: Map<string, NodeId[]>,
): NodeId | undefined {
  const targetName = call.target;
  const sameFileRecords = methodRecordsByFile.get(currentFile) ?? [];

  // 1. this.methodName() ou super.methodName() -> busca na mesma classe/arquivo
  if (call.receiver === "this" || call.receiver === "super") {
    // Procura método irmão com mesmo ownerClass
    const sibling = sameFileRecords.find(
      (r) => r.symbol.name === targetName && r.id.includes(ownerRecord.id.split(":").slice(0, 3).join(":")),
    );
    if (sibling) return sibling.id;
    const sameFileMatch = sameFileRecords.find((r) => r.symbol.name === targetName);
    if (sameFileMatch) return sameFileMatch.id;
  }

  // 2. Chamadas com receiver importado (ex.: Api.login() ou service.exec())
  if (call.receiver) {
    for (const imp of imports) {
      if (
        imp.defaultOrNamespace === call.receiver ||
        imp.symbols?.includes(call.receiver) ||
        imp.items?.some((it) => it.alias === call.receiver || it.name === call.receiver)
      ) {
        const targetFile = resolveImportTarget(imp.from, currentFile, fileSet);
        if (targetFile) {
          const targetFileRecords = methodRecordsByFile.get(targetFile) ?? [];
          const match = targetFileRecords.find((r) => r.symbol.name === targetName);
          if (match) return match.id;
        }
      }
    }
  }

  // 3. Chamadas a funções/métodos importados diretamente (ex.: login() vindo de import { login })
  for (const imp of imports) {
    let origSymbolName: string | undefined;
    if (imp.items) {
      const it = imp.items.find((item) => (item.alias ? item.alias === targetName : item.name === targetName));
      if (it) origSymbolName = it.name;
    } else if (imp.symbols?.includes(targetName)) {
      origSymbolName = targetName;
    }

    if (origSymbolName) {
      const targetFile = resolveImportTarget(imp.from, currentFile, fileSet);
      if (targetFile) {
        const targetRecords = methodRecordsByFile.get(targetFile) ?? [];
        const match = targetRecords.find((r) => r.symbol.name === origSymbolName);
        if (match) return match.id;
      }
    }
  }

  // 4. Chamada para função no mesmo arquivo
  const sameFileMatches = sameFileRecords.filter((r) => r.symbol.name === targetName);
  if (sameFileMatches.length === 1) return sameFileMatches[0].id;
  if (sameFileMatches.length > 1) {
    // Dá preferência ao da mesma classe se houver
    const classIdPrefix = ownerRecord.id.split(":").slice(0, 3).join(":");
    const sameClass = sameFileMatches.find((r) => r.id.startsWith(classIdPrefix));
    if (sameClass) return sameClass.id;
    return sameFileMatches[0].id;
  }

  // 5. Unambiguous global match
  const all = methodsByName.get(targetName);
  if (all && all.length === 1) return all[0];

  return undefined;
}

function findOwnerRecord(records: MethodRecord[], call: CallSymbol): MethodRecord | undefined {
  let best: MethodRecord | undefined;
  for (const record of records) {
    const s = record.symbol;
    if (s.name === call.owner && s.startLine <= call.line && call.line <= s.endLine) {
      if (!best || s.startLine > best.symbol.startLine) best = record;
    }
  }
  return best;
}

function push(index: Map<NodeId, NodeId[]>, from: NodeId, to: NodeId): void {
  const list = index.get(from) ?? [];
  if (!list.includes(to)) list.push(to);
  index.set(from, list);
}
