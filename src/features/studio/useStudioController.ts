import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { useStudioLanguage } from '@/i18n'

import {
  AMBIENT_FRAME_MS,
  bounded,
  COPY_FEEDBACK_DURATION_MS,
  createExpressionId,
  downloadBlob,
  INSPECTOR_FRAME_MS,
  interpolateHexColor,
  poseWithAvatarEyes,
  resolveColors,
  RETARGET_BLEND_MS,
  type ExportFormat,
  type Highlight,
  type Mode,
  type PhotoTool,
  type PlaybackStatus,
  type Side,
  type SnapshotFormat,
} from '@/app/studio-utils'
import {
  advancePlaybackTimeline,
  beginPlayback,
  createPlaybackTimeline,
  pausePlaybackTimeline,
  schedulePlaybackBlink,
  schedulePlaybackStep,
  stopPlaybackTimeline,
} from '@/features/animation/playback'
import {
  createSequence,
  duplicateSequence,
  findExpressionIndex,
  getSequenceSpring,
  readSequenceClock,
  remapSequencesAfterExpressionDelete,
  type AvatarSequence,
  type SequenceStep,
} from '@/features/animation/sequences'
import {
  ambientBodyOffset,
  ambientEyeOffset,
  applyAmbientBodyMotion,
  hasAmbientMotion,
} from '@/features/avatar/ambientMotion'
import {
  avatarDefinitionFileName,
  createAvatarDefinition,
  getSemanticKeyIssue,
  type SemanticKeyIssueCode,
} from '@/features/avatar/avatarDefinition'
import {
  cloneAvatarBehavior,
  createAvatar,
  createUnkeyedExpressionCopy,
  defaultAvatarEyes,
  resolveAvatarBehavior,
  type AvatarBehaviorLibrary,
  type AvatarColors,
  type AvatarEyeDefaults,
  type StudioAvatar,
} from '@/features/avatar/avatars'
import {
  isAvatarDefinitionSource,
  studioAvatarFromDefinition,
} from '@/features/avatar/importAvatarDefinition'
import {
  bodyPrimitiveTypes,
  createBodyNode,
  duplicateBodyNode,
  MAX_BODY_NODES,
  type BodyNode,
} from '@/features/avatar/body'
import {
  scaleEye,
  updateEyeDimension,
  updateEyePosition,
} from '@/features/avatar/expressionEditing'
import {
  expressionFields,
  poseFromExpression,
  renderAvatar,
  type AvatarPose,
  type Expression,
} from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import { type SurfaceConfig } from '@/features/avatar/surfaces'
import {
  avatarDemoFileName,
  generateJavaScriptEsmPackage,
  generateReactVitePackage,
} from '@/features/export/exporter'
import {
  serializeAvatarSnapshot,
  serializePixelSnapshot,
  snapshotFileName,
  type SnapshotBackground,
} from '@/features/export/snapshotExporter'
import {
  defaultSnapshotComposition,
  normalizeSnapshotComposition,
} from '@/features/export/snapshotComposition'
import {
  resetBodyEditorView,
  resolveCanvasPreviewExpression,
  shouldSyncCanvasPreviewToReact,
  type CanvasPreviewTarget,
} from '@/features/rendering/canvasPreview'
import {
  createRenderedRotationGizmo,
  paintRenderedRotationGizmo,
} from '@/features/rendering/renderedRotationGizmo'
import {
  createRenderedColors,
  createRenderedScene,
  paintRenderedColors,
  paintRenderedOffset,
  paintRenderedScene,
} from '@/features/rendering/renderedScene'
import { paintPixelAvatar } from '@/features/rendering/pixelRenderer'
import {
  createStudioDocumentStore,
  loadStudioDocument,
  parseImportedStudioDocument,
  persistStudioDocument,
  serializeStudioDocument,
  type StatePlaybackSelection,
  type StudioDocument,
} from '@/features/studio/studioDocument'

export function useStudioController() {
  const { language, setLanguage, t } = useStudioLanguage()
  const [mode, setMode] = useState<Mode>('avatars')
  const [initialDocument] = useState(loadStudioDocument)
  const [documentStore] = useState(() => createStudioDocumentStore(initialDocument))
  const initialLibrary = initialDocument.library
  const [avatars, setAvatars] = useState(initialLibrary.avatars)
  const [activeAvatarId, setActiveAvatarId] = useState(initialLibrary.activeAvatarId)
  const initialAvatar =
    initialLibrary.avatars.find(avatar => avatar.id === initialLibrary.activeAvatarId) ??
    initialLibrary.avatars[0]
  const [baseBehavior] = useState<AvatarBehaviorLibrary>(() => ({
    expressions: initialDocument.expressions,
    sequences: initialDocument.sequences,
  }))
  const initialBehavior = resolveAvatarBehavior(initialAvatar, baseBehavior)
  const [surface, setSurface] = useState(initialAvatar.body.primary)
  const [bodyNodes, setBodyNodes] = useState(initialAvatar.body.nodes)
  const [selectedBodyNodeId, setSelectedBodyNodeId] = useState<'primary' | string | null>('primary')
  const [selectedEyeSide, setSelectedEyeSide] = useState<-1 | 1 | null>(null)
  const [expressions, setExpressions] = useState(initialBehavior.expressions)
  const [sequences, setSequences] = useState(initialBehavior.sequences)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('react')
  const [exportAnimationIds, setExportAnimationIds] = useState(() =>
    initialBehavior.sequences.map(animation => animation.id)
  )
  const [snapshotBackground, setSnapshotBackground] = useState<SnapshotBackground>('transparent')
  const [snapshotColorFrom, setSnapshotColorFrom] = useState('#F5F7FC')
  const [snapshotColorTo, setSnapshotColorTo] = useState('#C9D5FF')
  const [snapshotSize, setSnapshotSize] = useState('1024')
  const [snapshotFormat, setSnapshotFormat] = useState<SnapshotFormat>('png')
  const [snapshotComposition, setSnapshotComposition] = useState(() => ({
    ...defaultSnapshotComposition,
    cornerRadius: 18,
  }))
  const [photoTool, setPhotoTool] = useState<PhotoTool>('frame')
  const [photoPanelSections, setPhotoPanelSections] = useState<PhotoTool[]>([])
  const [photoFlash, setPhotoFlash] = useState(0)
  const [runtimeCopyFeedback, setRuntimeCopyFeedback] = useState<{
    status: 'idle' | 'success' | 'error'
    source?: readonly unknown[]
  }>({ status: 'idle' })
  useEffect(() => {
    if (runtimeCopyFeedback.status === 'idle') return
    const timeout = window.setTimeout(
      () => setRuntimeCopyFeedback({ status: 'idle' }),
      COPY_FEEDBACK_DURATION_MS
    )
    return () => window.clearTimeout(timeout)
  }, [runtimeCopyFeedback])
  const initialStatePlayback = initialDocument.playback
  const updateStudioLibrary = (library: typeof initialDocument.library) =>
    documentStore.update({ library })
  const persistStatePlayback = (playback: StatePlaybackSelection) =>
    documentStore.update({ playback })
  const [bodyEditing, setBodyEditing] = useState(false)
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const avatarEditSnapshot = useRef<{
    avatars: StudioAvatar[]
    activeAvatarId: string
  } | null>(null)
  const workspaceBackButtonRef = useRef<HTMLButtonElement>(null)
  const [focusAvatarName, setFocusAvatarName] = useState(false)
  const initialExpression = expressions[0] ?? defaultExpression
  const [expression, setExpression] = useState<Expression>({ ...initialExpression })
  const initialDisplayColors = resolveColors(initialExpression, initialAvatar.colors)
  const [renderedColors] = useState(() => createRenderedColors(initialDisplayColors))
  const setDisplayColors = (next: AvatarColors) => {
    paintRenderedColors(renderedColors, next)
  }
  const [deleteAvatarOpen, setDeleteAvatarOpen] = useState(false)
  const [deleteExpressionOpen, setDeleteExpressionOpen] = useState(false)
  const [deleteSequenceOpen, setDeleteSequenceOpen] = useState(false)
  const [pendingProjectImport, setPendingProjectImport] = useState<{
    document: StudioDocument
    fileName: string
    kind: 'project' | 'avatar'
  } | null>(null)
  const [projectImportError, setProjectImportError] = useState<string | null>(null)
  const projectImportRef = useRef<HTMLInputElement>(null)
  const avatarImportRef = useRef<HTMLInputElement>(null)
  const [statePlayerExpanded, setStatePlayerExpanded] = useState(false)
  const [activeExpression, setActiveExpression] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number | null; draft: Expression } | null>(null)
  const [showWire, setShowWire] = useState(false)
  const [springSpeed, setSpringSpeed] = useState(7)
  const [linked, setLinked] = useState({
    width: true,
    height: true,
    size: true,
    position: true,
    rotation: true,
  })
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [selectedState, setSelectedState] = useState(() =>
    sequences.some(sequence => sequence.id === initialStatePlayback.stateId)
      ? initialStatePlayback.stateId!
      : sequences.some(sequence => sequence.id === 'idle')
        ? 'idle'
        : (sequences[0]?.id ?? '')
  )
  const [activeState, setActiveState] = useState<string | null>(null)
  const [statePlaying, setStatePlaying] = useState(false)
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>(() =>
    initialStatePlayback.stateId === null ? 'stopped' : 'paused'
  )
  const [playbackVisual, setPlaybackVisual] = useState({
    position: null as number | null,
    run: 0,
    durationMs: 0,
  })
  const [sequenceEditing, setSequenceEditing] = useState<{
    sourceId: string | null
    draft: AvatarSequence
  } | null>(null)
  const [selectedSequenceStepId, setSelectedSequenceStepId] = useState<string | null>(null)
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeSequenceRef = useRef<AvatarSequence | null>(null)
  const editorStateSnapshot = useRef<{
    stateId: string
    playing: boolean
    expression: Expression
  } | null>(null)
  const initialStatePlaybackApplied = useRef(false)
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [initialPlaybackTimeline] = useState(createPlaybackTimeline)
  const playbackTimeline = useRef(initialPlaybackTimeline)
  const reduceMotion = useReducedMotion()

  const avatarsRef = useRef(avatars)
  const expressionsRef = useRef(expressions)
  const sequencesRef = useRef(sequences)
  const draggedAvatarId = useRef<string | null>(null)
  const avatarDragOrigin = useRef<StudioAvatar[] | null>(null)
  const avatarDragPreview = useRef(avatars)
  const [draggingAvatarId, setDraggingAvatarId] = useState<string | null>(null)
  const draggedExpressionId = useRef<string | null>(null)
  const expressionDragOrigin = useRef<Expression[] | null>(null)
  const expressionDragPreview = useRef(expressions)
  const [draggingExpressionId, setDraggingExpressionId] = useState<string | null>(null)
  const draggedStateId = useRef<string | null>(null)
  const stateDragOrigin = useRef<AvatarSequence[] | null>(null)
  const stateDragPreview = useRef(sequences)
  const [draggingStateId, setDraggingStateId] = useState<string | null>(null)
  const activeAvatarIdRef = useRef(activeAvatarId)
  const surfaceRef = useRef(surface)
  const bodyNodesRef = useRef(bodyNodes)
  const showWireRef = useRef(showWire)
  const highlightRef = useRef(highlight)
  const persistActiveBehavior = (
    nextExpressions: Expression[],
    nextSequences: AvatarSequence[]
  ) => {
    const behavior = cloneAvatarBehavior({
      expressions: nextExpressions,
      sequences: nextSequences,
    })
    const nextAvatars = avatarsRef.current.map(avatar =>
      avatar.id === activeAvatarIdRef.current ? { ...avatar, behavior } : avatar
    )
    avatarsRef.current = nextAvatars
    setAvatars(nextAvatars)
    updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: nextAvatars })
  }
  const updateStudioExpressions = (nextExpressions: Expression[]) => {
    expressionsRef.current = nextExpressions
    persistActiveBehavior(nextExpressions, sequencesRef.current)
  }
  const updateStudioSequences = (nextSequences: AvatarSequence[]) => {
    sequencesRef.current = nextSequences
    persistActiveBehavior(expressionsRef.current, nextSequences)
  }
  const [initialRender] = useState(() => {
    const pose = poseFromExpression(initialExpression)
    return {
      pose,
      geometry: renderAvatar(
        poseWithAvatarEyes(initialExpression, initialAvatar.eyes),
        surface,
        1,
        { bodyNodes }
      ),
    }
  })
  const { pose: initialPose, geometry: initialGeometry } = initialRender
  const displayedPose = useRef<AvatarPose>(initialPose)
  const transitionFrame = useRef<number | null>(null)
  const ambientFrame = useRef<number | null>(null)
  const eyeAmbientStartedAt = useRef(-1)
  const bodyAmbientStartedAt = useRef(-1)
  const lastEyeAmbientElapsed = useRef(0)
  const lastBodyAmbientElapsed = useRef(0)
  const lastAmbientFrame = useRef(0)
  const eyeAmbientSignature = useRef('none')
  const bodyAmbientSignature = useRef('none')
  const lastAmbientStrength = useRef(1)
  const transitionTarget = useRef<Expression>({ ...initialExpression })
  const canonicalTarget = useRef<Expression>({ ...initialExpression })
  const retargetFrom = useRef<Expression | null>(null)
  const retargetTo = useRef<Expression | null>(null)
  const retargetStartedAt = useRef<number | null>(null)
  const [transitionVelocity] = useState(
    () =>
      Object.fromEntries(expressionFields.map(field => [field, 0])) as Record<
        (typeof expressionFields)[number],
        number
      >
  )
  const lastTransitionTime = useRef<number | null>(null)
  const lastInspectorFrame = useRef(0)
  const springSpeedRef = useRef(springSpeed)
  const sequenceTransitionRef = useRef<Pick<SequenceStep, 'transitionMs' | 'transition'>>({
    transitionMs: 500,
    transition: 'smooth',
  })
  const activeSequenceTransition = useRef<{
    target: Expression
    index: number | null
    settings: Pick<SequenceStep, 'transitionMs' | 'transition'>
    remainingMs: number
  } | null>(null)
  const pausedSequenceTransition = useRef<typeof activeSequenceTransition.current>(null)
  const blinkControls = useRef<ReturnType<typeof animate> | null>(null)
  const blinkAnimating = useRef(false)
  const blinkValue = useMotionValue(1)
  const [renderedScene] = useState(() => createRenderedScene(initialGeometry))
  const [renderedRotationGizmo] = useState(() => createRenderedRotationGizmo(initialExpression))
  const bodyColorAnimation = useRef<ReturnType<typeof animate> | null>(null)
  const eyeColorAnimation = useRef<ReturnType<typeof animate> | null>(null)

  const paintPose = (
    pose: AvatarPose,
    blink?: number,
    frameTimeMs?: number,
    ambientStrength?: number
  ) => {
    displayedPose.current = pose
    const resolvedAmbientStrength =
      ambientStrength ?? (transitionFrame.current === null ? 1 : lastAmbientStrength.current)
    lastAmbientStrength.current = resolvedAmbientStrength
    paintRenderedRotationGizmo(renderedRotationGizmo, pose.expression)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    const eyeAmbientEnabled = !reduceMotion && pose.expression.eyeMotion !== 'none'
    const bodyAmbientEnabled = !reduceMotion && pose.expression.bodyMotion !== 'none'
    const eyeSignature = eyeAmbientEnabled ? pose.expression.eyeMotion : 'none'
    const bodySignature = bodyAmbientEnabled ? pose.expression.bodyMotion : 'none'
    if (eyeSignature !== eyeAmbientSignature.current) {
      eyeAmbientSignature.current = eyeSignature
      eyeAmbientStartedAt.current = -1
      lastEyeAmbientElapsed.current = 0
    }
    if (bodySignature !== bodyAmbientSignature.current) {
      bodyAmbientSignature.current = bodySignature
      bodyAmbientStartedAt.current = -1
      lastBodyAmbientElapsed.current = 0
    }
    if (eyeAmbientEnabled && frameTimeMs !== undefined) {
      if (eyeAmbientStartedAt.current < 0) eyeAmbientStartedAt.current = frameTimeMs
      lastEyeAmbientElapsed.current = frameTimeMs - eyeAmbientStartedAt.current
    }
    if (bodyAmbientEnabled && frameTimeMs !== undefined) {
      if (bodyAmbientStartedAt.current < 0) bodyAmbientStartedAt.current = frameTimeMs
      lastBodyAmbientElapsed.current = frameTimeMs - bodyAmbientStartedAt.current
    }
    const renderedExpression = bodyAmbientEnabled
      ? applyAmbientBodyMotion(
          pose.expression,
          lastBodyAmbientElapsed.current,
          resolvedAmbientStrength
        )
      : pose.expression
    const eyeOffset = eyeAmbientEnabled
      ? ambientEyeOffset(pose.expression, lastEyeAmbientElapsed.current, resolvedAmbientStrength)
      : { x: 0, y: 0 }
    const renderPose = avatar
      ? poseWithAvatarEyes(renderedExpression, avatar.eyes ?? defaultAvatarEyes)
      : poseFromExpression(renderedExpression)
    const geometry = renderAvatar(renderPose, surfaceRef.current, blink ?? blinkValue.get(), {
      includeWire: showWireRef.current || highlightRef.current === 'head',
      bodyNodes: bodyNodesRef.current,
      eyeOffset,
    })
    paintRenderedScene(renderedScene, geometry)
    paintRenderedOffset(
      renderedScene,
      bodyAmbientEnabled
        ? ambientBodyOffset(
            pose.expression,
            lastBodyAmbientElapsed.current,
            resolvedAmbientStrength
          )
        : { x: 0, y: 0 }
    )
  }

  useMotionValueEvent(blinkValue, 'change', latest => paintPose(displayedPose.current, latest))

  const paintAmbientFrame = useEffectEvent((time: number) => {
    if (transitionFrame.current === null && time - lastAmbientFrame.current >= AMBIENT_FRAME_MS) {
      lastAmbientFrame.current = time
      paintPose(displayedPose.current, undefined, time)
    }
  })

  const ambientLoopActive = !reduceMotion && hasAmbientMotion(editing?.draft ?? expression)
  useEffect(() => {
    if (!ambientLoopActive) return
    const tick = (time: number) => {
      paintAmbientFrame(time)
      ambientFrame.current = requestAnimationFrame(tick)
    }
    ambientFrame.current = requestAnimationFrame(tick)
    return () => {
      if (ambientFrame.current !== null) cancelAnimationFrame(ambientFrame.current)
    }
  }, [ambientLoopActive])

  useEffect(
    () => () => {
      if (transitionFrame.current !== null) cancelAnimationFrame(transitionFrame.current)
      blinkControls.current?.stop()
      bodyColorAnimation.current?.stop()
      eyeColorAnimation.current?.stop()
      if (stateTimer.current) clearTimeout(stateTimer.current)
      if (blinkTimer.current) clearTimeout(blinkTimer.current)
    },
    []
  )

  const stopTransition = (resetVelocity: boolean) => {
    if (transitionFrame.current !== null) cancelAnimationFrame(transitionFrame.current)
    transitionFrame.current = null
    lastTransitionTime.current = null
    retargetFrom.current = null
    retargetTo.current = null
    retargetStartedAt.current = null
    lastInspectorFrame.current = 0
    if (resetVelocity) {
      expressionFields.forEach(field => {
        transitionVelocity[field] = 0
      })
    }
  }

  const stopColorTransitions = () => {
    bodyColorAnimation.current?.stop()
    eyeColorAnimation.current?.stop()
    bodyColorAnimation.current = null
    eyeColorAnimation.current = null
  }

  const freezeLivePreviewForManipulation = () => {
    if (statePlaying) pauseState()
    const renderedExpression = { ...displayedPose.current.expression }
    stopTransition(true)
    stopColorTransitions()
    activeSequenceTransition.current = null
    pausedSequenceTransition.current = null
    transitionTarget.current = renderedExpression
    canonicalTarget.current = renderedExpression
    setExpression(renderedExpression)
    setActiveExpression(null)
    return renderedExpression
  }

  const openPhotoMode = () => {
    freezeLivePreviewForManipulation()
    setPhotoTool('frame')
    setPhotoPanelSections([])
    setMode('photo')
  }

  const updateImmediate = (next: Expression, preservePlayback = false) => {
    if (!preservePlayback && statePlaying) pauseState()
    stopTransition(true)
    stopColorTransitions()
    const pose = poseFromExpression(next)
    transitionTarget.current = next
    canonicalTarget.current = next
    setExpression(next)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(next, avatar.colors))
    setActiveExpression(null)
    paintPose(pose)
  }

  const transitionToExpression = (
    next: Expression,
    index: number | null = null,
    transitionSettings?: Pick<SequenceStep, 'transitionMs' | 'transition'>
  ) => {
    if (!transitionSettings && statePlaying) pauseState()
    sequenceTransitionRef.current = transitionSettings ?? {
      transitionMs: 500,
      transition: 'smooth',
    }
    setActiveExpression(index)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (reduceMotion || transitionSettings?.transitionMs === 0) {
      updateImmediate(next, Boolean(transitionSettings))
      setActiveExpression(index)
      return
    }
    const current = displayedPose.current.expression
    const nearestAngle = (target: number, from: number) => {
      let resolved = target
      while (resolved - from > 180) resolved -= 360
      while (resolved - from < -180) resolved += 360
      return resolved
    }
    canonicalTarget.current = next
    const resolvedTarget = {
      ...next,
      headX: nearestAngle(next.headX, current.headX),
      headY: nearestAngle(next.headY, current.headY),
      headZ: nearestAngle(next.headZ, current.headZ),
      leftAngle: nearestAngle(next.leftAngle, current.leftAngle),
      rightAngle: nearestAngle(next.rightAngle, current.rightAngle),
    }

    if (transitionSettings) {
      stopTransition(true)
      stopColorTransitions()
      const durationMs = transitionSettings.transitionMs
      lastAmbientStrength.current = 0
      const from = { ...current }
      const fromColors = {
        body: renderedColors.body.get(),
        eyes: renderedColors.eyes.get(),
      }
      const targetColors = avatar ? resolveColors(next, avatar.colors) : fromColors
      let startedAt: number | null = null
      activeSequenceTransition.current = {
        target: next,
        index,
        settings: transitionSettings,
        remainingMs: durationMs,
      }
      const tickSequenceTransition = (time: number) => {
        if (startedAt === null) startedAt = time
        const elapsed = time - startedAt
        const progress = Math.min(elapsed / durationMs, 1)
        const eased =
          transitionSettings.transition === 'smooth'
            ? progress * progress * (3 - 2 * progress)
            : transitionSettings.transition === 'snappy'
              ? 1 - (1 - progress) ** 3
              : 1 - Math.exp(-6 * progress) * Math.cos(8 * progress)
        const animated = { ...from, eyeMotion: next.eyeMotion, bodyMotion: next.bodyMotion }
        expressionFields.forEach(field => {
          animated[field] = from[field] + (resolvedTarget[field] - from[field]) * eased
        })
        activeSequenceTransition.current = {
          target: next,
          index,
          settings: transitionSettings,
          remainingMs: Math.max(durationMs - elapsed, 0),
        }
        setDisplayColors({
          body: interpolateHexColor(fromColors.body, targetColors.body, bounded(eased, 0, 1)),
          eyes: interpolateHexColor(fromColors.eyes, targetColors.eyes, bounded(eased, 0, 1)),
        })
        paintPose(poseFromExpression(animated), undefined, time, bounded(eased, 0, 1))
        if (
          modeRef.current === 'manual' &&
          time - lastInspectorFrame.current >= INSPECTOR_FRAME_MS
        ) {
          lastInspectorFrame.current = time
          setExpression(animated)
        }
        if (progress < 1) {
          transitionFrame.current = requestAnimationFrame(tickSequenceTransition)
          return
        }
        transitionFrame.current = null
        activeSequenceTransition.current = null
        canonicalTarget.current = next
        transitionTarget.current = next
        setExpression(next)
        setDisplayColors(targetColors)
        paintPose(poseFromExpression(next))
      }
      transitionFrame.current = requestAnimationFrame(tickSequenceTransition)
      return
    }

    if (avatar) {
      const targetColors = resolveColors(next, avatar.colors)
      bodyColorAnimation.current = animate(renderedColors.body, targetColors.body, {
        duration: 0.35,
        ease: 'easeInOut',
      })
      eyeColorAnimation.current = animate(renderedColors.eyes, targetColors.eyes, {
        duration: 0.35,
        ease: 'easeInOut',
      })
    }

    if (transitionFrame.current !== null) {
      retargetFrom.current = { ...transitionTarget.current }
      retargetTo.current = resolvedTarget
      retargetStartedAt.current = -1
      return
    }
    transitionTarget.current = resolvedTarget
    lastAmbientStrength.current = 0
    const initialTransitionDistance = expressionFields.reduce(
      (total, field) => total + Math.abs(resolvedTarget[field] - current[field]),
      0
    )
    let transitionProgress = 0
    const tick = (time: number) => {
      const previousTime = lastTransitionTime.current ?? time
      const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 1 / 240), 1 / 30)
      lastTransitionTime.current = time
      const { stiffness, damping } = getSequenceSpring(
        sequenceTransitionRef.current.transition,
        sequenceTransitionRef.current.transitionMs,
        springSpeedRef.current
      )
      const mass = 0.85
      const currentExpression = displayedPose.current.expression
      if (retargetStartedAt.current !== null && retargetFrom.current && retargetTo.current) {
        if (retargetStartedAt.current < 0) retargetStartedAt.current = time
        const linearProgress = Math.min((time - retargetStartedAt.current) / RETARGET_BLEND_MS, 1)
        const smoothProgress =
          linearProgress ** 3 * (linearProgress * (linearProgress * 6 - 15) + 10)
        const blendedTarget = { ...retargetTo.current }
        expressionFields.forEach(field => {
          blendedTarget[field] =
            retargetFrom.current![field] +
            (retargetTo.current![field] - retargetFrom.current![field]) * smoothProgress
        })
        transitionTarget.current = blendedTarget
        if (linearProgress === 1) {
          transitionTarget.current = retargetTo.current
          retargetFrom.current = null
          retargetTo.current = null
          retargetStartedAt.current = null
        }
      }
      const target = transitionTarget.current
      const remainingTransitionDistance = expressionFields.reduce(
        (total, field) => total + Math.abs(target[field] - currentExpression[field]),
        0
      )
      const geometricProgress =
        initialTransitionDistance <= 0
          ? 1
          : 1 - remainingTransitionDistance / initialTransitionDistance
      transitionProgress = Math.max(transitionProgress, bounded(geometricProgress, 0, 1))
      let settled = true
      const animated = { ...currentExpression }
      animated.eyeMotion = target.eyeMotion
      animated.bodyMotion = target.bodyMotion

      expressionFields.forEach(field => {
        const displacement = target[field] - currentExpression[field]
        const acceleration = (stiffness * displacement - damping * transitionVelocity[field]) / mass
        const velocity = transitionVelocity[field] + acceleration * deltaTime
        const value = currentExpression[field] + velocity * deltaTime
        transitionVelocity[field] = velocity
        animated[field] = value
        const tolerance = field === 'perspective' ? 0.0001 : 0.005
        if (Math.abs(displacement) > tolerance || Math.abs(velocity) > tolerance) settled = false
      })

      if (settled) {
        const finalExpression = canonicalTarget.current
        stopTransition(true)
        setExpression(finalExpression)
        paintPose(poseFromExpression(finalExpression))
        return
      }

      paintPose(poseFromExpression(animated), undefined, time, transitionProgress)
      if (modeRef.current === 'manual' && time - lastInspectorFrame.current >= INSPECTOR_FRAME_MS) {
        lastInspectorFrame.current = time
        setExpression(animated)
      }
      transitionFrame.current = requestAnimationFrame(tick)
    }
    transitionFrame.current = requestAnimationFrame(tick)
  }

  const blink = (durationMs?: number) => {
    blinkControls.current?.stop()
    blinkValue.jump(1)
    blinkAnimating.current = true
    const sequence = sequences.find(item => item.id === (activeState ?? selectedState))
    const blinkDuration = durationMs ?? sequence?.blink.durationMs ?? 280
    blinkControls.current = animate(blinkValue, [1, 0, 1], {
      duration: reduceMotion ? 0 : blinkDuration / 1000,
      times: [0, 0.42, 1],
      ease: ['easeIn', 'easeOut'],
      onComplete: () => {
        blinkAnimating.current = false
      },
    })
  }

  const updateDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    updateImmediate(updateEyeDimension(expression, side, dimension, value, linked[dimension]))
  }

  const updateSize = (side: Side, value: number) => {
    updateImmediate(scaleEye(expression, side, value, linked.size))
  }

  const updateSpacing = (value: number) => {
    updateImmediate({ ...expression, spacing: value })
  }

  const updateActiveAvatar = (update: (avatar: StudioAvatar) => StudioAvatar) => {
    const next = avatarsRef.current.map(avatar =>
      avatar.id === activeAvatarIdRef.current ? update(avatar) : avatar
    )
    avatarsRef.current = next
    setAvatars(next)
    if (!avatarEditSnapshot.current) {
      updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: next })
    }
  }

  const selectBodyNode = (id: 'primary' | string | null) => {
    setSelectedBodyNodeId(id)
    if (id) setSelectedEyeSide(null)
  }

  const updateSurface = (next: SurfaceConfig) => {
    surfaceRef.current = next
    setSurface(next)
    updateActiveAvatar(avatar => ({
      ...avatar,
      body: { primary: next, nodes: bodyNodesRef.current },
    }))
    paintPose(displayedPose.current)
  }

  const updateBodyNodes = (next: BodyNode[]) => {
    bodyNodesRef.current = next
    setBodyNodes(next)
    updateActiveAvatar(avatar => ({
      ...avatar,
      body: { primary: surfaceRef.current, nodes: next },
    }))
    paintPose(displayedPose.current)
  }

  const updateAvatarColors = (changes: Partial<AvatarColors>) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    const colors = { ...avatar.colors, ...changes }
    updateActiveAvatar(current => ({ ...current, colors }))
    setDisplayColors(resolveColors(expression, colors))
  }

  const updateAvatarEyes = (changes: Partial<AvatarEyeDefaults>) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    const eyes = { ...(avatar.eyes ?? defaultAvatarEyes), ...changes }
    updateActiveAvatar(current => ({ ...current, eyes }))
    paintPose(displayedPose.current)
  }

  const activateAvatar = (id: string, editBody = false, preserveMode = false) => {
    const avatar = avatarsRef.current.find(item => item.id === id)
    if (!avatar) return
    const resumeActiveSequence = !editBody && statePlaying
    if (editBody) {
      suspendStateForEditor()
      stopState(false)
    } else if (resumeActiveSequence) {
      pauseState(false)
    }
    if (editBody && !avatarEditSnapshot.current) {
      avatarEditSnapshot.current = {
        avatars: avatarsRef.current,
        activeAvatarId: activeAvatarIdRef.current,
      }
    }
    const currentStateExpression = displayedPose.current.expression
    const nextBehavior = resolveAvatarBehavior(avatar, baseBehavior)
    const nextExpressions = nextBehavior.expressions
    const nextSequences = nextBehavior.sequences
    stopTransition(true)
    activeAvatarIdRef.current = id
    surfaceRef.current = avatar.body.primary
    bodyNodesRef.current = avatar.body.nodes
    setActiveAvatarId(id)
    setSurface(avatar.body.primary)
    setBodyNodes(avatar.body.nodes)
    expressionsRef.current = nextExpressions
    sequencesRef.current = nextSequences
    expressionDragPreview.current = nextExpressions
    stateDragPreview.current = nextSequences
    setExpressions(nextExpressions)
    setSequences(nextSequences)
    setExportAnimationIds(nextSequences.map(animation => animation.id))
    const nextActiveSequence =
      !editBody && activeState
        ? (nextSequences.find(sequence => sequence.id === activeState) ?? null)
        : null
    const nextSelectedState =
      nextActiveSequence?.id ??
      (nextSequences.some(sequence => sequence.id === 'idle')
        ? 'idle'
        : (nextSequences[0]?.id ?? ''))
    activeSequenceRef.current = nextActiveSequence
    setActiveState(nextActiveSequence?.id ?? null)
    setSelectedState(nextSelectedState)
    setPlaybackVisual(current => ({ ...current, position: null }))
    selectBodyNode('primary')
    setActiveExpression(null)
    setEditing(null)
    setBodyEditing(editBody)
    if (!preserveMode || editBody) {
      modeRef.current = 'manual'
      setMode('manual')
    }
    const selectedExpression = nextActiveSequence
      ? currentStateExpression
      : { ...(nextExpressions[0] ?? defaultExpression) }
    const nextExpression = editBody ? resetBodyEditorView(selectedExpression) : selectedExpression
    setExpression(nextExpression)
    if (editBody) {
      transitionToExpression(nextExpression, null, {
        transitionMs: 450,
        transition: 'smooth',
      })
    } else {
      setDisplayColors(resolveColors(nextExpression, avatar.colors))
      canonicalTarget.current = nextExpression
      transitionTarget.current = nextExpression
      paintPose(poseFromExpression(nextExpression))
    }
    if (nextActiveSequence && resumeActiveSequence) {
      pausedSequenceTransition.current = null
      launchSequence(nextActiveSequence, true, false)
    }
    if (!avatarEditSnapshot.current) {
      updateStudioLibrary({ activeAvatarId: id, avatars: avatarsRef.current })
    }
  }

  const createNewAvatar = () => {
    avatarEditSnapshot.current = {
      avatars: avatarsRef.current,
      activeAvatarId: activeAvatarIdRef.current,
    }
    const avatar = createAvatar('Unknown')
    const next = [...avatarsRef.current, avatar]
    avatarsRef.current = next
    setAvatars(next)
    setFocusAvatarName(true)
    activateAvatar(avatar.id, true)
  }

  const duplicateAvatar = (source: StudioAvatar, editDuplicate = false) => {
    const snapshotAvatars = avatarEditSnapshot.current?.avatars ?? avatarsRef.current
    const sourceIndex = snapshotAvatars.findIndex(avatar => avatar.id === source.id)
    const baseAvatars = sourceIndex < 0 ? [...snapshotAvatars, source] : snapshotAvatars
    const duplicate: StudioAvatar = {
      ...structuredClone(source),
      id: `avatar-${crypto.randomUUID()}`,
      name: `${source.name} ${t('copie')}`,
    }
    const next = [...baseAvatars, duplicate]
    avatarEditSnapshot.current = null
    avatarsRef.current = next
    setAvatars(next)
    updateStudioLibrary({ activeAvatarId: duplicate.id, avatars: next })
    activateAvatar(duplicate.id, editDuplicate)
  }

  const previewAvatarMove = (targetId: string) => {
    const draggedId = draggedAvatarId.current
    if (!draggedId || draggedId === targetId) return
    const current = avatarDragPreview.current
    const dragged = current.find(avatar => avatar.id === draggedId)
    const targetIndex = current.findIndex(avatar => avatar.id === targetId)
    if (!dragged || targetIndex < 0) return
    const next = current.filter(avatar => avatar.id !== draggedId)
    next.splice(targetIndex, 0, dragged)
    avatarDragPreview.current = next
    setAvatars(next)
  }

  const commitAvatarMove = (targetId: string) => {
    previewAvatarMove(targetId)
    const next = avatarDragPreview.current
    avatarsRef.current = next
    updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: next })
    avatarDragOrigin.current = null
    draggedAvatarId.current = null
    setDraggingAvatarId(null)
  }

  const cancelAvatarMove = () => {
    if (draggedAvatarId.current && avatarDragOrigin.current) {
      avatarDragPreview.current = avatarDragOrigin.current
      setAvatars(avatarDragOrigin.current)
    }
    avatarDragOrigin.current = null
    draggedAvatarId.current = null
    setDraggingAvatarId(null)
  }

  const cancelAvatarEditing = () => {
    const snapshot = avatarEditSnapshot.current
    if (!snapshot) {
      setBodyEditing(false)
      setMode('avatars')
      restoreStateAfterEditor()
      return
    }
    avatarEditSnapshot.current = null
    avatarsRef.current = snapshot.avatars
    setAvatars(snapshot.avatars)
    activateAvatar(snapshot.activeAvatarId, false, true)
    setMode('avatars')
    restoreStateAfterEditor()
  }

  const saveAvatarEditing = () => {
    avatarEditSnapshot.current = null
    updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: avatarsRef.current })
    setBodyEditing(false)
    restoreStateAfterEditor()
  }

  const renameActiveAvatar = (name: string) => {
    updateActiveAvatar(avatar => ({ ...avatar, name }))
  }

  const deleteActiveAvatar = () => {
    if (avatarsRef.current.length <= 1) return
    avatarEditSnapshot.current = null
    const remaining = avatarsRef.current.filter(avatar => avatar.id !== activeAvatarIdRef.current)
    avatarsRef.current = remaining
    setAvatars(remaining)
    updateStudioLibrary({ activeAvatarId: remaining[0].id, avatars: remaining })
    setDeleteAvatarOpen(false)
    activateAvatar(remaining[0].id)
    restoreStateAfterEditor()
  }

  const addBodyNode = (type: (typeof bodyPrimitiveTypes)[number]) => {
    if (bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const node = createBodyNode(type, bodyNodesRef.current.length)
    updateBodyNodes([...bodyNodesRef.current, node])
    selectBodyNode(node.id)
  }

  const updateSelectedBodyNode = (update: (node: BodyNode) => BodyNode) => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(
      bodyNodesRef.current.map(node => (node.id === selectedBodyNodeId ? update(node) : node))
    )
  }

  const commitBodyNode = (nextNode: BodyNode) => {
    updateBodyNodes(bodyNodesRef.current.map(node => (node.id === nextNode.id ? nextNode : node)))
  }

  const previewSelectedBodyNode = (nextNode: BodyNode) => {
    const next = bodyNodesRef.current.map(node => (node.id === nextNode.id ? nextNode : node))
    bodyNodesRef.current = next
    setBodyNodes(next)
    paintPose(displayedPose.current)
  }

  const deleteSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(bodyNodesRef.current.filter(node => node.id !== selectedBodyNodeId))
    selectBodyNode('primary')
  }

  const duplicateSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary' || bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const source = bodyNodesRef.current.find(node => node.id === selectedBodyNodeId)
    if (!source) return
    const duplicate = duplicateBodyNode(source)
    updateBodyNodes([...bodyNodesRef.current, duplicate])
    selectBodyNode(duplicate.id)
  }

  const updateHighlight = (next: Highlight) => {
    if (next && statePlaying) pauseState()
    highlightRef.current = next
    setHighlight(next)
    if (next === 'head') paintPose(displayedPose.current)
  }

  const updateWireVisibility = (next: boolean) => {
    showWireRef.current = next
    setShowWire(next)
    if (next) paintPose(displayedPose.current)
  }

  const clearStateTimers = () => {
    if (stateTimer.current) clearTimeout(stateTimer.current)
    if (blinkTimer.current) clearTimeout(blinkTimer.current)
    stateTimer.current = null
    blinkTimer.current = null
    playbackTimeline.current = {
      ...playbackTimeline.current,
      stepDueAt: null,
      blinkDueAt: null,
    }
  }

  const pauseState = (persist = true) => {
    playbackTimeline.current = pausePlaybackTimeline(playbackTimeline.current, readSequenceClock())
    if (transitionFrame.current !== null && activeSequenceTransition.current) {
      cancelAnimationFrame(transitionFrame.current)
      transitionFrame.current = null
      pausedSequenceTransition.current = activeSequenceTransition.current
      activeSequenceTransition.current = null
    }
    if (blinkAnimating.current) blinkControls.current?.pause()
    clearStateTimers()
    setStatePlaying(false)
    setPlaybackStatus('paused')
    if (persist && activeState) persistStatePlayback({ stateId: activeState, playing: false })
  }

  const stopState = (persist = true) => {
    clearStateTimers()
    playbackTimeline.current = stopPlaybackTimeline(playbackTimeline.current)
    activeSequenceTransition.current = null
    pausedSequenceTransition.current = null
    stopTransition(true)
    blinkControls.current?.stop()
    blinkAnimating.current = false
    blinkValue.jump(1)
    paintPose(displayedPose.current, 1)
    setStatePlaying(false)
    setPlaybackStatus('stopped')
    setPlaybackVisual(current => ({ ...current, position: null }))
    if (persist) persistStatePlayback({ stateId: null, playing: false })
  }

  const launchSequence = (sequence: AvatarSequence, resume = false, persist = true) => {
    clearStateTimers()
    if (!sequence.steps.length) {
      stopState(persist)
      return
    }
    const id = sequence.id
    playbackTimeline.current = beginPlayback(playbackTimeline.current, resume)
    setSelectedState(id)
    setActiveState(id)
    activeSequenceRef.current = sequence
    setStatePlaying(true)
    setPlaybackStatus('playing')
    if (persist) persistStatePlayback({ stateId: id, playing: true })
    const scheduleAdvance = (delay: number) => {
      playbackTimeline.current = schedulePlaybackStep(
        playbackTimeline.current,
        readSequenceClock(),
        delay
      )
      stateTimer.current = setTimeout(advance, delay)
    }
    const playCurrentStep = () => {
      playbackTimeline.current = { ...playbackTimeline.current, stepDueAt: null }
      const step = sequence.steps[playbackTimeline.current.position]
      const availableExpressions = expressionsRef.current
      const expressionIndex = findExpressionIndex(availableExpressions, step.expressionId)
      const preset = availableExpressions[expressionIndex]
      const durationMs = (reduceMotion ? 0 : step.transitionMs) + step.holdMs
      setPlaybackVisual(current => ({
        position: playbackTimeline.current.position,
        run: current.run + 1,
        durationMs,
      }))
      if (preset) {
        transitionToExpression(preset, expressionIndex, step)
      }
      scheduleAdvance(durationMs)
    }
    const advance = () => {
      const advanced = advancePlaybackTimeline(playbackTimeline.current, sequence)
      playbackTimeline.current = advanced.timeline
      const { cursor } = advanced
      if (cursor.complete) {
        if (blinkTimer.current) clearTimeout(blinkTimer.current)
        blinkTimer.current = null
        playbackTimeline.current = { ...playbackTimeline.current, blinkDueAt: null }
        setStatePlaying(false)
        setPlaybackStatus('stopped')
        setPlaybackVisual(current => ({ ...current, position: null }))
        if (persist) persistStatePlayback({ stateId: null, playing: false })
        return
      }
      playCurrentStep()
    }
    const scheduleBlink = (delay: number) => {
      playbackTimeline.current = schedulePlaybackBlink(
        playbackTimeline.current,
        readSequenceClock(),
        delay
      )
      blinkTimer.current = setTimeout(blinkLoop, delay)
    }
    const blinkLoop = () => {
      playbackTimeline.current = { ...playbackTimeline.current, blinkDueAt: null }
      blink(sequence.blink.durationMs)
      const { minIntervalMs, maxIntervalMs } = sequence.blink
      scheduleBlink(
        sequence.blink.durationMs + minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs)
      )
    }
    if (resume) {
      const pausedTransition = pausedSequenceTransition.current
      if (pausedTransition) {
        transitionToExpression(pausedTransition.target, pausedTransition.index, {
          ...pausedTransition.settings,
          transitionMs: pausedTransition.remainingMs,
        })
        pausedSequenceTransition.current = null
      }
      if (blinkAnimating.current) blinkControls.current?.play()
      const currentStep = sequence.steps[playbackTimeline.current.position]
      scheduleAdvance(
        playbackTimeline.current.stepRemainingMs ||
          (reduceMotion ? 0 : currentStep.transitionMs) + currentStep.holdMs
      )
    } else {
      playCurrentStep()
    }
    if (sequence.blink.enabled) {
      scheduleBlink(
        resume
          ? playbackTimeline.current.blinkRemainingMs || sequence.blink.initialDelayMs
          : sequence.blink.initialDelayMs
      )
    }
  }

  const toggleStatePlayback = () => {
    if (!activeState || !activeSequenceRef.current) return
    if (statePlaying) pauseState()
    else launchSequence(activeSequenceRef.current, playbackStatus === 'paused')
  }

  const suspendStateForEditor = () => {
    if (editorStateSnapshot.current || !activeState) return
    editorStateSnapshot.current = {
      stateId: activeState,
      playing: statePlaying,
      expression: { ...displayedPose.current.expression },
    }
    if (statePlaying) pauseState(false)
    setActiveState(null)
  }

  const restoreStateAfterEditor = (availableSequences = sequences) => {
    const snapshot = editorStateSnapshot.current
    editorStateSnapshot.current = null
    if (!snapshot) return
    const sequence = availableSequences.find(item => item.id === snapshot.stateId)
    if (!sequence) {
      stopState(false)
      persistStatePlayback({ stateId: null, playing: false })
      return
    }
    activeSequenceRef.current = sequence
    setSelectedState(sequence.id)
    setActiveState(sequence.id)
    if (snapshot.playing) {
      launchSequence(sequence, true, false)
      return
    }
    setStatePlaying(false)
    transitionToExpression(snapshot.expression)
  }

  useEffect(() => {
    if (initialStatePlaybackApplied.current) return
    initialStatePlaybackApplied.current = true
    const sequence = sequences.find(item => item.id === selectedState)
    if (sequence && initialStatePlayback.stateId !== null) {
      activeSequenceRef.current = sequence
      setActiveState(sequence.id)
      if (initialStatePlayback.playing) launchSequence(sequence, false, false)
      else setPlaybackStatus('paused')
    }
    return () => {
      initialStatePlaybackApplied.current = false
    }
  }, [])

  const saveEditing = () => {
    if (!editing) return
    const index = editing.index ?? expressions.length
    const savedDraft =
      editing.index === null ? { ...editing.draft, id: createExpressionId() } : editing.draft
    const next =
      editing.index === null
        ? [...expressions, savedDraft]
        : expressions.map((item, itemIndex) =>
            itemIndex === editing.index ? { ...savedDraft } : item
          )
    setExpressions(next)
    updateStudioExpressions(next)
    setEditing(null)
    transitionToExpression(savedDraft, index)
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const duplicateExpression = (_index: number | null, draft: Expression, editDuplicate = false) => {
    const duplicate = createUnkeyedExpressionCopy(draft, createExpressionId())
    const next = [...expressions, duplicate]
    const duplicateIndex = next.length - 1
    setExpressions(next)
    updateStudioExpressions(next)
    if (editDuplicate) openExpressionEditor(duplicateIndex, duplicate)
    else transitionToExpression(duplicate, duplicateIndex)
  }

  const previewExpressionMove = (targetId: string | null) => {
    const draggedId = draggedExpressionId.current
    if (!draggedId || draggedId === targetId) return
    const current = expressionDragPreview.current
    const dragged = current.find(item => item.id === draggedId)
    if (!dragged) return
    const activeId = activeExpression === null ? null : current[activeExpression]?.id
    const next = current.filter(item => item.id !== draggedId)
    const targetIndex = targetId ? next.findIndex(item => item.id === targetId) : next.length
    next.splice(targetIndex < 0 ? next.length : targetIndex, 0, dragged)
    expressionDragPreview.current = next
    setExpressions(next)
    if (activeId) setActiveExpression(next.findIndex(item => item.id === activeId))
  }

  const commitExpressionMove = (targetId: string | null) => {
    previewExpressionMove(targetId)
    updateStudioExpressions(expressionDragPreview.current)
    expressionDragOrigin.current = null
    draggedExpressionId.current = null
    setDraggingExpressionId(null)
  }

  const cancelExpressionMove = () => {
    if (draggedExpressionId.current && expressionDragOrigin.current) {
      expressionDragPreview.current = expressionDragOrigin.current
      setExpressions(expressionDragOrigin.current)
    }
    expressionDragOrigin.current = null
    draggedExpressionId.current = null
    setDraggingExpressionId(null)
  }

  const previewExpressionDraft = (draft: Expression) => {
    setEditing(current => (current ? { ...current, draft } : current))
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const previewCanvasExpression = (next: Expression, target: CanvasPreviewTarget) => {
    const now = performance.now()
    const updateInspector =
      shouldSyncCanvasPreviewToReact(bodyEditing, target) &&
      now - lastInspectorFrame.current >= INSPECTOR_FRAME_MS
    if (updateInspector) {
      lastInspectorFrame.current = now
      if (editing) {
        setEditing(current => (current ? { ...current, draft: next } : current))
      } else {
        setExpression(next)
      }
    }
    if (bodyEditing) {
      paintRenderedRotationGizmo(renderedRotationGizmo, next)
      paintRenderedScene(
        renderedScene,
        renderAvatar(
          poseFromExpression(
            resolveCanvasPreviewExpression(next, activeAvatarEyes, bodyEditing, target)
          ),
          surfaceRef.current,
          blinkValue.get(),
          {
            includeWire: showWireRef.current || highlightRef.current === 'head',
            bodyNodes: bodyNodesRef.current,
          }
        )
      )
      return
    }
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(next, avatar.colors))
    paintPose(poseFromExpression(next))
  }

  const openExpressionEditor = (index: number | null, draft: Expression) => {
    suspendStateForEditor()
    setBodyEditing(false)
    setMode('expressions')
    setEditing({
      index,
      draft:
        index === null ? createUnkeyedExpressionCopy(draft, createExpressionId()) : { ...draft },
    })
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const cancelExpressionEditing = () => {
    setEditing(null)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(expression, avatar.colors))
    paintPose(poseFromExpression(expression))
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const deleteEditing = () => {
    if (editing?.index === null || editing?.index === undefined) return
    const next =
      expressions.length <= 1
        ? [{ ...defaultExpression }]
        : expressions.filter((_, index) => index !== editing.index)
    const fallback = next[Math.min(editing.index, next.length - 1)] ?? defaultExpression
    const deletedExpressionId = expressions[editing.index]?.id ?? editing.draft.id
    const fallbackExpressionId = fallback.id
    const nextSequences = remapSequencesAfterExpressionDelete(
      sequences,
      deletedExpressionId,
      fallbackExpressionId
    )
    setExpressions(next)
    setSequences(nextSequences)
    if (sequenceEditing) {
      const draft = remapSequencesAfterExpressionDelete(
        [sequenceEditing.draft],
        deletedExpressionId,
        fallbackExpressionId
      )[0]
      setSequenceEditing({ ...sequenceEditing, draft })
    }
    updateStudioExpressions(next)
    updateStudioSequences(nextSequences)
    setActiveExpression(null)
    setEditing(null)
    setDeleteExpressionOpen(false)
    setExpression(fallback)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(fallback, avatar.colors))
    paintPose(poseFromExpression(fallback))
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const openSequenceEditor = (sequence?: AvatarSequence) => {
    suspendStateForEditor()
    setEditing(null)
    setBodyEditing(false)
    setMode('states')
    const draft = sequence
      ? {
          ...sequence,
          steps: sequence.steps.map(step => ({ ...step })),
          blink: { ...sequence.blink },
        }
      : createSequence(expressions[activeExpression ?? 0]?.id ?? expressions[0]?.id)
    setSequenceEditing({ sourceId: sequence?.id ?? null, draft })
    setSelectedSequenceStepId(draft.steps[0]?.id ?? null)
    const firstStep = draft.steps[0]
    const expressionIndex = firstStep
      ? findExpressionIndex(expressions, firstStep.expressionId)
      : -1
    const preset = expressions[expressionIndex]
    if (preset) transitionToExpression(preset, expressionIndex, firstStep)
  }

  const cancelSequenceEditing = () => {
    if (activeState === sequenceEditing?.draft.id) stopState(false)
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    restoreStateAfterEditor()
  }

  const saveSequenceEditing = () => {
    if (!sequenceEditing?.draft.steps.length || !sequenceEditing.draft.name.trim()) return
    const saved = {
      ...sequenceEditing.draft,
      name: sequenceEditing.draft.name.trim(),
      group: sequenceEditing.draft.group.trim() || 'Custom',
    }
    const next = sequenceEditing.sourceId
      ? sequences.map(sequence => (sequence.id === sequenceEditing.sourceId ? saved : sequence))
      : [...sequences, saved]
    setSequences(next)
    updateStudioSequences(next)
    setSelectedState(saved.id)
    if (activeState === saved.id) stopState(false)
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    restoreStateAfterEditor(next)
  }

  const duplicateSequenceEditing = () => {
    if (!sequenceEditing) return
    if (activeState === sequenceEditing.draft.id) stopState(false)
    const duplicate = duplicateSequence(sequenceEditing.draft)
    const next = [...sequences, duplicate]
    setSequences(next)
    updateStudioSequences(next)
    setSelectedState(duplicate.id)
    setSequenceEditing({ sourceId: duplicate.id, draft: duplicate })
    setSelectedSequenceStepId(duplicate.steps[0]?.id ?? null)
  }

  const duplicateState = (sequence: AvatarSequence) => {
    if (activeState === sequence.id) stopState(false)
    const duplicate = duplicateSequence(sequence)
    const next = [...sequences, duplicate]
    setSequences(next)
    updateStudioSequences(next)
    setSelectedState(duplicate.id)
  }

  const previewStateMove = (targetId: string | null, targetGroup: string) => {
    const draggedId = draggedStateId.current
    if (!draggedId || draggedId === targetId) return
    const current = stateDragPreview.current
    const dragged = current.find(sequence => sequence.id === draggedId)
    if (!dragged) return
    const next = current.filter(sequence => sequence.id !== draggedId)
    const moved = { ...dragged, group: targetGroup }
    if (targetId) {
      const targetIndex = next.findIndex(sequence => sequence.id === targetId)
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, moved)
    } else {
      let lastGroupIndex = -1
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index].group !== targetGroup) continue
        lastGroupIndex = index
        break
      }
      next.splice(lastGroupIndex + 1, 0, moved)
    }
    stateDragPreview.current = next
    setSequences(next)
  }

  const commitStateMove = (targetId: string | null, targetGroup: string) => {
    previewStateMove(targetId, targetGroup)
    updateStudioSequences(stateDragPreview.current)
    stateDragOrigin.current = null
    draggedStateId.current = null
    setDraggingStateId(null)
  }

  const cancelStateMove = () => {
    if (draggedStateId.current && stateDragOrigin.current) {
      stateDragPreview.current = stateDragOrigin.current
      setSequences(stateDragOrigin.current)
    }
    stateDragOrigin.current = null
    draggedStateId.current = null
    setDraggingStateId(null)
  }

  const deleteSequenceEditing = () => {
    if (!sequenceEditing?.sourceId) return
    const next = sequences.filter(sequence => sequence.id !== sequenceEditing.sourceId)
    const fallback = next[0]
    setSequences(next)
    updateStudioSequences(next)
    if (activeState === sequenceEditing.sourceId) stopState(false)
    setSelectedState(fallback?.id ?? '')
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    setDeleteSequenceOpen(false)
    restoreStateAfterEditor(next)
  }

  const selectedBodyNode =
    selectedBodyNodeId === 'primary'
      ? null
      : (bodyNodes.find(node => node.id === selectedBodyNodeId) ?? null)

  const updateNodeVector = (property: 'position' | 'rotation', index: 0 | 1 | 2, value: number) => {
    updateSelectedBodyNode(node => {
      const vector = [...node[property]] as [number, number, number]
      vector[index] = value
      return { ...node, [property]: vector }
    })
  }
  const activeAvatar = avatars.find(avatar => avatar.id === activeAvatarId) ?? avatars[0]
  const runtimeCopySource = [activeAvatar, exportAnimationIds, expressions, sequences] as const
  const runtimeCopyStatus =
    runtimeCopyFeedback.source?.length === runtimeCopySource.length &&
    runtimeCopyFeedback.source.every((value, index) => value === runtimeCopySource[index])
      ? runtimeCopyFeedback.status
      : 'idle'
  const activeAvatarEyes = activeAvatar.eyes ?? defaultAvatarEyes
  const activeSequence = sequences.find(sequence => sequence.id === activeState) ?? null
  const activeSequenceLabel = activeSequence
    ? activeSequence.builtIn
      ? t(activeSequence.name)
      : activeSequence.name
    : null
  const expressionById = new Map(expressions.map(item => [item.id, item]))
  const semanticKeyIssueMessage = (issue: SemanticKeyIssueCode | 'duplicate_semantic_key') =>
    t(
      issue === 'missing_semantic_key'
        ? 'Ajoute une clé pour inclure cet élément dans l’export runtime.'
        : issue === 'invalid_semantic_key'
          ? 'Utilise des lettres minuscules, des chiffres et des tirets, par exemple happy-smile.'
          : issue === 'reserved_semantic_key'
            ? 'neutral est réservé à l’apparence neutre de l’avatar.'
            : 'Cette clé est déjà utilisée dans cette bibliothèque.'
    )
  const expressionSemanticKeyError = (draft: Expression) => {
    const issue = getSemanticKeyIssue(draft.semanticKey, 'expression')
    if (issue) return semanticKeyIssueMessage(issue)
    if (
      expressions.some(
        expression => expression.id !== draft.id && expression.semanticKey === draft.semanticKey
      )
    ) {
      return semanticKeyIssueMessage('duplicate_semantic_key')
    }
    return null
  }
  const animationSemanticKeyError = (draft: AvatarSequence) => {
    const issue = getSemanticKeyIssue(draft.semanticKey, 'animation')
    if (issue) return semanticKeyIssueMessage(issue)
    if (
      sequences.some(
        sequence => sequence.id !== draft.id && sequence.semanticKey === draft.semanticKey
      )
    ) {
      return semanticKeyIssueMessage('duplicate_semantic_key')
    }
    return null
  }
  const exportAnimationIdSet = new Set(exportAnimationIds)
  const selectedExportAnimations = sequences.filter(animation =>
    exportAnimationIdSet.has(animation.id)
  )
  const runtimeDefinitionResult = createAvatarDefinition({
    avatar: activeAvatar,
    behavior: { expressions, sequences: selectedExportAnimations },
  })
  const runtimeExportErrors = runtimeDefinitionResult.ok
    ? []
    : (() => {
        const messages = new Set<string>()
        const hasExpressionErrors = runtimeDefinitionResult.errors.some(error =>
          error.path.startsWith('/studio/expressions/')
        )
        runtimeDefinitionResult.errors.forEach(error => {
          if (error.code === 'unresolved_expression_reference' && hasExpressionErrors) return
          const expressionMatch = error.path.match(/^\/studio\/expressions\/(\d+)/)
          if (expressionMatch) {
            const index = Number(expressionMatch[1])
            const item = expressions[index]
            messages.add(
              `${t('Expression')} ${item?.semanticKey || String(index).padStart(2, '0')}: ${semanticKeyIssueMessage(error.code as SemanticKeyIssueCode | 'duplicate_semantic_key')}`
            )
            return
          }
          const animationMatch = error.path.match(/^\/studio\/animations\/(\d+)/)
          if (animationMatch) {
            const index = Number(animationMatch[1])
            const item = selectedExportAnimations[index]
            messages.add(
              error.code === 'unresolved_expression_reference'
                ? `${t('Animation')} ${item?.name ?? index}: ${t('Une étape référence une expression qui ne peut pas être exportée.')}`
                : `${t('Animation')} ${item?.semanticKey || item?.name || index}: ${semanticKeyIssueMessage(error.code as SemanticKeyIssueCode | 'duplicate_semantic_key')}`
            )
            return
          }
          messages.add(`${t('Valeur incompatible avec le format runtime')} (${error.path || '/'})`)
        })
        return [...messages]
      })()
  const toggleExportAnimation = (animationId: string) => {
    setExportAnimationIds(current =>
      current.includes(animationId)
        ? current.filter(id => id !== animationId)
        : [...current, animationId]
    )
  }
  const downloadAvatarExport = () => {
    if (!runtimeDefinitionResult.ok) return
    downloadBlob(
      exportFormat === 'javascript'
        ? generateJavaScriptEsmPackage(runtimeDefinitionResult.value, activeAvatar.name)
        : generateReactVitePackage(runtimeDefinitionResult.value, activeAvatar.name),
      avatarDemoFileName(activeAvatar.name, exportFormat)
    )
  }
  const downloadAvatarRuntimeDefinition = () => {
    if (!runtimeDefinitionResult.ok) return
    downloadBlob(
      new Blob([JSON.stringify(runtimeDefinitionResult.value, null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
      avatarDefinitionFileName(activeAvatar.name)
    )
  }
  const copyAvatarRuntimeDefinition = async () => {
    if (!runtimeDefinitionResult.ok) return
    if (!navigator.clipboard) {
      setRuntimeCopyFeedback({ status: 'error', source: runtimeCopySource })
      return
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(runtimeDefinitionResult.value, null, 2))
      setRuntimeCopyFeedback({ status: 'success', source: runtimeCopySource })
    } catch {
      setRuntimeCopyFeedback({ status: 'error', source: runtimeCopySource })
    }
  }
  const currentStudioDocument = (): StudioDocument => ({
    version: 2,
    library: { activeAvatarId, avatars },
    expressions: baseBehavior.expressions,
    sequences: baseBehavior.sequences,
    playback: {
      stateId: playbackStatus === 'stopped' ? null : (activeState ?? (selectedState || null)),
      playing: statePlaying,
    },
  })
  const downloadStudioProject = () => {
    const blob = new Blob([serializeStudioDocument(currentStudioDocument())], {
      type: 'application/json',
    })
    downloadBlob(blob, 'avatar-studio-project.json')
  }
  const currentSnapshotSvg = () =>
    serializeAvatarSnapshot(
      activeAvatar.name,
      renderedScene,
      {
        body: renderedColors.body.get(),
        eyes: renderedColors.eyes.get(),
      },
      {
        background: snapshotBackground,
        colorFrom: snapshotColorFrom,
        colorTo: snapshotColorTo,
        size: Number(snapshotSize),
        composition: snapshotComposition,
      }
    )

  const createPixelSnapshotCanvas = () => {
    const renderStyle = activeAvatar.renderStyle
    if (renderStyle.type !== 'pixel') return null
    const size = Number(snapshotSize)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return null
    const composition = normalizeSnapshotComposition(snapshotComposition)
    context.save()
    context.beginPath()
    context.roundRect(0, 0, size, size, (size * composition.cornerRadius) / 100)
    context.clip()
    if (snapshotBackground === 'solid') {
      context.fillStyle = snapshotColorFrom
      context.fillRect(0, 0, size, size)
    } else if (snapshotBackground === 'linear') {
      const gradient = context.createLinearGradient(0, 0, size, size)
      gradient.addColorStop(0, snapshotColorFrom)
      gradient.addColorStop(1, snapshotColorTo)
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    } else if (snapshotBackground === 'radial') {
      const gradient = context.createRadialGradient(
        size * 0.5,
        size * 0.42,
        0,
        size * 0.5,
        size * 0.42,
        size * 0.7
      )
      gradient.addColorStop(0, snapshotColorFrom)
      gradient.addColorStop(1, snapshotColorTo)
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    }
    const avatarCanvas = document.createElement('canvas')
    avatarCanvas.width = renderStyle.resolution
    avatarCanvas.height = renderStyle.resolution
    const avatarContext = avatarCanvas.getContext('2d', { willReadFrequently: true })
    if (!avatarContext) return null
    paintPixelAvatar(
      avatarContext,
      {
        headPath: renderedScene.headPath.get(),
        backPaths: renderedScene.backPaths.flatMap(item => {
          const value = item.get()
          return value ? [value] : []
        }),
        frontPaths: renderedScene.frontPaths.flatMap(item => {
          const value = item.get()
          return value ? [value] : []
        }),
        leftPath: renderedScene.leftPath.get(),
        rightPath: renderedScene.rightPath.get(),
        leftOpacity: renderedScene.leftOpacity.get(),
        rightOpacity: renderedScene.rightOpacity.get(),
        offsetX: renderedScene.offsetX.get(),
        offsetY: renderedScene.offsetY.get(),
        bodyColor: renderedColors.body.get(),
        eyeColor: renderedColors.eyes.get(),
      },
      renderStyle
    )
    context.imageSmoothingEnabled = false
    context.translate(
      size / 2 + (composition.x / 300) * size,
      size / 2 + (composition.y / 300) * size
    )
    context.scale(composition.scale, composition.scale)
    context.drawImage(avatarCanvas, -size / 2, -size / 2, size, size)
    context.restore()
    return canvas
  }
  const downloadSnapshotSvg = () => {
    const pixelCanvas = createPixelSnapshotCanvas()
    const source = pixelCanvas
      ? serializePixelSnapshot(
          activeAvatar.name,
          pixelCanvas.toDataURL('image/png'),
          Number(snapshotSize)
        )
      : currentSnapshotSvg()
    downloadBlob(
      new Blob([source], { type: 'image/svg+xml;charset=utf-8' }),
      snapshotFileName(activeAvatar.name)
    )
  }
  const downloadSnapshotPng = () => {
    const pixelCanvas = createPixelSnapshotCanvas()
    if (pixelCanvas) {
      pixelCanvas.toBlob(blob => {
        if (blob) downloadBlob(blob, snapshotFileName(activeAvatar.name, 'png'))
      }, 'image/png')
      return
    }
    const size = Number(snapshotSize)
    const source = new Blob([currentSnapshotSvg()], { type: 'image/svg+xml;charset=utf-8' })
    const sourceUrl = URL.createObjectURL(source)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d')?.drawImage(image, 0, 0, size, size)
      URL.revokeObjectURL(sourceUrl)
      canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, snapshotFileName(activeAvatar.name, 'png'))
      }, 'image/png')
    }
    image.onerror = () => URL.revokeObjectURL(sourceUrl)
    image.src = sourceUrl
  }
  const takePicture = () => {
    setPhotoFlash(current => current + 1)
    requestAnimationFrame(() => {
      if (snapshotFormat === 'png') downloadSnapshotPng()
      else downloadSnapshotSvg()
    })
  }
  const prepareStudioProjectImport = (file: File | undefined) => {
    if (!file) return
    setProjectImportError(null)
    if (file.size > 10_000_000) {
      setProjectImportError(
        t('Ce fichier n’est ni un avatar .avatar.json ni un projet Avatar Studio valide.')
      )
      return
    }
    file
      .text()
      .then(source => {
        // One picker, two formats: a `.avatar.json` definition adds a single avatar
        // to the current library, a studio project replaces the whole document.
        const parsed: unknown = JSON.parse(source)
        if (isAvatarDefinitionSource(parsed)) {
          const { avatar } = studioAvatarFromDefinition(parsed)
          const document = currentStudioDocument()
          setPendingProjectImport({
            document: {
              ...document,
              library: {
                activeAvatarId: avatar.id,
                avatars: [
                  ...document.library.avatars.filter(existing => existing.id !== avatar.id),
                  avatar,
                ],
              },
            },
            fileName: file.name,
            kind: 'avatar',
          })
          return
        }
        const imported = parseImportedStudioDocument(source, currentStudioDocument())
        setPendingProjectImport({ document: imported, fileName: file.name, kind: 'project' })
      })
      .catch(() => {
        setProjectImportError(
          t('Ce fichier n’est ni un avatar .avatar.json ni un projet Avatar Studio valide.')
        )
      })
  }
  const confirmStudioProjectImport = () => {
    if (!pendingProjectImport) return
    if (!persistStudioDocument(pendingProjectImport.document)) {
      setProjectImportError(
        t(
          'Le projet n’a pas pu être enregistré dans ce navigateur. Libère de l’espace puis réessaie.'
        )
      )
      setPendingProjectImport(null)
      return
    }
    window.location.reload()
  }
  const canvasExpression = editing?.draft ?? expression
  const editorPageOpen = bodyEditing || editing !== null || sequenceEditing !== null
  const expressionPendingDeletionId =
    editing?.index !== null && editing?.index !== undefined
      ? (expressions[editing.index]?.id ?? editing.draft.id)
      : null
  const animationsAffectedByExpressionDeletion = expressionPendingDeletionId
    ? sequences.filter(sequence =>
        sequence.steps.some(step => step.expressionId === expressionPendingDeletionId)
      )
    : []

  useEffect(() => {
    if (!editorPageOpen || focusAvatarName) return
    const frame = requestAnimationFrame(() => workspaceBackButtonRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [editorPageOpen, focusAvatarName])

  const updateAvatarEyeDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    const next = updateEyeDimension(
      { ...defaultExpression, ...activeAvatarEyes },
      side,
      dimension,
      value,
      linked[dimension]
    )
    updateAvatarEyes({
      [`${dimension}Left`]: next[`${dimension}Left`],
      [`${dimension}Right`]: next[`${dimension}Right`],
    })
  }
  const updateAvatarEyeSize = (side: Side, value: number) => {
    const next = scaleEye({ ...defaultExpression, ...activeAvatarEyes }, side, value, linked.size)
    updateAvatarEyes({
      widthLeft: next.widthLeft,
      widthRight: next.widthRight,
      heightLeft: next.heightLeft,
      heightRight: next.heightRight,
    })
  }
  const updateAvatarEyePosition = (side: Side, axis: 'X' | 'Y', value: number) => {
    const next = updateEyePosition(
      { ...defaultExpression, ...activeAvatarEyes },
      side,
      axis,
      value,
      linked.position
    )
    updateAvatarEyes({
      [`position${axis}Left`]: next[`position${axis}Left`],
      [`position${axis}Right`]: next[`position${axis}Right`],
    })
  }
  const persistEditedEyeExpression = (next: Expression) => {
    updateAvatarEyes({
      widthLeft: next.widthLeft,
      widthRight: next.widthRight,
      heightLeft: next.heightLeft,
      heightRight: next.heightRight,
      spacing: next.spacing,
      positionXLeft: next.positionXLeft,
      positionXRight: next.positionXRight,
      positionYLeft: next.positionYLeft,
      positionYRight: next.positionYRight,
      leftAngle: next.leftAngle,
      rightAngle: next.rightAngle,
    })
  }
  return {
    activateAvatar,
    activeAvatar,
    activeAvatarEyes,
    activeAvatarId,
    activeExpression,
    activeSequence,
    activeSequenceLabel,
    activeState,
    addBodyNode,
    animationsAffectedByExpressionDeletion,
    avatarDragOrigin,
    avatarDragPreview,
    avatars,
    avatarsRef,
    blink,
    bodyEditing,
    bodyNodes,
    cancelAvatarEditing,
    cancelAvatarMove,
    cancelExpressionEditing,
    cancelExpressionMove,
    cancelSequenceEditing,
    cancelStateMove,
    canvasExpression,
    commitAvatarMove,
    commitBodyNode,
    commitExpressionMove,
    commitStateMove,
    confirmStudioProjectImport,
    copyAvatarRuntimeDefinition,
    createNewAvatar,
    deleteActiveAvatar,
    deleteAvatarOpen,
    deleteEditing,
    deleteExpressionOpen,
    deleteSelectedBodyNode,
    deleteSequenceEditing,
    deleteSequenceOpen,
    downloadAvatarExport,
    downloadAvatarRuntimeDefinition,
    downloadStudioProject,
    draggedAvatarId,
    draggedExpressionId,
    draggedStateId,
    draggingAvatarId,
    draggingExpressionId,
    draggingStateId,
    duplicateAvatar,
    duplicateExpression,
    duplicateSelectedBodyNode,
    duplicateSequenceEditing,
    duplicateState,
    editing,
    editorPageOpen,
    exportAnimationIdSet,
    exportFormat,
    expression,
    expressionById,
    expressionSemanticKeyError,
    expressionDragOrigin,
    expressionDragPreview,
    expressions,
    focusAvatarName,
    freezeLivePreviewForManipulation,
    highlight,
    language,
    launchSequence,
    linked,
    mode,
    openExpressionEditor,
    openPhotoMode,
    openSequenceEditor,
    pauseState,
    pendingProjectImport,
    persistEditedEyeExpression,
    photoFlash,
    photoPanelSections,
    photoTool,
    playbackStatus,
    playbackVisual,
    prepareStudioProjectImport,
    previewAvatarMove,
    previewCanvasExpression,
    previewExpressionDraft,
    previewExpressionMove,
    previewSelectedBodyNode,
    previewStateMove,
    projectImportError,
    avatarImportRef,
    projectImportRef,
    reduceMotion,
    renameActiveAvatar,
    renderedColors,
    renderedRotationGizmo,
    renderedScene,
    runtimeDefinitionResult,
    runtimeCopyStatus,
    runtimeExportErrors,
    saveAvatarEditing,
    saveEditing,
    saveSequenceEditing,
    selectBodyNode,
    selectedBodyNode,
    selectedBodyNodeId,
    selectedExportAnimations,
    selectedEyeSide,
    selectedSequenceStepId,
    selectedState,
    sequenceEditing,
    animationSemanticKeyError,
    sequences,
    setDeleteAvatarOpen,
    setDeleteExpressionOpen,
    setDeleteSequenceOpen,
    setDraggingAvatarId,
    setDraggingExpressionId,
    setDraggingStateId,
    setEditing,
    setExportAnimationIds,
    setExportFormat,
    setFocusAvatarName,
    setLanguage,
    setLinked,
    setMode,
    setPendingProjectImport,
    setPhotoPanelSections,
    setPhotoTool,
    setSelectedEyeSide,
    setSelectedSequenceStepId,
    setSequenceEditing,
    setSnapshotBackground,
    setSnapshotColorFrom,
    setSnapshotColorTo,
    setSnapshotComposition,
    setSnapshotFormat,
    setSnapshotSize,
    setSpringSpeed,
    setStatePlayerExpanded,
    showWire,
    snapshotBackground,
    snapshotColorFrom,
    snapshotColorTo,
    snapshotComposition,
    snapshotFormat,
    snapshotSize,
    springSpeed,
    springSpeedRef,
    stateDragOrigin,
    stateDragPreview,
    statePlayerExpanded,
    statePlaying,
    stopState,
    surface,
    t,
    takePicture,
    toggleExportAnimation,
    toggleStatePlayback,
    transitionToExpression,
    updateAvatarColors,
    updateAvatarEyeDimension,
    updateAvatarEyePosition,
    updateAvatarEyeSize,
    updateAvatarEyes,
    updateDimension,
    updateHighlight,
    updateImmediate,
    updateNodeVector,
    updateSelectedBodyNode,
    updateSize,
    updateSpacing,
    updateSurface,
    updateWireVisibility,
    workspaceBackButtonRef,
  }
}

export type StudioController = ReturnType<typeof useStudioController>
