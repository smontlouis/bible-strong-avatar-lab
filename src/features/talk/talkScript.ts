export const DEFAULT_TALK_TRANSITION_MS = 500
export const MAX_TALK_TRANSITION_MS = 5_000
export const talkTransformAxes = ['tx', 'ty', 'tz', 'rx', 'ry', 'rz'] as const

export type TalkTransformAxis = (typeof talkTransformAxes)[number]
export type TalkTransform = Partial<Record<TalkTransformAxis, number>>
export type TalkCueKind = 'expression' | 'animation' | 'transform'

export type TalkTargetCue = {
  kind: 'expression' | 'animation'
  targetId: string
  label: string
  durationMs?: number
}

export type TalkTransformCue = {
  kind: 'transform'
  transform: TalkTransform
  label: string
  durationMs?: number
}

export type TalkCue = TalkTargetCue | TalkTransformCue

export type TalkScriptNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: TalkScriptNode[]
}

export type TalkScriptDocument = TalkScriptNode & {
  type: 'doc'
  content: TalkScriptNode[]
}

export type TimedTalkCue = TalkCue & {
  offset: number
}

export type CompiledTalkScript = {
  text: string
  cues: TimedTalkCue[]
}

export type TalkCueRegistry = {
  expressionIds: readonly string[]
  animationIds: readonly string[]
}

const TALK_SCRIPT_STORAGE_PREFIX = 'bible-strong-avatar-talk-script-v1:'

const blockNodeTypes = new Set(['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem'])
const bracketTagPattern = /\[[^\[\]\n]{1,160}\]/g
const durationTokenPattern = /(?:^|\s)duration\s*=\s*(\d+(?:\.\d+)?)ms\s*$/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTalkScriptNode = (value: unknown): value is TalkScriptNode => {
  if (!isRecord(value)) return false
  if (value.type !== undefined && typeof value.type !== 'string') return false
  if (value.text !== undefined && typeof value.text !== 'string') return false
  if (value.attrs !== undefined && !isRecord(value.attrs)) return false
  return (
    value.content === undefined ||
    (Array.isArray(value.content) && value.content.every(isTalkScriptNode))
  )
}

const parseDuration = (value: unknown) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= MAX_TALK_TRANSITION_MS
    ? value
    : undefined

const parseTransform = (attributes: Record<string, unknown>): TalkTransform =>
  Object.fromEntries(
    talkTransformAxes.flatMap(axis => {
      const value = attributes[axis]
      return typeof value === 'number' && Number.isFinite(value) ? [[axis, value]] : []
    })
  )

export type ParsedTalkTag =
  | { kind: 'target'; target: string; durationMs?: number }
  | { kind: 'transform'; transform: TalkTransform; durationMs?: number }

export const parseTalkTag = (value: string): ParsedTalkTag | null => {
  const source = value.trim()
  if (!source) return null
  const durationMatch = durationTokenPattern.exec(source)
  const durationMs = durationMatch ? Number(durationMatch[1]) : undefined
  if (durationMs !== undefined && durationMs > MAX_TALK_TRANSITION_MS) return null
  const withoutDuration = durationMatch ? source.slice(0, durationMatch.index).trim() : source
  if (!withoutDuration) return null

  const tokens = withoutDuration.split(/\s+/)
  if (tokens[0].toLocaleLowerCase() !== 'transform') {
    return {
      kind: 'target',
      target: withoutDuration,
      ...(durationMs === undefined ? {} : { durationMs }),
    }
  }

  const transform: TalkTransform = {}
  for (const token of tokens.slice(1)) {
    const match = /^(tx|ty|tz|rx|ry|rz)=(-?\d+(?:\.\d+)?)$/i.exec(token)
    if (!match) return null
    const axis = match[1].toLocaleLowerCase() as TalkTransformAxis
    const number = Number(match[2])
    if (!Number.isFinite(number)) return null
    transform[axis] = number
  }
  return {
    kind: 'transform',
    transform,
    ...(durationMs === undefined ? {} : { durationMs }),
  }
}

export const formatTalkTransformLabel = (transform: TalkTransform) => {
  const values = talkTransformAxes.flatMap(axis =>
    transform[axis] === undefined
      ? []
      : [`${axis.toUpperCase()}:${Math.round(transform[axis] * 100) / 100}`]
  )
  return values.join(' ') || 'Transform'
}

export const getTalkScriptStorageKey = (avatarId: string) =>
  `${TALK_SCRIPT_STORAGE_PREFIX}${encodeURIComponent(avatarId)}`

export const loadTalkScriptDocument = (
  avatarId: string,
  fallback: TalkScriptDocument,
  storage: Pick<Storage, 'getItem'> = window.localStorage
): TalkScriptDocument => {
  try {
    const candidate: unknown = JSON.parse(
      storage.getItem(getTalkScriptStorageKey(avatarId)) ?? 'null'
    )
    return isTalkScriptNode(candidate) &&
      candidate.type === 'doc' &&
      Array.isArray(candidate.content)
      ? (candidate as TalkScriptDocument)
      : fallback
  } catch {
    return fallback
  }
}

export const persistTalkScriptDocument = (
  avatarId: string,
  document: TalkScriptDocument,
  storage: Pick<Storage, 'setItem'> = window.localStorage
) => {
  try {
    storage.setItem(getTalkScriptStorageKey(avatarId), JSON.stringify(document))
    return true
  } catch {
    return false
  }
}

const cueFromNode = (node: TalkScriptNode, registry?: TalkCueRegistry): TalkCue | null => {
  if (node.type !== 'avatarCue') return null
  const kind = node.attrs?.kind
  const durationMs = parseDuration(node.attrs?.durationMs)
  if (kind === 'transform') {
    const transform = parseTransform(node.attrs ?? {})
    return {
      kind,
      transform,
      label:
        typeof node.attrs?.label === 'string' && node.attrs.label
          ? node.attrs.label
          : formatTalkTransformLabel(transform),
      ...(durationMs === undefined ? {} : { durationMs }),
    }
  }
  const targetId = node.attrs?.targetId
  const label = node.attrs?.label
  if ((kind !== 'expression' && kind !== 'animation') || typeof targetId !== 'string') return null
  const knownIds = kind === 'expression' ? registry?.expressionIds : registry?.animationIds
  if (knownIds && !knownIds.includes(targetId)) return null
  return {
    kind,
    targetId,
    label: typeof label === 'string' && label ? label : targetId,
    ...(kind === 'expression' && durationMs !== undefined ? { durationMs } : {}),
  }
}

export const createTalkScriptDocument = (text: string): TalkScriptDocument => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    },
  ],
})

export const compileTalkScript = (
  document: TalkScriptDocument,
  registry?: TalkCueRegistry
): CompiledTalkScript => {
  let text = ''
  const cues: TimedTalkCue[] = []

  const visit = (node: TalkScriptNode) => {
    const cue = cueFromNode(node, registry)
    if (cue) {
      cues.push({ ...cue, offset: text.length })
      return
    }
    if (node.type === 'text') {
      text += (node.text ?? '').replace(bracketTagPattern, '')
      return
    }
    if (node.type === 'hardBreak') {
      text += '\n'
      return
    }

    const start = text.length
    node.content?.forEach(visit)
    if (blockNodeTypes.has(node.type ?? '') && text.length > start && !text.endsWith('\n')) {
      text += '\n'
    }
  }

  document.content.forEach(visit)
  return { text: text.replace(/\n$/, ''), cues }
}

const serializeTalkCue = (node: TalkScriptNode) => {
  const attributes = node.attrs ?? {}
  const durationMs = parseDuration(attributes.durationMs)
  const duration = durationMs === undefined ? '' : ` duration=${durationMs}ms`
  if (attributes.kind === 'transform') {
    const axes = talkTransformAxes.flatMap(axis => {
      const value = attributes[axis]
      return typeof value === 'number' && Number.isFinite(value) ? [` ${axis}=${value}`] : []
    })
    return `[transform${axes.join('')}${duration}]`
  }
  const label =
    typeof attributes.label === 'string' && attributes.label
      ? attributes.label
      : typeof attributes.targetId === 'string'
        ? attributes.targetId
        : ''
  return `[${label}${duration}]`
}

export const normalizeTalkScriptSpacing = (source: string) =>
  source
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *(\[[^\[\]\n]{1,160}\]) */g, ' $1 ')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .join('\n')

export const serializeTalkScript = (document: TalkScriptDocument) => {
  let source = ''
  const visit = (node: TalkScriptNode) => {
    if (node.type === 'avatarCue') {
      source += serializeTalkCue(node)
      return
    }
    if (node.type === 'text') {
      source += node.text ?? ''
      return
    }
    if (node.type === 'hardBreak') {
      source += '\n'
      return
    }

    const start = source.length
    node.content?.forEach(visit)
    if (blockNodeTypes.has(node.type ?? '') && source.length > start && !source.endsWith('\n')) {
      source += '\n'
    }
  }

  document.content.forEach(visit)
  return normalizeTalkScriptSpacing(source.replace(/\n$/, ''))
}

export const nextTalkCueIndex = (
  cues: TimedTalkCue[],
  fromIndex: number,
  emittedLength: number,
  outputLength: number
) => {
  const nextLength = emittedLength + outputLength
  let index = fromIndex
  while (
    index < cues.length &&
    (cues[index].offset <= emittedLength || cues[index].offset < nextLength)
  ) {
    index += 1
  }
  return index
}
