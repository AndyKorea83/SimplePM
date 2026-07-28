import type { GanttTaskNode, TaskDTO } from './types'

// MSPDI's task order is depth-first outline order, so a single pass with a
// uid -> node map (built in order) is enough to attach each task to its
// parent's children array.
export function buildTaskTree(tasks: TaskDTO[]): GanttTaskNode[] {
  const nodesByUid = new Map<number, GanttTaskNode>()
  const roots: GanttTaskNode[] = []

  for (const task of tasks) {
    const parent = task.parentUid !== undefined ? nodesByUid.get(task.parentUid) : undefined
    const node: GanttTaskNode = { ...task, depth: parent ? parent.depth + 1 : 0, children: [] }
    nodesByUid.set(task.uid, node)

    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

// Prunes the tree to leaves matching `predicate` plus every ancestor needed
// to reach them, so filtered-out branches disappear but surviving tasks
// keep their stage/group context. A summary node survives only if at least
// one descendant does; predicate only applies to leaves.
export function filterTaskTree(nodes: GanttTaskNode[], predicate: (leaf: GanttTaskNode) => boolean): GanttTaskNode[] {
  const result: GanttTaskNode[] = []

  for (const node of nodes) {
    if (node.children.length === 0) {
      if (predicate(node)) result.push(node)
      continue
    }

    const children = filterTaskTree(node.children, predicate)
    if (children.length > 0) {
      result.push({ ...node, children })
    }
  }

  return result
}

export function flattenVisible(
  nodes: GanttTaskNode[],
  collapsed: ReadonlySet<number>,
  out: GanttTaskNode[] = [],
): GanttTaskNode[] {
  for (const node of nodes) {
    out.push(node)
    if (node.children.length > 0 && !collapsed.has(node.uid)) {
      flattenVisible(node.children, collapsed, out)
    }
  }
  return out
}
