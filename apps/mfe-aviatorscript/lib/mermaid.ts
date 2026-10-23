import type { AviatorFlowGraph } from "./visualization";

export function mermaidNodeId(nodeId: string) {
  return nodeId.replace(/[^A-Za-z0-9_]/g, "_");
}

export function escapeMermaidLabel(value: string) {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "#92;")
    .replace(/"/g, "#quot;")
    .trim();
}

export function buildMermaidFlowchart(graph: AviatorFlowGraph) {
  const lines = ["flowchart TD"];
  graph.nodes.forEach((node) => {
    const label = escapeMermaidLabel(node.data.label);
    const shape = node.data.kind === "decision" ? `{\"${label}\"}`
      : node.data.kind === "start" || node.data.kind === "end" ? `(["${label}"])`
        : node.data.kind === "iteration" ? `{{"${label}"}}` : `["${label}"]`;
    lines.push(`  ${mermaidNodeId(node.id)}${shape}`);
  });
  graph.edges.forEach((edge) => {
    const label = edge.label ? `|${escapeMermaidLabel(String(edge.label)).replace(/\|/g, "#124;")}|` : "";
    lines.push(`  ${mermaidNodeId(edge.source)} -->${label} ${mermaidNodeId(edge.target)}`);
  });
  return lines.join("\n");
}

function containsMermaidId(line: string, nodeId: string) {
  return new RegExp(`(?:^|[^A-Za-z0-9_])${nodeId}(?=$|[^A-Za-z0-9_])`).test(line);
}

function isMermaidEdgeSource(line: string, nodeId: string) {
  return new RegExp(`^\\s*${nodeId}\\s+--?>`).test(line);
}

/**
 * Applies a graph projection to the editable Mermaid source without replacing
 * labels or styles that the user may have edited manually.
 */
export function collapseMermaidFlowchart(source: string, originalGraph: AviatorFlowGraph, visibleGraph: AviatorFlowGraph) {
  const visibleIds = new Set(visibleGraph.nodes.map((node) => node.id));
  const hiddenIds = originalGraph.nodes
    .filter((node) => !visibleIds.has(node.id))
    .map((node) => mermaidNodeId(node.id));
  const collapsedRootIds = visibleGraph.edges
    .filter((edge) => edge.id.startsWith("collapsed-") && !edge.source.startsWith("collapsed-content-"))
    .map((edge) => mermaidNodeId(edge.source));
  if (!hiddenIds.length) return source;

  const lines = source.split(/\r?\n/).filter((line) => {
    if (line.includes("-->") && (hiddenIds.some((nodeId) => containsMermaidId(line, nodeId)) || collapsedRootIds.some((nodeId) => isMermaidEdgeSource(line, nodeId)))) return false;
    if (hiddenIds.some((nodeId) => new RegExp(`^\\s*${nodeId}(?=$|[([{\\s])`).test(line))) return false;
    return true;
  });
  visibleGraph.nodes
    .filter((node) => node.id.startsWith("collapsed-content-"))
    .forEach((node) => lines.push(`  ${mermaidNodeId(node.id)}["${escapeMermaidLabel(node.data.label)}"]`));
  const collapsedEdges = visibleGraph.edges.filter((edge) => edge.id.startsWith("collapsed-"));
  collapsedEdges.forEach((edge) => {
    const label = edge.label ? `|${escapeMermaidLabel(String(edge.label)).replace(/\|/g, "#124;")}|` : "";
    lines.push(`  ${mermaidNodeId(edge.source)} -->${label} ${mermaidNodeId(edge.target)}`);
  });
  return lines.join("\n");
}
