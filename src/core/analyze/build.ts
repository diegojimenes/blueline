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

    if (symbols.classes.length === 0) {
      if (symbols.methods.length > 0) {
        const name = stripExtension(basename(path));
        const classId = `class:${path}:${name}`;
        nodes.set(classId, { kind: "class", id: classId, name, file: path, startLine: 1 });
        classIds.push(classId);
      }
    } else {
      for (const cls of symbols.classes) {
        const classId = `class:${path}:${cls.name}`;
        nodes.set(classId, {
          kind: "class",
          id: classId,
          name: cls.name,
          file: path,
          startLine: cls.startLine,
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
      const fileClassId = `class:${path}:${stripExtension(basename(path))}`;
      if (!nodes.has(fileClassId)) {
        nodes.set(fileClassId, {
          kind: "class",
          id: fileClassId,
          name: stripExtension(basename(path)),
          file: path,
          startLine: 1,
        });
        classIds.push(fileClassId);
      }
    }
    for (const m of symbols.methods) {
      const fileClassId = `class:${path}:${stripExtension(basename(path))}`;
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
      const ownerId = findOwnerMethodId(records, call);
      if (!ownerId) continue;
      const targetId = resolveCallTarget(call.target, path, methodRecordsByFile, methodsByName);
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

function resolveCallTarget(
  target: string,
  file: string,
  methodRecordsByFile: Map<string, MethodRecord[]>,
  methodsByName: Map<string, NodeId[]>,
): NodeId | undefined {
  const sameFile = methodRecordsByFile.get(file)?.filter((r) => r.symbol.name === target);
  if (sameFile && sameFile.length === 1) return sameFile[0].id;
  const all = methodsByName.get(target);
  if (all && all.length === 1) return all[0];
  return undefined;
}

function findOwnerMethodId(records: MethodRecord[], call: CallSymbol): NodeId | undefined {
  let best: MethodRecord | undefined;
  for (const record of records) {
    const s = record.symbol;
    if (s.name === call.owner && s.startLine <= call.line && call.line <= s.endLine) {
      if (!best || s.startLine > best.symbol.startLine) best = record;
    }
  }
  return best?.id;
}

function push(index: Map<NodeId, NodeId[]>, from: NodeId, to: NodeId): void {
  const list = index.get(from) ?? [];
  if (!list.includes(to)) list.push(to);
  index.set(from, list);
}
