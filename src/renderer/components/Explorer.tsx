import { useEffect, useMemo, useRef, useState } from "react";
import { ancestorChain, moduleOfPath, type NodeId, type SerializedNode } from "../../core";
import { useStore } from "../store";

export function Explorer() {
  const graph = useStore((s) => s.graph);
  const config = useStore((s) => s.config);
  const projectOpen = useStore((s) => s.projectOpen);
  const selected = useStore((s) => s.selected);
  const gotoId = useStore((s) => s.gotoId);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["project"]));
  const selectedRef = useRef<HTMLLIElement | null>(null);

  const tree = useMemo<ExplorerTree | null>(() => {
    if (!graph) return null;
    const modules = graph.nodes
      .filter((n): n is Extract<SerializedNode, { kind: "module" }> => n.kind === "module")
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const classesOf = (module: Extract<SerializedNode, { kind: "module" }>) =>
      graph.nodes
        .filter(
          (n): n is Extract<SerializedNode, { kind: "class" }> =>
            n.kind === "class" && moduleOfPath(n.file, config) === module.path,
        )
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const methodsOf = (cls: Extract<SerializedNode, { kind: "class" }>) =>
      graph.nodes
        .filter((n): n is Extract<SerializedNode, { kind: "method" }> => n.kind === "method" && n.owner === cls.id)
        .sort((a, b) => a.startLine - b.startLine);
    return {
      project: graph.nodes.find((n) => n.kind === "project"),
      modules,
      classesOf,
      methodsOf,
    };
  }, [graph, config]);

  // Mantém a trilha do nó selecionado expandida (sync seleção ↔ árvore).
  useEffect(() => {
    if (!graph || !selected) return;
    const ancestors = ancestorChain(graph, selected, config);
    setExpanded((prev) => new Set([...prev, ...ancestors]));
  }, [selected, graph, config]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const toggle = (id: NodeId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!projectOpen || !tree || !tree.project) {
    return (
      <section className="panel panel-explorer" aria-label="Explorer">
        <div className="panel-title">Explorer</div>
        <div className="panel-body explorer-body">
          <p className="placeholder">Nenhum projeto aberto</p>
        </div>
      </section>
    );
  }
  const project = tree.project;

  return (
    <section className="panel panel-explorer" aria-label="Explorer">
      <div className="panel-title">Explorer</div>
      <div className="panel-body explorer-body">
        <ul className="tree" role="tree">
          <TreeItem
            node={project}
            label={project.name}
            depth={0}
            expanded={expanded.has(project.id)}
            hasChildren={tree.modules.length > 0}
            isSelected={selected === project.id}
            onToggle={() => toggle(project.id)}
            onSelect={() => gotoId(project.id)}
            innerRef={selected === project.id ? selectedRef : undefined}
          >
              {tree.modules.map((m) => (
                <TreeItem
                  key={m.id}
                  node={m}
                  label={m.name}
                  depth={1}
                  expanded={expanded.has(m.id)}
                  hasChildren={tree.classesOf(m).length > 0}
                  isSelected={selected === m.id}
                  onToggle={() => toggle(m.id)}
                  onSelect={() => gotoId(m.id)}
                  innerRef={selected === m.id ? selectedRef : undefined}
                >
                  {tree.classesOf(m).map((c) => (
                    <TreeItem
                      key={c.id}
                      node={c}
                      label={c.name}
                      depth={2}
                      expanded={expanded.has(c.id)}
                      hasChildren={tree.methodsOf(c).length > 0}
                      isSelected={selected === c.id}
                      onToggle={() => toggle(c.id)}
                      onSelect={() => gotoId(c.id)}
                      innerRef={selected === c.id ? selectedRef : undefined}
                    >
                      {tree.methodsOf(c).map((me) => (
                        <TreeItem
                          key={me.id}
                          node={me}
                          label={me.name}
                          depth={3}
                          expanded={false}
                          hasChildren={false}
                          isSelected={selected === me.id}
                          onToggle={() => toggle(me.id)}
                          onSelect={() => gotoId(me.id)}
                          innerRef={selected === me.id ? selectedRef : undefined}
                        />
                      ))}
                    </TreeItem>
                  ))}
                </TreeItem>
              ))}
            </TreeItem>
        </ul>
      </div>
    </section>
  );
}

interface ExplorerTree {
  project?: SerializedNode;
  modules: Extract<SerializedNode, { kind: "module" }>[];
  classesOf: (module: Extract<SerializedNode, { kind: "module" }>) => Extract<SerializedNode, { kind: "class" }>[];
  methodsOf: (cls: Extract<SerializedNode, { kind: "class" }>) => Extract<SerializedNode, { kind: "method" }>[];
}

interface TreeItemProps {
  node: SerializedNode;
  label: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  innerRef?: React.Ref<HTMLLIElement>;
  children?: React.ReactNode;
}

function TreeItem({ node, label, depth, expanded, hasChildren, isSelected, onToggle, onSelect, innerRef, children }: TreeItemProps) {
  const kindClass = `tree-item tree-kind-${node.kind}`;
  return (
    <li className={kindClass} role="treeitem" aria-selected={isSelected} ref={innerRef}>
      <div
        className={isSelected ? "tree-row tree-row-selected" : "tree-row"}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          type="button"
          className={hasChildren ? "tree-toggle" : "tree-toggle tree-toggle-empty"}
          onClick={onToggle}
          aria-label={expanded ? "recolher" : "expandir"}
        >
          {hasChildren ? (expanded ? "▾" : "▸") : ""}
        </button>
        <button type="button" className="tree-label" onClick={onSelect}>
          {label}
        </button>
      </div>
      {expanded && hasChildren && <ul role="group">{children}</ul>}
    </li>
  );
}
