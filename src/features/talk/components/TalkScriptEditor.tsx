import { Extension, Node, mergeAttributes, type Editor } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Copy,
  Move3D,
  Plus,
  RotateCcw,
  Search,
  SmilePlus,
  Trash2,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { NumericField } from '@/app/components/controls'
import { resolveSequenceExpression, type AvatarSequence } from '@/features/animation/sequences'
import {
  defaultAvatarEyes,
  type AvatarColors,
  type AvatarEyeDefaults,
  type AvatarRenderStyle,
} from '@/features/avatar/avatars'
import type { BodyNode } from '@/features/avatar/body'
import { ExpressionPreview } from '@/features/avatar/components/ExpressionWorkspace'
import type { Expression } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import type { SurfaceConfig } from '@/features/avatar/surfaces'
import {
  DEFAULT_TALK_TRANSITION_MS,
  formatTalkTransformLabel,
  parseTalkTag,
  serializeTalkScript,
  talkTransformAxes,
  type TalkCueKind,
  type TalkScriptDocument,
  type TalkScriptNode,
  type TalkTransform,
  type TalkTransformAxis,
} from '@/features/talk/talkScript'
import { nearestTalkCueDropPosition, talkCueInsertionAfterMove } from '@/features/talk/talkCueDrag'
import type { TalkTextRange } from '@/features/talk/talkTimeline'

type CueChoice = {
  kind: TalkCueKind
  targetId: string
  label: string
  preview: Expression
}

type AvatarCueAttributes = {
  kind: TalkCueKind | 'unknown'
  targetId: string
  label: string
  durationMs: number | null
} & Record<TalkTransformAxis, number | null>

type CueSuggestion = {
  from: number
  to: number
  query: string
  left: number
  top: number
  activeIndex: number
  menuView: ActionMenuView
}

type ActionMenuView = 'root' | 'search' | TalkCueKind

type CuePreviewContext = {
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  colors: AvatarColors
  avatarEyes: AvatarEyeDefaults
  renderStyle: AvatarRenderStyle
}

type AvatarCueOptions = {
  choices: CueChoice[]
  previewContext: CuePreviewContext
  translate: (value: string) => string
}

const cueDropTargetKey = new PluginKey<number | null>('talkCueDropTarget')
const playbackRangeKey = new PluginKey<TalkTextRange | null>('talkPlaybackRange')
const playbackBracketPattern = /\[[^\[\]\n]{1,160}\]/g
const playbackBlockNodeTypes = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
])

type PlaybackTextSegment = {
  plainFrom: number
  plainTo: number
  documentFrom: number
  documentTo: number
}

const mapPlaybackTextSegments = (document: ProseMirrorNode) => {
  const segments: PlaybackTextSegment[] = []
  let plainOffset = 0
  let lastCharacter = ''
  const visit = (node: ProseMirrorNode, position: number, root = false) => {
    if (node.type.name === 'avatarCue') return
    if (node.isText) {
      const source = node.text ?? ''
      let sourceOffset = 0
      for (const match of source.matchAll(playbackBracketPattern)) {
        const matchOffset = match.index ?? 0
        if (matchOffset > sourceOffset) {
          const text = source.slice(sourceOffset, matchOffset)
          segments.push({
            plainFrom: plainOffset,
            plainTo: plainOffset + text.length,
            documentFrom: position + sourceOffset,
            documentTo: position + matchOffset,
          })
          plainOffset += text.length
          lastCharacter = text.at(-1) ?? lastCharacter
        }
        sourceOffset = matchOffset + match[0].length
      }
      if (sourceOffset < source.length) {
        const text = source.slice(sourceOffset)
        segments.push({
          plainFrom: plainOffset,
          plainTo: plainOffset + text.length,
          documentFrom: position + sourceOffset,
          documentTo: position + source.length,
        })
        plainOffset += text.length
        lastCharacter = text.at(-1) ?? lastCharacter
      }
      return
    }
    if (node.type.name === 'hardBreak') {
      plainOffset += 1
      lastCharacter = '\n'
      return
    }
    const startOffset = plainOffset
    node.forEach((child, offset) => visit(child, root ? offset : position + 1 + offset))
    if (
      playbackBlockNodeTypes.has(node.type.name) &&
      plainOffset > startOffset &&
      lastCharacter !== '\n'
    ) {
      plainOffset += 1
      lastCharacter = '\n'
    }
  }
  visit(document, -1, true)
  return segments
}

const createPlaybackRangeExtension = () =>
  Extension.create({
    name: 'talkPlaybackRange',
    addProseMirrorPlugins() {
      return [
        new Plugin<TalkTextRange | null>({
          key: playbackRangeKey,
          state: {
            init: () => null,
            apply: (transaction, current) => {
              const next = transaction.getMeta(playbackRangeKey) as TalkTextRange | null | undefined
              return next === undefined ? current : next
            },
          },
          props: {
            decorations: state => {
              const range = playbackRangeKey.getState(state)
              if (!range) return DecorationSet.empty
              const decorations = mapPlaybackTextSegments(state.doc).flatMap(segment => {
                const from = Math.max(range.from, segment.plainFrom)
                const to = Math.min(range.to, segment.plainTo)
                if (from >= to) return []
                return [
                  Decoration.inline(
                    segment.documentFrom + from - segment.plainFrom,
                    segment.documentFrom + to - segment.plainFrom,
                    { class: 'talk-script-active-word' }
                  ),
                ]
              })
              return DecorationSet.create(state.doc, decorations)
            },
          },
        }),
      ]
    },
  })

const setCueDropTarget = (editor: Editor, position: number | null) => {
  if (cueDropTargetKey.getState(editor.state) === position) return
  editor.view.dispatch(editor.state.tr.setMeta(cueDropTargetKey, position))
}

const createCueDropTargetExtension = () =>
  Extension.create({
    name: 'avatarCueDropTarget',

    addProseMirrorPlugins() {
      return [
        new Plugin<number | null>({
          key: cueDropTargetKey,
          state: {
            init: () => null,
            apply: (transaction, current) => {
              const next = transaction.getMeta(cueDropTargetKey) as number | null | undefined
              if (next !== undefined) return next
              return current === null ? null : transaction.mapping.map(current)
            },
          },
          props: {
            decorations: state => {
              const position = cueDropTargetKey.getState(state)
              if (position === null || position === undefined) return DecorationSet.empty
              return DecorationSet.create(state.doc, [
                Decoration.widget(
                  position,
                  () => {
                    const marker = document.createElement('span')
                    marker.className = 'talk-cue-drop-placeholder'
                    marker.contentEditable = 'false'
                    marker.setAttribute('aria-hidden', 'true')
                    marker.textContent = '+'
                    return marker
                  },
                  { key: 'talk-cue-drop-placeholder', side: -1 }
                ),
              ])
            },
          },
        }),
      ]
    },
  })

const emptyTransformAttributes = Object.fromEntries(
  talkTransformAxes.map(axis => [axis, null])
) as Record<TalkTransformAxis, null>

const transformFromAttributes = (attributes: AvatarCueAttributes): TalkTransform =>
  Object.fromEntries(
    talkTransformAxes.flatMap(axis =>
      typeof attributes[axis] === 'number' ? [[axis, attributes[axis]]] : []
    )
  )

const transformPreviewExpression = (
  transform: TalkTransform,
  avatarEyes: AvatarEyeDefaults
): Expression => ({
  ...defaultExpression,
  positionX:
    transform.tx === undefined
      ? defaultExpression.positionX
      : transform.tx - avatarEyes.positionX + defaultAvatarEyes.positionX,
  positionY:
    transform.ty === undefined
      ? defaultExpression.positionY
      : transform.ty - avatarEyes.positionY + defaultAvatarEyes.positionY,
  positionZ:
    transform.tz === undefined
      ? defaultExpression.positionZ
      : transform.tz - avatarEyes.positionZ + defaultAvatarEyes.positionZ,
  headX: transform.rx ?? defaultExpression.headX,
  headY: transform.ry ?? defaultExpression.headY,
  headZ: transform.rz ?? defaultExpression.headZ,
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    avatarCue: {
      insertAvatarCue: (attributes: AvatarCueAttributes) => ReturnType
    }
  }
}

const ActionTypeMenu = ({
  activeKind,
  onSelect,
  t,
}: {
  activeKind?: TalkCueKind
  onSelect: (kind: TalkCueKind) => void
  t: (value: string) => string
}) => (
  <div className="talk-action-type-menu">
    {(
      [
        ['expression', SmilePlus, 'Expression'],
        ['animation', Clapperboard, 'Animation'],
        ['transform', Move3D, 'Transformation'],
      ] as const
    ).map(([kind, Icon, label]) => (
      <button
        className={`talk-cue-popover-item is-${kind}${activeKind === kind ? ' is-active' : ''}`}
        key={kind}
        type="button"
        onClick={() => onSelect(kind)}
      >
        <span className="talk-action-type-icon">
          <Icon />
        </span>
        <span className="talk-cue-choice-copy">
          <strong>{t(label)}</strong>
        </span>
        <ChevronRight className="talk-action-type-chevron" />
      </button>
    ))}
  </div>
)

const ActionMenuBack = ({
  label,
  onClick,
  t,
}: {
  label: string
  onClick: () => void
  t: (value: string) => string
}) => (
  <div className="talk-action-menu-header">
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={t('Retour')}
      title={t('Retour')}
      onClick={onClick}
    >
      <ArrowLeft />
    </Button>
    <strong>{t(label)}</strong>
  </div>
)

const CueChoiceList = ({
  activeChoice,
  choices,
  closeOnSelect = true,
  kind,
  onSelect,
  previewContext,
  t,
}: {
  activeChoice?: CueChoice
  choices: CueChoice[]
  closeOnSelect?: boolean
  kind: 'expression' | 'animation'
  onSelect: (choice: CueChoice) => void
  previewContext: CuePreviewContext
  t: (value: string) => string
}) => {
  const previewId = useId().replaceAll(':', '')
  const group = choices.filter(choice => choice.kind === kind)
  return (
    <div className="talk-cue-menu-group">
      {group.map(choice => {
        const content = (
          <>
            <ExpressionPreview
              expression={choice.preview}
              {...previewContext}
              id={`${previewId}-${choice.kind}-${choice.targetId}`}
            />
            <span className="talk-cue-choice-copy">
              <strong>{choice.label}</strong>
              <small>{t(choice.kind === 'expression' ? 'Expression' : 'Animation')}</small>
            </span>
          </>
        )
        return closeOnSelect ? (
          <PopoverClose
            className="talk-cue-popover-item"
            key={`${choice.kind}:${choice.targetId}`}
            onClick={() => onSelect(choice)}
          >
            {content}
          </PopoverClose>
        ) : (
          <button
            className={`talk-cue-popover-item${activeChoice?.kind === choice.kind && activeChoice.targetId === choice.targetId ? ' is-active' : ''}`}
            key={`${choice.kind}:${choice.targetId}`}
            type="button"
            onClick={() => onSelect(choice)}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}

const DurationEditor = ({
  durationMs,
  onChange,
  t,
}: {
  durationMs: number | null
  onChange: (durationMs: number | null) => void
  t: (value: string) => string
}) => (
  <div className="talk-duration-editor">
    <NumericField
      label="Transition"
      value={durationMs ?? DEFAULT_TALK_TRANSITION_MS}
      min={0}
      max={5_000}
      step={50}
      unit="ms"
      onChange={value => onChange(Math.round(value / 50) * 50)}
    />
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      disabled={durationMs === null}
      aria-label={t('Réinitialiser')}
      title={t('Réinitialiser')}
      onClick={() => onChange(null)}
    >
      <RotateCcw />
    </Button>
  </div>
)

const TransformEditor = ({
  durationMs,
  onDurationChange,
  onTransformChange,
  previewContext,
  t,
  transform,
}: {
  durationMs: number | null
  onDurationChange: (durationMs: number | null) => void
  onTransformChange: (transform: TalkTransform) => void
  previewContext: CuePreviewContext
  t: (value: string) => string
  transform: TalkTransform
}) => {
  const previewId = useId().replaceAll(':', '')
  const preview = transformPreviewExpression(transform, previewContext.avatarEyes)
  return (
    <>
      <div className="talk-transform-editor">
        <div className="talk-transform-preview">
          <ExpressionPreview
            expression={preview}
            {...previewContext}
            id={`${previewId}-transform`}
          />
          <div>
            <strong>{t('Transformation')}</strong>
            <small>{formatTalkTransformLabel(transform)}</small>
          </div>
        </div>
        <div className="talk-transform-fields">
          {talkTransformAxes.map(axis => {
            const enabled = transform[axis] !== undefined
            const isRotation = axis.startsWith('r')
            return (
              <div className="talk-transform-field" key={axis}>
                <Button
                  className="talk-transform-reset"
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={!enabled}
                  aria-label={`${t('Réinitialiser')} ${axis.toUpperCase()}`}
                  title={t('Réinitialiser')}
                  onClick={() => {
                    const next = { ...transform }
                    delete next[axis]
                    onTransformChange(next)
                  }}
                >
                  <RotateCcw />
                </Button>
                <NumericField
                  label={axis.toUpperCase()}
                  value={transform[axis] ?? 0}
                  min={isRotation ? -180 : axis === 'tz' ? -300 : -200}
                  max={isRotation ? 180 : axis === 'tz' ? 300 : 200}
                  step={1}
                  unit={isRotation ? '°' : 'u'}
                  onChange={value => onTransformChange({ ...transform, [axis]: Math.round(value) })}
                />
              </div>
            )
          })}
        </div>
      </div>
      <DurationEditor durationMs={durationMs} onChange={onDurationChange} t={t} />
    </>
  )
}

const AvatarCueView = ({
  deleteNode,
  editor,
  extension,
  getPos,
  node,
  selected,
  updateAttributes,
}: NodeViewProps) => {
  const choices = (extension.options as AvatarCueOptions).choices
  const previewContext = (extension.options as AvatarCueOptions).previewContext
  const t = (extension.options as AvatarCueOptions).translate
  const attributes = node.attrs as AvatarCueAttributes
  const currentChoice =
    attributes.kind === 'expression' || attributes.kind === 'animation'
      ? choices.find(
          choice => choice.kind === attributes.kind && choice.targetId === attributes.targetId
        )
      : undefined
  const current = currentChoice ?? attributes
  const previewId = useId().replaceAll(':', '')
  const transform = transformFromAttributes(attributes)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [menuView, setMenuView] = useState<ActionMenuView>(
    attributes.kind === 'unknown' ? 'root' : attributes.kind
  )
  const pointerDrag = useRef<{
    active: boolean
    pointerId: number
    source: number
    startX: number
    startY: number
    target: number | null
    trigger: HTMLButtonElement
  } | null>(null)
  const suppressClick = useRef(false)
  const updateChoice = ({ preview: _preview, ...choice }: CueChoice) =>
    updateAttributes({
      ...choice,
      durationMs: choice.kind === 'animation' ? null : attributes.durationMs,
      ...emptyTransformAttributes,
    })

  const selectActionType = (kind: TalkCueKind) => {
    if (kind === 'transform' && attributes.kind !== 'transform') {
      updateAttributes(transformCueAttributes({ tx: 0 }, attributes.durationMs ?? undefined))
    }
    setMenuView(kind)
  }

  const clearPointerDrag = () => {
    pointerDrag.current?.trigger.classList.remove('is-dragging')
    pointerDrag.current = null
    setCueDropTarget(editor, null)
  }

  const startPointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || !editor.isEditable) return
    const source = getPos()
    if (typeof source !== 'number') return
    pointerDrag.current = {
      active: false,
      pointerId: event.pointerId,
      source,
      startX: event.clientX,
      startY: event.clientY,
      target: null,
      trigger: event.currentTarget,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const movePointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pointerDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) {
      return
    }
    if (!drag.active) {
      drag.active = true
      drag.trigger.classList.add('is-dragging')
      suppressClick.current = true
      setPopoverOpen(false)
    }
    event.preventDefault()
    event.stopPropagation()
    const coordinates = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    drag.target = coordinates ? nearestTalkCueDropPosition(editor.state.doc, coordinates.pos) : null
    setCueDropTarget(editor, drag.target)
  }

  const finishPointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pointerDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!drag.active) {
      clearPointerDrag()
      return
    }

    event.preventDefault()
    event.stopPropagation()
    drag.trigger.classList.remove('is-dragging')
    const sourceNode = editor.state.doc.nodeAt(drag.source)
    const target = drag.target
    if (
      sourceNode?.type.name === 'avatarCue' &&
      target !== null &&
      (target < drag.source || target > drag.source + sourceNode.nodeSize)
    ) {
      const transaction = editor.state.tr.delete(drag.source, drag.source + sourceNode.nodeSize)
      const insertion = talkCueInsertionAfterMove(drag.source, sourceNode.nodeSize, target)
      transaction.insert(insertion, sourceNode)
      transaction.setSelection(NodeSelection.create(transaction.doc, insertion))
      transaction.setMeta(cueDropTargetKey, null)
      editor.view.dispatch(transaction.scrollIntoView())
      editor.view.focus()
    } else {
      setCueDropTarget(editor, null)
    }
    pointerDrag.current = null
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
  }

  return (
    <NodeViewWrapper className="talk-cue-node" contentEditable={false}>
      <Popover
        open={popoverOpen}
        onOpenChange={open => {
          setPopoverOpen(open)
          if (open) setMenuView(attributes.kind === 'unknown' ? 'root' : attributes.kind)
        }}
      >
        <PopoverTrigger
          render={
            <button
              aria-label={
                attributes.kind === 'transform'
                  ? `${t('Transformation')} · ${formatTalkTransformLabel(transform)} · ${attributes.durationMs ?? DEFAULT_TALK_TRANSITION_MS} ms`
                  : undefined
              }
              className={`talk-cue-chip is-${current.kind}${selected ? ' is-selected' : ''}`}
              data-cue-draggable
              onClickCapture={event => {
                if (!suppressClick.current) return
                event.preventDefault()
                event.stopPropagation()
                suppressClick.current = false
              }}
              onLostPointerCapture={() => {
                if (pointerDrag.current?.active) return
                clearPointerDrag()
              }}
              onPointerCancel={event => {
                if (pointerDrag.current?.pointerId !== event.pointerId) return
                suppressClick.current = pointerDrag.current.active
                clearPointerDrag()
              }}
              onPointerDown={startPointerDrag}
              onPointerMove={movePointerDrag}
              onPointerUp={finishPointerDrag}
              type="button"
            >
              {attributes.kind === 'transform' ? (
                <Move3D />
              ) : currentChoice ? (
                <ExpressionPreview
                  expression={currentChoice.preview}
                  {...previewContext}
                  id={`${previewId}-${current.kind}-${current.targetId}`}
                />
              ) : current.kind === 'expression' ? (
                <SmilePlus />
              ) : current.kind === 'animation' ? (
                <Clapperboard />
              ) : (
                <CircleHelp />
              )}
              {attributes.kind !== 'transform' && <span>{current.label}</span>}
              {attributes.kind === 'transform' ? (
                <small>{attributes.durationMs ?? DEFAULT_TALK_TRANSITION_MS} ms</small>
              ) : (
                attributes.durationMs !== null &&
                attributes.kind !== 'animation' && <small>{attributes.durationMs} ms</small>
              )}
            </button>
          }
        />
        <PopoverContent
          className={`talk-cue-menu${menuView === 'transform' ? ' talk-transform-menu' : ''}`}
          finalFocus={false}
          initialFocus={false}
        >
          {menuView === 'root' && <ActionTypeMenu onSelect={selectActionType} t={t} />}
          {menuView === 'transform' && (
            <>
              <ActionMenuBack label="Transformation" onClick={() => setMenuView('root')} t={t} />
              <TransformEditor
                durationMs={attributes.durationMs}
                previewContext={previewContext}
                t={t}
                transform={transform}
                onDurationChange={durationMs => updateAttributes({ durationMs })}
                onTransformChange={next =>
                  updateAttributes(transformCueAttributes(next, attributes.durationMs ?? undefined))
                }
              />
            </>
          )}
          {(menuView === 'expression' || menuView === 'animation') && (
            <>
              <ActionMenuBack
                label={menuView === 'expression' ? 'Expressions' : 'Animations'}
                onClick={() => setMenuView('root')}
                t={t}
              />
              {menuView === 'expression' && attributes.kind === 'expression' && (
                <DurationEditor
                  durationMs={attributes.durationMs}
                  t={t}
                  onChange={durationMs => updateAttributes({ durationMs })}
                />
              )}
              <CueChoiceList
                choices={choices}
                kind={menuView}
                previewContext={previewContext}
                t={t}
                onSelect={updateChoice}
              />
            </>
          )}
          <div className="talk-cue-menu-danger">
            <PopoverClose className="talk-cue-popover-item" onClick={deleteNode}>
              <Trash2 />
              {t('Retirer le tag')}
            </PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  )
}

const createAvatarCueExtension = (
  choices: CueChoice[],
  previewContext: CuePreviewContext,
  translate: (value: string) => string
) =>
  Node.create<AvatarCueOptions>({
    name: 'avatarCue',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addOptions() {
      return { choices: [], previewContext, translate: value => value }
    },

    addAttributes() {
      return {
        kind: { default: 'unknown' },
        targetId: { default: '' },
        label: { default: '' },
        durationMs: { default: null },
        ...Object.fromEntries(talkTransformAxes.map(axis => [axis, { default: null }])),
      }
    },

    parseHTML() {
      return [{ tag: 'span[data-avatar-cue]' }]
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(HTMLAttributes, {
          'data-avatar-cue': '',
          'data-cue-kind': HTMLAttributes.kind,
          'data-cue-target': HTMLAttributes.targetId,
        }),
      ]
    },

    addCommands() {
      return {
        insertAvatarCue:
          attributes =>
          ({ commands }) =>
            commands.insertContent({ type: this.name, attrs: attributes }),
      }
    },

    addNodeView() {
      return ReactNodeViewRenderer(AvatarCueView)
    },
  }).configure({ choices, previewContext, translate })

const normalizeCueTag = (value: string) =>
  value
    .trim()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[\s_]+/g, '-')

const findCueChoice = (choices: CueChoice[], value: string) => {
  const normalized = normalizeCueTag(value)
  if (!normalized) return null
  return (
    choices.find(
      choice =>
        normalizeCueTag(choice.label) === normalized ||
        normalizeCueTag(choice.targetId) === normalized
    ) ?? null
  )
}

const filterCueChoices = (choices: CueChoice[], query: string) => {
  const normalized = normalizeCueTag(query)
  if (!normalized) return choices
  return choices.filter(
    choice =>
      normalizeCueTag(choice.label).includes(normalized) ||
      normalizeCueTag(choice.targetId).includes(normalized)
  )
}

const cueAttributes = (choice: CueChoice): AvatarCueAttributes => ({
  kind: choice.kind,
  targetId: choice.targetId,
  label: choice.label,
  durationMs: null,
  ...emptyTransformAttributes,
})

const transformCueAttributes = (
  transform: TalkTransform,
  durationMs?: number
): AvatarCueAttributes => ({
  kind: 'transform',
  targetId: '',
  label: formatTalkTransformLabel(transform),
  durationMs: durationMs ?? null,
  ...(Object.fromEntries(talkTransformAxes.map(axis => [axis, transform[axis] ?? null])) as Record<
    TalkTransformAxis,
    number | null
  >),
})

const unknownCueAttributes = (label: string, durationMs?: number): AvatarCueAttributes => ({
  kind: 'unknown',
  targetId: '',
  label,
  durationMs: durationMs ?? null,
  ...emptyTransformAttributes,
})

const createCueReconciliationExtension = (choices: CueChoice[]) =>
  Extension.create({
    name: 'avatarCueReconciliation',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          appendTransaction: (transactions, _oldState, newState) => {
            if (!transactions.some(transaction => transaction.docChanged)) return null
            const replacements: Array<{
              from: number
              to: number
              attributes: AvatarCueAttributes
            }> = []

            newState.doc.descendants((node, position) => {
              if (!node.isText || !node.text) return
              for (const match of node.text.matchAll(/\[([^\[\]\n]{1,160})\]/g)) {
                if (match.index === undefined) continue
                const label = match[1].trim()
                if (!label) continue
                const parsed = parseTalkTag(label)
                const choice =
                  parsed?.kind === 'target' ? findCueChoice(choices, parsed.target) : null
                replacements.push({
                  from: position + match.index,
                  to: position + match.index + match[0].length,
                  attributes:
                    parsed?.kind === 'transform'
                      ? transformCueAttributes(parsed.transform, parsed.durationMs)
                      : choice
                        ? {
                            ...cueAttributes(choice),
                            durationMs:
                              choice.kind === 'expression' ? (parsed?.durationMs ?? null) : null,
                          }
                        : unknownCueAttributes(
                            label,
                            parsed?.kind === 'target' ? parsed.durationMs : undefined
                          ),
                })
              }
            })

            if (!replacements.length) return null
            const cueType = newState.schema.nodes.avatarCue
            const transaction = newState.tr
            replacements
              .slice()
              .reverse()
              .forEach(({ from, to, attributes }) =>
                transaction.replaceWith(from, to, cueType.create(attributes))
              )
            return transaction
          },
        }),
      ]
    },
  })

const readCueSuggestion = (
  editor: Editor
): Omit<CueSuggestion, 'activeIndex' | 'menuView'> | null => {
  const { selection } = editor.state
  if (!selection.empty) return null
  const beforeCursor = selection.$from.parent.textBetween(
    0,
    selection.$from.parentOffset,
    undefined,
    '\ufffc'
  )
  const match = /\[([^\[\]\n\ufffc]*)$/.exec(beforeCursor)
  if (!match) return null
  const coordinates = editor.view.coordsAtPos(selection.from)
  return {
    from: selection.from - match[0].length,
    to: selection.from,
    query: match[1],
    left: Math.max(8, Math.min(coordinates.left, window.innerWidth - 336)),
    top: Math.max(8, Math.min(coordinates.bottom + 6, window.innerHeight - 450)),
  }
}

const replaceSuggestion = (editor: Editor, suggestion: CueSuggestion, choice: CueChoice) => {
  editor
    .chain()
    .focus()
    .deleteRange({ from: suggestion.from, to: suggestion.to })
    .insertAvatarCue(cueAttributes(choice))
    .insertContent(' ')
    .run()
}

const CueSuggestionMenu = ({
  choices,
  durationMs,
  onBack,
  onDurationChange,
  onInsertTransform,
  onSelect,
  onSelectType,
  onTransformChange,
  previewContext,
  suggestion,
  t,
  transform,
}: {
  choices: CueChoice[]
  durationMs: number | null
  onBack: () => void
  onDurationChange: (durationMs: number | null) => void
  onInsertTransform: () => void
  onSelect: (choice: CueChoice) => void
  onSelectType: (kind: TalkCueKind) => void
  onTransformChange: (transform: TalkTransform) => void
  previewContext: CuePreviewContext
  suggestion: CueSuggestion
  t: (value: string) => string
  transform: TalkTransform
}) => {
  const visibleChoices = choices.filter(choice => choice.kind === suggestion.menuView)
  const activeChoice = choices[suggestion.activeIndex]
  const expressionResults = choices.filter(choice => choice.kind === 'expression')
  const animationResults = choices.filter(choice => choice.kind === 'animation')
  const transformResult = choices.find(choice => choice.kind === 'transform')
  return createPortal(
    <div
      className={`talk-cue-menu talk-cue-suggestion-menu${suggestion.menuView === 'transform' ? ' talk-transform-menu' : ''}`}
      style={{ left: suggestion.left, top: suggestion.top }}
      role="dialog"
      aria-label={t('Choisir une expression, une animation ou une transformation')}
      onMouseDown={event => {
        if ((event.target as HTMLElement).closest('input')) return
        event.preventDefault()
      }}
    >
      {suggestion.menuView === 'root' && (
        <ActionTypeMenu
          activeKind={(['expression', 'animation', 'transform'] as const)[suggestion.activeIndex]}
          onSelect={onSelectType}
          t={t}
        />
      )}
      {suggestion.menuView === 'search' && (
        <>
          <div className="talk-cue-search-query">
            <Search />
            <span>{suggestion.query}</span>
          </div>
          {expressionResults.length > 0 && (
            <div className="talk-cue-search-section">
              <div className="talk-cue-menu-heading">
                <SmilePlus />
                {t('Expressions')}
              </div>
              <CueChoiceList
                activeChoice={activeChoice}
                choices={expressionResults}
                closeOnSelect={false}
                kind="expression"
                onSelect={onSelect}
                previewContext={previewContext}
                t={t}
              />
            </div>
          )}
          {animationResults.length > 0 && (
            <div className="talk-cue-search-section">
              <div className="talk-cue-menu-heading">
                <Clapperboard />
                {t('Animations')}
              </div>
              <CueChoiceList
                activeChoice={activeChoice}
                choices={animationResults}
                closeOnSelect={false}
                kind="animation"
                onSelect={onSelect}
                previewContext={previewContext}
                t={t}
              />
            </div>
          )}
          {transformResult && (
            <div className="talk-cue-search-section">
              <div className="talk-cue-menu-heading">
                <Move3D />
                {t('Transformation')}
              </div>
              <button
                className={`talk-cue-popover-item${activeChoice === transformResult ? ' is-active' : ''}`}
                type="button"
                onClick={() => onSelectType('transform')}
              >
                <span className="talk-transform-choice-icon">
                  <Move3D />
                </span>
                <span className="talk-cue-choice-copy">
                  <strong>{t('Transformation')}</strong>
                  <small>{t('Surcharge de pose')}</small>
                </span>
              </button>
            </div>
          )}
          {!choices.length && (
            <p className="talk-cue-suggestion-empty">{t('Aucun tag correspondant')}</p>
          )}
        </>
      )}
      {(suggestion.menuView === 'expression' || suggestion.menuView === 'animation') && (
        <>
          <ActionMenuBack
            label={suggestion.menuView === 'expression' ? 'Expressions' : 'Animations'}
            onClick={onBack}
            t={t}
          />
          {visibleChoices.length ? (
            <CueChoiceList
              activeChoice={activeChoice}
              choices={visibleChoices}
              closeOnSelect={false}
              kind={suggestion.menuView}
              onSelect={onSelect}
              previewContext={previewContext}
              t={t}
            />
          ) : (
            <p className="talk-cue-suggestion-empty">{t('Aucun tag correspondant')}</p>
          )}
        </>
      )}
      {suggestion.menuView === 'transform' && (
        <>
          <ActionMenuBack label="Transformation" onClick={onBack} t={t} />
          <TransformEditor
            durationMs={durationMs}
            previewContext={previewContext}
            t={t}
            transform={transform}
            onDurationChange={onDurationChange}
            onTransformChange={onTransformChange}
          />
          <button
            className="talk-cue-popover-item talk-transform-add"
            type="button"
            onClick={onInsertTransform}
          >
            <Plus />
            {t('Ajouter la transformation')}
          </button>
        </>
      )}
    </div>,
    document.body
  )
}

const toDocument = (value: TalkScriptNode): TalkScriptDocument => value as TalkScriptDocument

export function TalkScriptEditor({
  activeTextRange,
  document,
  expressions,
  onChange,
  placeholder,
  previewContext,
  sequences,
  t,
}: {
  activeTextRange: TalkTextRange | null
  document: TalkScriptDocument
  expressions: Expression[]
  onChange: (document: TalkScriptDocument) => void
  placeholder: string
  previewContext: CuePreviewContext
  sequences: AvatarSequence[]
  t: (value: string) => string
}) {
  const choices: CueChoice[] = [
    {
      kind: 'expression' as const,
      targetId: defaultExpression.id,
      label: t('Apparence neutre'),
      preview: defaultExpression,
    },
    ...expressions.map((expression, index) => ({
      kind: 'expression' as const,
      targetId: expression.id,
      label: expression.semanticKey ?? `${t('Expression')} ${String(index).padStart(2, '0')}`,
      preview: expression,
    })),
    ...sequences.map(sequence => {
      const firstStep = sequence.steps[0]
      const resolved = firstStep
        ? resolveSequenceExpression(expressions, firstStep.expressionId).expression
        : null
      return {
        kind: 'animation' as const,
        targetId: sequence.id,
        label: sequence.semanticKey ?? (sequence.builtIn ? t(sequence.name) : sequence.name),
        preview: resolved ?? expressions[0] ?? defaultExpression,
      }
    }),
    {
      kind: 'transform' as const,
      targetId: '',
      label: t('Transformation'),
      preview: defaultExpression,
    },
  ]
  const [newTransform, setNewTransform] = useState<TalkTransform>({ tx: 0 })
  const [newTransformDuration, setNewTransformDuration] = useState<number | null>(null)
  const [newActionOpen, setNewActionOpen] = useState(false)
  const [newActionView, setNewActionView] = useState<ActionMenuView>('root')
  const [cueSuggestion, setCueSuggestion] = useState<CueSuggestion | null>(null)
  const cueSuggestionRef = useRef<CueSuggestion | null>(null)
  const updateCueSuggestion = (currentEditor: Editor) => {
    const next = readCueSuggestion(currentEditor)
    if (!next) {
      cueSuggestionRef.current = null
      setCueSuggestion(null)
      return
    }
    const previous = cueSuggestionRef.current
    const sameSuggestion = previous?.from === next.from
    const hasQuery = next.query.trim().length > 0
    const suggestion = {
      ...next,
      activeIndex:
        previous?.from === next.from && previous.query === next.query ? previous.activeIndex : 0,
      menuView: hasQuery
        ? ('search' as const)
        : sameSuggestion && previous.query === next.query
          ? previous.menuView
          : ('root' as const),
    }
    cueSuggestionRef.current = suggestion
    setCueSuggestion(suggestion)
  }
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      createAvatarCueExtension(choices, previewContext, t),
      createCueReconciliationExtension(choices),
      createCueDropTargetExtension(),
      createPlaybackRangeExtension(),
    ],
    content: document,
    onUpdate: ({ editor: currentEditor }) => {
      updateCueSuggestion(currentEditor)
      onChange(toDocument(currentEditor.getJSON()))
    },
    onSelectionUpdate: ({ editor: currentEditor }) => updateCueSuggestion(currentEditor),
    onBlur: ({ event }) => {
      if (
        event.relatedTarget instanceof HTMLElement &&
        event.relatedTarget.closest('.talk-cue-suggestion-menu')
      ) {
        return
      }
      cueSuggestionRef.current = null
      setCueSuggestion(null)
    },
    editorProps: {
      attributes: {
        'aria-label': t('Texte à prononcer'),
        class: 'talk-script-prosemirror',
      },
      handleKeyDown: (view, event) => {
        const suggestion = cueSuggestionRef.current
        if (!suggestion) return false
        const filteredChoices = filterCueChoices(choices, suggestion.query)
        const matches =
          suggestion.menuView === 'search'
            ? filteredChoices
            : filteredChoices.filter(choice => choice.kind === suggestion.menuView)
        if (event.key === 'Escape') {
          cueSuggestionRef.current = null
          setCueSuggestion(null)
          return true
        }
        if (suggestion.menuView === 'root') {
          const actionKinds = ['expression', 'animation', 'transform'] as const
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const direction = event.key === 'ArrowDown' ? 1 : -1
            const activeIndex =
              (suggestion.activeIndex + direction + actionKinds.length) % actionKinds.length
            const next = { ...suggestion, activeIndex }
            cueSuggestionRef.current = next
            setCueSuggestion(next)
            return true
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            setCueSuggestionView(actionKinds[suggestion.activeIndex])
            return true
          }
          return false
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (!matches.length) return true
          const direction = event.key === 'ArrowDown' ? 1 : -1
          const activeIndex = (suggestion.activeIndex + direction + matches.length) % matches.length
          const next = { ...suggestion, activeIndex }
          cueSuggestionRef.current = next
          setCueSuggestion(next)
          return true
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && matches.length) {
          const choice = matches[Math.min(suggestion.activeIndex, matches.length - 1)]
          if (choice.kind === 'transform') {
            setCueSuggestionView('transform')
            return true
          }
          const cueType = view.state.schema.nodes.avatarCue
          const attributes = cueAttributes(choice)
          const transaction = view.state.tr
            .replaceWith(suggestion.from, suggestion.to, cueType.create(attributes))
            .insertText(' ', suggestion.from + 1)
          view.dispatch(transaction)
          view.focus()
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(editor.state.tr.setMeta(playbackRangeKey, activeTextRange))
  }, [activeTextRange, editor])

  useEffect(() => {
    if (
      !editor ||
      editor.isDestroyed ||
      JSON.stringify(editor.getJSON()) === JSON.stringify(document)
    )
      return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed) return
      editor.commands.setContent(document, { emitUpdate: false })
    })
    return () => {
      cancelled = true
    }
  }, [document, editor])

  const insertCue = (choice: CueChoice) => {
    editor?.chain().focus().insertAvatarCue(cueAttributes(choice)).insertContent(' ').run()
  }
  const setCueSuggestionView = (menuView: ActionMenuView) => {
    const current = cueSuggestionRef.current
    if (!current) return
    const next = { ...current, activeIndex: 0, menuView }
    cueSuggestionRef.current = next
    setCueSuggestion(next)
  }
  const insertTransform = () => {
    editor
      ?.chain()
      .focus()
      .insertAvatarCue(transformCueAttributes(newTransform, newTransformDuration ?? undefined))
      .insertContent(' ')
      .run()
    setNewTransform({ tx: 0 })
    setNewTransformDuration(null)
  }
  const insertSuggestedTransform = () => {
    const suggestion = cueSuggestionRef.current
    if (!editor || !suggestion) return
    editor
      .chain()
      .focus()
      .deleteRange({ from: suggestion.from, to: suggestion.to })
      .insertAvatarCue(transformCueAttributes(newTransform, newTransformDuration ?? undefined))
      .insertContent(' ')
      .run()
    cueSuggestionRef.current = null
    setCueSuggestion(null)
    setNewTransform({ tx: 0 })
    setNewTransformDuration(null)
  }

  return (
    <div className="talk-script-editor">
      <div className="talk-script-toolbar">
        <Popover
          open={newActionOpen}
          onOpenChange={open => {
            setNewActionOpen(open)
            if (open) setNewActionView('root')
          }}
        >
          <PopoverTrigger
            render={
              <Button type="button" size="sm" variant="outline" disabled={!editor}>
                <Plus />
                {t('Ajouter une action')}
              </Button>
            }
          />
          <PopoverContent
            className={`talk-cue-menu${newActionView === 'transform' ? ' talk-transform-menu talk-transform-create-menu' : ''}`}
            finalFocus={false}
            initialFocus={false}
          >
            {newActionView === 'root' && <ActionTypeMenu onSelect={setNewActionView} t={t} />}
            {(newActionView === 'expression' || newActionView === 'animation') && (
              <>
                <ActionMenuBack
                  label={newActionView === 'expression' ? 'Expressions' : 'Animations'}
                  onClick={() => setNewActionView('root')}
                  t={t}
                />
                <CueChoiceList
                  choices={choices}
                  kind={newActionView}
                  onSelect={insertCue}
                  previewContext={previewContext}
                  t={t}
                />
              </>
            )}
            {newActionView === 'transform' && (
              <>
                <ActionMenuBack
                  label="Transformation"
                  onClick={() => setNewActionView('root')}
                  t={t}
                />
                <TransformEditor
                  durationMs={newTransformDuration}
                  previewContext={previewContext}
                  t={t}
                  transform={newTransform}
                  onDurationChange={setNewTransformDuration}
                  onTransformChange={setNewTransform}
                />
                <PopoverClose
                  className="talk-cue-popover-item talk-transform-add"
                  onClick={insertTransform}
                >
                  <Plus />
                  {t('Ajouter la transformation')}
                </PopoverClose>
              </>
            )}
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={t('Copier le dialogue')}
          title={t('Copier le dialogue')}
          onClick={() =>
            void navigator.clipboard.writeText(serializeTalkScript(document)).catch(() => undefined)
          }
        >
          <Copy />
        </Button>
      </div>
      <EditorContent editor={editor} />
      {editor && cueSuggestion && (
        <CueSuggestionMenu
          choices={filterCueChoices(choices, cueSuggestion.query)}
          durationMs={newTransformDuration}
          previewContext={previewContext}
          suggestion={cueSuggestion}
          t={t}
          transform={newTransform}
          onBack={() =>
            setCueSuggestionView(cueSuggestion.query.trim().length > 0 ? 'search' : 'root')
          }
          onDurationChange={setNewTransformDuration}
          onInsertTransform={insertSuggestedTransform}
          onSelect={choice => replaceSuggestion(editor, cueSuggestion, choice)}
          onSelectType={setCueSuggestionView}
          onTransformChange={setNewTransform}
        />
      )}
    </div>
  )
}
