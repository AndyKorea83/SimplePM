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
