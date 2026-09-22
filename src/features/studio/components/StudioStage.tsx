import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  type VirtualElement,
  useFloating,
} from '@floating-ui/react'
import {
  ArrowLeft,
  AudioLines,
  Camera,
  Move3D,
  Radio,
  RotateCcw,
  Scan,
  ScanFace,
} from 'lucide-react'
import { AnimatePresence, motion, useSpring } from 'motion/react'
import { type CSSProperties, useEffect, useReducer, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import { defaultExpression } from '@/features/avatar/presets'
import { AvatarCanvas } from '@/features/rendering/components/AvatarCanvas'
import { PhotoStageFrame } from '@/features/studio/components/PhotoStageFrame'
import { StudioIdentity } from '@/features/studio/components/StudioIdentity'
import type { StudioController } from '@/features/studio/useStudioController'

const talkBubbleFollowSpring = {
  stiffness: 180,
  damping: 26,
  mass: 0.8,
}
const talkBubblePositionFps = 10

const throttlePositionUpdate = (update: () => void, interval: number) => {
  let lastUpdate = Number.NEGATIVE_INFINITY
  let timeout: ReturnType<typeof setTimeout> | null = null

  const run = () => {
    timeout = null
    lastUpdate = performance.now()
    update()
  }
  const throttledUpdate = () => {
    const remaining = interval - (performance.now() - lastUpdate)
    if (remaining <= 0) {
      if (timeout !== null) clearTimeout(timeout)
      run()
    } else if (timeout === null) {
      timeout = setTimeout(run, remaining)
    }
  }
  throttledUpdate.cancel = () => {
    if (timeout !== null) clearTimeout(timeout)
    timeout = null
  }

  return throttledUpdate
}

function StageModeControls({
  controller,
  photoMode,
  talkMode,
  onOpenStand,
}: {
  controller: StudioController
  photoMode: boolean
  talkMode: boolean
  onOpenStand: () => void
}) {
  const {
    openPhotoMode,
    openStreamMode,
    openTalkMode,
    photoTool,
    setMode,
    setPhotoPanelSections,
    setPhotoTool,
    setSnapshotComposition,
    t,
    takePicture,
    updateImmediate,
  } = controller
  const transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }
  const activatePhotoTool = (tool: typeof photoTool) => {
    setPhotoTool(tool)
    setPhotoPanelSections(current => (current.includes(tool) ? current : [...current, tool]))
  }
  const resetPhotoSetup = () => {
    updateImmediate({ ...defaultExpression })
    setSnapshotComposition(current => ({ ...current, x: 0, y: 0, scale: 1 }))
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {photoMode && (
          <motion.div
            className="photo-tool-bar"
            role="toolbar"
            aria-label={t('Outils du mode photo')}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={transition}
          >
            <Button
              variant="secondary"
              type="button"
              aria-pressed={photoTool === 'pose'}
              onClick={() => activatePhotoTool('pose')}
            >
              <Move3D />
              {t('Pose')}
            </Button>
            <Button
              variant="secondary"
              type="button"
              aria-pressed={photoTool === 'frame'}
              onClick={() => activatePhotoTool('frame')}
            >
              <Scan />
              {t('Cadrage')}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              type="button"
              aria-label={t('Réinitialiser la pose et le cadrage')}
              onClick={resetPhotoSetup}
            >
              <RotateCcw />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          className="photo-capture-bar"
          key={talkMode ? 'talk-exit' : photoMode ? 'photo-capture' : 'mode-launchers'}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={transition}
        >
          {talkMode ? (
            <Button
              className="photo-capture-button stage-exit-button"
              variant="secondary"
              size="icon"
              type="button"
              aria-label={t('Quitter')}
              onClick={() => setMode('avatars')}
            >
              <ArrowLeft />
            </Button>
          ) : (
            <>
              {photoMode && (
                <Button
                  className="photo-capture-button stage-exit-button"
                  variant="secondary"
                  size="icon"
                  type="button"
                  aria-label={t('Quitter')}
                  onClick={() => setMode('avatars')}
                >
                  <ArrowLeft />
                </Button>
              )}
              <Button
                className="photo-capture-button"
                type="button"
                aria-label={t(photoMode ? 'Prendre une photo' : 'Ouvrir le mode photo')}
                onClick={() => (photoMode ? takePicture() : openPhotoMode())}
              >
                <Camera />
                <span className="photo-capture-label">
                  {t(photoMode ? 'Prendre une photo' : 'Mode photo')}
                </span>
              </Button>
              {!photoMode && (
                <>
                  <Button
                    className="photo-capture-button stand-mode-button"
                    aria-label={t('Mode stand')}
                    variant="secondary"
                    type="button"
                    onClick={onOpenStand}
                  >
                    <ScanFace />
                    <span className="photo-capture-label">{t('Mode stand')}</span>
                  </Button>
                  <Button
                    className="photo-capture-button talk-mode-button"
                    variant="secondary"
                    type="button"
                    aria-label={t('Ouvrir le Talk Mode')}
                    onClick={openTalkMode}
                  >
                    <AudioLines />
                    <span className="photo-capture-label">{t('Talk Mode')}</span>
                  </Button>
                  <Button
                    className="photo-capture-button stream-mode-button"
                    variant="secondary"
                    type="button"
                    aria-label={t('Ouvrir le Stream Mode')}
                    onClick={openStreamMode}
                  >
                    <Radio />
                    <span className="photo-capture-label">{t('Stream Mode')}</span>
                  </Button>
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

export function StudioStage({
  controller,
  onOpenStand,
}: {
  controller: StudioController
  onOpenStand: () => void
}) {
  const talkBubbleTextRef = useRef<HTMLParagraphElement>(null)
  const [talkBubbleFloating, setTalkBubbleFloating] = useState<HTMLDivElement | null>(null)
  const [talkBubbleReference, setTalkBubbleReference] = useReducer(
    (_current: VirtualElement | null, element: SVGGElement | null): VirtualElement | null =>
      element ? { getBoundingClientRect: () => element.getBoundingClientRect() } : null,
    null
  )
  const {
    isPositioned: talkBubbleIsPositioned,
    placement: talkBubblePlacement,
    refs: talkBubbleRefs,
    strategy: talkBubbleStrategy,
    x: talkBubbleX,
    y: talkBubbleY,
  } = useFloating<VirtualElement>({
    elements: {
      floating: talkBubbleFloating,
    },
    open: talkBubbleFloating !== null,
    strategy: 'fixed',
    placement: 'right',
    middleware: [
      offset({
        mainAxis: 100,
        crossAxis: 30,
      }),
      flip({ fallbackPlacements: ['left-end'], padding: 18 }),
      shift({ padding: 18 }),
      size({
        padding: 18,
        apply({ availableWidth, elements }) {
          elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`
        },
      }),
    ],
    whileElementsMounted(reference, floating, update) {
      const throttledUpdate = throttlePositionUpdate(update, 1000 / talkBubblePositionFps)
      const stopAutoUpdate = autoUpdate(reference, floating, throttledUpdate, {
        animationFrame: true,
      })
      return () => {
        stopAutoUpdate()
        throttledUpdate.cancel()
      }
    },
  })
  useEffect(() => {
    talkBubbleRefs.setPositionReference(talkBubbleReference)
  }, [talkBubbleReference, talkBubbleRefs])
  const smoothTalkBubbleX = useSpring(0, talkBubbleFollowSpring)
  const smoothTalkBubbleY = useSpring(0, talkBubbleFollowSpring)
  const talkBubbleHasPosition = useRef(false)
  const previousTalkBubblePlacement = useRef(talkBubblePlacement)
  const {
    activeAvatar,
    activeAvatarEyes,
    activeSequenceLabel,
    bodyEditing,
    canvasExpression,
    commitBodyNode,
    editing,
    expression,
    freezeLivePreviewForManipulation,
    highlight,
    linked,
    mode,
    persistEditedEyeExpression,
    photoFlash,
    photoTool,
    playbackStatus,
    previewCanvasExpression,
    previewExpressionDraft,
    previewSelectedBodyNode,
    reduceMotion,
    renderedColors,
    renderedRotationGizmo,
    renderedScene,
    selectBodyNode,
    selectedBodyNode,
    selectedBodyNodeId,
    selectedEyeSide,
    setEditing,
    setSelectedEyeSide,
    setSnapshotComposition,
    showWire,
    snapshotBackground,
    snapshotColorFrom,
    snapshotColorTo,
    snapshotComposition,
    surface,
    t,
    talkBubbleText,
    talkPlaybackStatus,
    transitionToExpression,
    updateHighlight,
    updateImmediate,
  } = controller
  const photoMode = mode === 'photo'
  const streamMode = mode === 'stream'
  const talkMode = mode === 'talk' || streamMode
  useEffect(() => {
    if (!talkBubbleFloating || !talkBubbleIsPositioned) {
      talkBubbleHasPosition.current = false
      return
    }

    const placementChanged = previousTalkBubblePlacement.current !== talkBubblePlacement
    if (!talkBubbleHasPosition.current || placementChanged || reduceMotion) {
      smoothTalkBubbleX.jump(talkBubbleX)
      smoothTalkBubbleY.jump(talkBubbleY)
    } else {
      smoothTalkBubbleX.set(talkBubbleX)
      smoothTalkBubbleY.set(talkBubbleY)
    }
    talkBubbleHasPosition.current = true
    previousTalkBubblePlacement.current = talkBubblePlacement
  }, [
    reduceMotion,
    smoothTalkBubbleX,
    smoothTalkBubbleY,
    talkBubbleFloating,
    talkBubbleIsPositioned,
    talkBubblePlacement,
    talkBubbleX,
    talkBubbleY,
  ])
  useEffect(() => {
    const textElement = talkBubbleTextRef.current
    if (textElement) {
      textElement.scrollTop = textElement.scrollHeight
    }
  }, [talkBubbleText])
  const quickTransition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }
  const avatarCanvas = (
    <AvatarCanvas
      expression={canvasExpression}
      avatarEyes={activeAvatarEyes}
      surface={surface}
      scene={renderedScene}
      colors={renderedColors}
      renderStyle={activeAvatar.renderStyle}
      rotationGizmo={renderedRotationGizmo}
      showWire={talkMode ? false : showWire}
      bodyEditing={talkMode ? false : bodyEditing}
      selectedBodyNodeId={talkMode ? null : selectedBodyNodeId}
      selectedBodyNode={talkMode ? null : selectedBodyNode}
      selectedSide={talkMode ? null : selectedEyeSide}
      linked={linked}
      highlight={talkMode ? null : highlight}
      onHighlightChange={updateHighlight}
      onBodyNodeSelect={selectBodyNode}
      onBodyNodePreview={previewSelectedBodyNode}
      onBodyNodeChange={commitBodyNode}
      onEyeSelect={setSelectedEyeSide}
      onPreview={previewCanvasExpression}
      onChange={editing ? previewExpressionDraft : updateImmediate}
      onReset={next => {
        if (editing) {
          setEditing(current => (current ? { ...current, draft: next } : current))
        }
        transitionToExpression(next)
      }}
      onEyeChange={
        editing ? previewExpressionDraft : bodyEditing ? persistEditedEyeExpression : undefined
      }
      playback={
        !talkMode && activeSequenceLabel && playbackStatus !== 'stopped'
          ? { name: activeSequenceLabel, status: playbackStatus }
          : null
      }
      onManipulationStart={freezeLivePreviewForManipulation}
      controlsVisible={!talkMode && (!photoMode || photoTool === 'pose')}
      rotationInteractionEnabled={talkMode || !photoMode || photoTool === 'pose'}
      avatarAnchorRef={setTalkBubbleReference}
    />
  )
  return (
    <motion.section
      className={`stage-column${photoMode ? ' photo-mode-active' : ''}${talkMode ? ' talk-mode-active' : ''}${streamMode ? ' stream-mode-active' : ''}`}
      style={
        {
          '--avatar-body-color': renderedColors.body,
          '--avatar-eye-color': renderedColors.eyes,
        } as CSSProperties
      }
    >
      <motion.div
        className="stage-mode-halo stage-mode-halo-blue"
        aria-hidden="true"
        animate={{
          opacity: talkMode ? 0 : photoMode ? 1 : 0.72,
          scale: photoMode ? 1.16 : 1,
        }}
        transition={quickTransition}
      />
      <motion.div
        className="stage-mode-halo stage-mode-halo-green"
        aria-hidden="true"
        animate={{ opacity: talkMode ? 1 : 0, scale: talkMode ? 1.08 : 0.94 }}
        transition={quickTransition}
      />
      <StudioIdentity
        className="stage-identity"
        language={controller.language}
        setLanguage={controller.setLanguage}
        t={t}
      />
      <AnimatePresence initial={false} mode="popLayout">
        {photoMode ? (
          <motion.div
            className="stage-mode-content"
            key="photo-stage"
            initial={{ opacity: 0, scale: 0.965, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.975, y: -8 }}
            transition={quickTransition}
          >
            <PhotoStageFrame
              background={snapshotBackground}
              colorFrom={snapshotColorFrom}
              colorTo={snapshotColorTo}
              composition={snapshotComposition}
              tool={photoTool}
              onCompositionChange={setSnapshotComposition}
            >
              {avatarCanvas}
            </PhotoStageFrame>
          </motion.div>
        ) : (
          <motion.div
            className="stage-mode-content live-stage-scene"
            key="live-stage"
            initial={{ opacity: 0, scale: 0.975, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.975, y: 8 }}
            transition={quickTransition}
          >
            <motion.div
              className="stage-avatar-positioner"
              animate={{
                x: talkMode ? '-27%' : '0%',
                scale: talkMode ? 0.72 : 1,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 32, mass: 0.82 }}
            >
              {avatarCanvas}
            </motion.div>
            <FloatingPortal>
              <AnimatePresence initial={false}>
                {talkMode && (talkPlaybackStatus !== 'idle' || talkBubbleText) && (
                  <motion.div
                    className="talk-speech-bubble-positioner"
                    key="talk-speech-bubble"
                    ref={setTalkBubbleFloating}
                    style={{
                      position: talkBubbleStrategy,
                      top: 0,
                      left: 0,
                      visibility: talkBubbleIsPositioned ? 'visible' : 'hidden',
                      x: smoothTalkBubbleX,
                      y: smoothTalkBubbleY,
                    }}
                  >
                    <aside
                      className={`talk-speech-bubble ${talkBubblePlacement.startsWith('left') ? 'rounded-out-br-3xl' : 'rounded-out-bl-3xl'}${talkPlaybackStatus === 'speaking' ? ' is-speaking' : ''}`}
                      data-side={talkBubblePlacement.split('-')[0]}
                      aria-live="polite"
                    >
                      <p ref={talkBubbleTextRef}>{talkBubbleText || '…'}</p>
                    </aside>
                  </motion.div>
                )}
              </AnimatePresence>
            </FloatingPortal>
          </motion.div>
        )}
      </AnimatePresence>
      {photoFlash > 0 && (
        <motion.div
          className="photo-flash"
          key={photoFlash}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0] }}
          transition={{ duration: 0.38, times: [0, 0.16, 1], ease: 'easeOut' }}
        />
      )}
      <StageModeControls
        controller={controller}
        photoMode={photoMode}
        talkMode={talkMode}
        onOpenStand={onOpenStand}
      />
      <p className="stage-credit">
        Made with ❤️ by{' '}
        <a href="https://x.com/_smontlouis" target="_blank" rel="noreferrer">
          @_smontlouis
        </a>
        .
      </p>
    </motion.section>
  )
}
