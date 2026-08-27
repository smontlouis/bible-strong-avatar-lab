import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

const textblockAtPosition = (document: ProseMirrorNode, position: number) => {
  let closest: { node: ProseMirrorNode; start: number; distance: number } | undefined

  document.descendants((node, nodePosition) => {
    if (!node.isTextblock) return true
    const start = nodePosition + 1
    const end = start + node.content.size
    const distance = position < start ? start - position : position > end ? position - end : 0
    if (!closest || distance < closest.distance) closest = { node, start, distance }
    return false
  })

  return closest
}

export const talkCueDropPositions = (document: ProseMirrorNode, position: number) => {
  const textblock = textblockAtPosition(document, position)
  if (!textblock) return []
  const positions = new Set([textblock.start, textblock.start + textblock.node.content.size])

  textblock.node.forEach((child, offset) => {
    if (!child.isText || !child.text) return
    for (const match of child.text.matchAll(/\s+/g)) {
      if (match.index === undefined) continue
      positions.add(textblock.start + offset + match.index + match[0].length)
    }
  })

  return [...positions].sort((left, right) => left - right)
}

export const nearestTalkCueDropPosition = (
  document: ProseMirrorNode,
  position: number
): number | null => {
  const positions = talkCueDropPositions(document, position)
  return (
    positions.reduce<number | null>((closest, candidate) => {
      if (closest === null) return candidate
      return Math.abs(candidate - position) < Math.abs(closest - position) ? candidate : closest
    }, null) ?? null
  )
}

export const talkCueInsertionAfterMove = (source: number, size: number, target: number) =>
  target > source ? target - size : target
