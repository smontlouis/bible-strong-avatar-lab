import { Camera, Info, Move3D, RotateCcw, Scan } from 'lucide-react'
import { motion } from 'motion/react'
import { type CSSProperties, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { defaultExpression } from '@/features/avatar/presets'
import { AvatarCanvas } from '@/features/rendering/components/AvatarCanvas'
import { PhotoStageFrame } from '@/features/studio/components/PhotoStageFrame'
import { StudioIdentity } from '@/features/studio/components/StudioIdentity'
import type { StudioController } from '@/features/studio/useStudioController'

export function StudioStage({ controller }: { controller: StudioController }) {
  const [photoHelpOpen, setPhotoHelpOpen] = useState(false)
  const {
    activateAvatar,
    activeAvatar,
    activeAvatarEyes,
    activeAvatarId,
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
    openPhotoMode,
    persistEditedEyeExpression,
    photoFlash,
    photoTool,
    playbackStatus,
    previewCanvasExpression,
    previewExpressionDraft,
    previewSelectedBodyNode,
    renderedColors,
    renderedRotationGizmo,
    renderedScene,
    selectBodyNode,
    selectedBodyNode,
    selectedBodyNodeId,
    selectedEyeSide,
    sequenceEditing,
    setEditing,
    setPhotoPanelSections,
    setPhotoTool,
    setSelectedEyeSide,
    setSnapshotComposition,
    showWire,
    snapshotBackground,
    snapshotColorFrom,
    snapshotColorTo,
    snapshotComposition,
    surface,
    t,
    takePicture,
    transitionToExpression,
    updateHighlight,
    updateImmediate,
  } = controller
  const photoMode = mode === 'photo'
  const enterBodyEdit = () => {
    if (bodyEditing || editing !== null || sequenceEditing !== null) return
    if (mode === 'photo' || mode === 'export') return
    activateAvatar(activeAvatarId, true)
  }
  const activatePhotoTool = (tool: typeof photoTool) => {
    setPhotoTool(tool)
    setPhotoPanelSections(current => (current.includes(tool) ? current : [...current, tool]))
  }
  const resetPhotoSetup = () => {
    updateImmediate({ ...defaultExpression })
    setSnapshotComposition(current => ({ ...current, x: 0, y: 0, scale: 1 }))
  }
  const avatarCanvas = (
    <AvatarCanvas
      expression={canvasExpression}
      avatarEyes={activeAvatarEyes}
      surface={surface}
      scene={renderedScene}
      colors={renderedColors}
      renderStyle={activeAvatar.renderStyle}
      rotationGizmo={renderedRotationGizmo}
      showWire={showWire}
      bodyEditing={bodyEditing}
      selectedBodyNodeId={selectedBodyNodeId}
      selectedBodyNode={selectedBodyNode}
      selectedSide={selectedEyeSide}
      linked={linked}
      highlight={highlight}
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
        activeSequenceLabel && playbackStatus !== 'stopped'
          ? { name: activeSequenceLabel, status: playbackStatus }
          : null
      }
      onManipulationStart={freezeLivePreviewForManipulation}
      onEnterBodyEdit={enterBodyEdit}
    />
  )
  return (
    <motion.section
      className={`stage-column${photoMode ? ' photo-mode-active' : ''}`}
      style={
        {
          '--avatar-body-color': renderedColors.body,
          '--avatar-eye-color': renderedColors.eyes,
        } as CSSProperties
      }
    >
      <StudioIdentity
        className="stage-identity"
        language={controller.language}
        setLanguage={controller.setLanguage}
        t={t}
      />
      {photoMode ? (
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
      ) : (
        avatarCanvas
      )}
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
      <TooltipProvider>
        {photoMode && (
          <div className="photo-tool-bar" role="toolbar" aria-label={t('Outils du mode photo')}>
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
          </div>
        )}
        <div className="photo-capture-bar">
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
          <Tooltip
            open={photoHelpOpen}
            onOpenChange={open => {
              if (!open) setPhotoHelpOpen(false)
            }}
          >
            <TooltipTrigger
              closeOnClick={false}
              render={
                <Button
                  className="photo-help-button"
                  variant="secondary"
                  size="icon-sm"
                  type="button"
                  aria-label={t('Informations sur le mode photo')}
                  aria-expanded={photoHelpOpen}
                  onClick={() => setPhotoHelpOpen(open => !open)}
                />
              }
            >
              <Info />
            </TooltipTrigger>
            <TooltipContent side="top" className="photo-help-tooltip">
              {t(
                photoMode
                  ? 'Utilise Pose pour orienter l’avatar et Cadrage pour le déplacer ou le zoomer.'
                  : 'Ouvre le mode photo pour choisir une expression, cadrer puis exporter l’avatar.'
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
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
