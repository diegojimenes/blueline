import {
  canonicalPathOf,
  couplingOf,
  domainOf,
  layerOf,
  moduleOfPath,
  type SerializedGraph,
  type SerializedNode,
} from "../../core";
import { demoSources } from "../demo/demoGraph";
import { useStore } from "../store";

export function Inspector() {
  const graph = useStore((s) => s.graph);
  const focus = useStore((s) => s.focus);
  const selected = useStore((s) => s.selected);
  const level = useStore((s) => s.level);
  const lens = useStore((s) => s.lens);
  const config = useStore((s) => s.config);
  const gotoId = useStore((s) => s.gotoId);

  const targetId = selected ?? focus;
  const node = targetId && graph ? graph.nodes.find((n) => n.id === targetId) : undefined;

  if (!graph || !node) {
    return (
      <section className="panel panel-inspector" aria-label="Inspector">
        <div className="panel-title">Inspector</div>
        <div className="panel-body">
          <p className="placeholder">Selecione um nó para ver métricas, código e chamadas</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel panel-inspector" aria-label="Inspector">
      <div className="panel-title">
        <span>{node.kind}</span>
        <span className="badge">nível {level}</span>
      </div>
      <div className="panel-body inspector-body">
        <h2 className="inspector-name">{canonicalPathOf(graph, node.id)}</h2>
        <dl className="inspector-meta">
          <dt>arquivo</dt>
          <dd>{node.kind === "module" ? node.path : node.kind === "project" ? "—" : node.file}</dd>
          {node.kind === "method" || node.kind === "class" ? <><dt>linha</dt><dd>{node.startLine}</dd></> : null}
          {node.kind === "module" ? <><dt>classes</dt><dd>{classesOf(graph, node).length}</dd></> : null}
          {node.kind !== "project" ? (
            <>
              <dt>camada</dt><dd>{layerOf(node, config)}</dd>
              <dt>domínio</dt><dd>{domainOf(node, config)}</dd>
            </>
          ) : null}
          {node.kind !== "project" ? (
            <>
              <dt>acoplamento</dt><dd>{couplingOf(graph, node)}</dd>
            </>
          ) : null}
        </dl>
        {node.kind === "class" || node.kind === "module" ? (
          <p className="lens-hint">
            lente <strong>{lens}</strong> — aperte <kbd>l</kbd> para alternar
          </p>
        ) : null}

        {node.kind === "method" ? <CallLists node={node} onGoto={gotoId} /> : null}

        {isCodeNode(node) && <CodeView file={node.file} startLine={node.startLine} />}
      </div>
    </section>
  );
}

function classesOf(
  graph: SerializedGraph,
  node: Extract<SerializedNode, { kind: "module" }>,
): SerializedNode[] {
  return graph.nodes.filter((n) => n.kind === "class" && moduleOfPath(n.file, useStore.getState().config) === node.path);
}

function isCodeNode(node: SerializedNode): node is Extract<SerializedNode, { kind: "class" | "method" }> {
  return node.kind === "class" || node.kind === "method";
}

function CallLists({ node, onGoto }: { node: Extract<SerializedNode, { kind: "method" }>; onGoto: (id: string) => void }) {
  const graph = useStore((s) => s.graph)!;
  const out = graph.edges.filter((e) => e.type === "call" && e.from === node.id);
  const incoming = graph.edges.filter((e) => e.type === "call" && e.to === node.id);
  if (out.length === 0 && incoming.length === 0) return null;

  return (
    <div className="inspector-calls">
      {out.length > 0 && (
        <div>
          <h3>Chama</h3>
          <ul>
            {out.map((e) => (
              <li key={e.id}>
                <button type="button" className="call-link" onClick={() => onGoto(e.to)}>
                  → {canonicalPathOf(graph, e.to)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {incoming.length > 0 && (
        <div>
          <h3>Chamado por</h3>
          <ul>
            {incoming.map((e) => (
              <li key={e.id}>
                <button type="button" className="call-link" onClick={() => onGoto(e.from)}>
                  ← {canonicalPathOf(graph, e.from)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CodeView({ file, startLine }: { file: string; startLine: number }) {
  const source = demoSources[file];
  if (source === undefined) {
    return <p className="placeholder code-missing">código-fonte não disponível na demo</p>;
  }
  const lines = source.split("\n");
  const highlight = startLine - 1;
  return (
    <pre className="code-block">
      {lines.map((line, i) => (
        <div key={i} className={i === highlight ? "code-line code-line-hl" : "code-line"}>
          <span className="code-ln">{i + 1}</span>
          <span className="code-txt">{line || " "}</span>
        </div>
      ))}
    </pre>
  );
}
