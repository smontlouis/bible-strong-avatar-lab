import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileCode2,
  Move3D,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Scan,
  Shuffle,
  Smile,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Field, FieldTitle } from '@/components/ui/field'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

import {
  ControlSection,
  ExportSection,
  InspectorCard,
  PanelTitle,
  StatePlayer,
} from '@/app/components/common'
import { ColorField, LinkButton, NumericField } from '@/app/components/controls'
import {
  COPY_FEEDBACK_DURATION_MS,
  formatSeconds,
  type Side,
  type SnapshotFormat,
} from '@/app/studio-utils'
import { SequenceWorkspace } from '@/features/animation/components/SequenceWorkspace'
import { findExpressionIndex, groupSequences } from '@/features/animation/sequences'
import { defaultAvatarEyes } from '@/features/avatar/avatars'
import {
  ExpressionCard,
  ExpressionPreview,
  ExpressionWorkspace,
} from '@/features/avatar/components/ExpressionWorkspace'
import { defaultExpression } from '@/features/avatar/presets'
import { randomSnapshotPalette } from '@/features/export/snapshotPalette'
import { type SnapshotBackground } from '@/features/export/snapshotExporter'
import { AvatarPage } from '@/features/studio/components/AvatarDrawer'
import { BodyConstructionAccordion } from '@/features/studio/components/BodyConstructionAccordion'
import { HighlightedRuntimeCode } from '@/features/studio/components/HighlightedRuntimeCode'
import {
  buildRuntimeGuideText,
  RuntimeGuideDialog,
} from '@/features/studio/components/RuntimeGuideDialog'
import { RuntimePreviewDialog } from '@/features/studio/components/RuntimePreviewDialog'
import { StudioIdentity } from '@/features/studio/components/StudioIdentity'
import type { StudioController } from '@/features/studio/useStudioController'

const reactQuickStartInstall = 'npm install @bible-strong/avatar-react react react-dom'
const webQuickStartInstall = 'npm install @bible-strong/avatar-web'

const reactQuickStartExample = (animationKey: string | undefined) =>
  `import { createAvatar } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import definition from './avatar.avatar.json'

const Avatar = createAvatar(definition)

export function App() {
  return <Avatar ${animationKey ? `defaultAnimation="${animationKey}"` : 'defaultExpression="neutral"'} />
}`

const webQuickStartExample = (animationKey: string | undefined) =>
  `import { createAvatar } from '@bible-strong/avatar-web'
import definition from './avatar.avatar.json'

const avatar = createAvatar('#avatar', {
  definition,
  ${animationKey ? `defaultAnimation: '${animationKey}',` : `defaultExpression: 'neutral',`}
})`

function PoseControls({ controller }: { controller: StudioController }) {
  const {
    activeAvatar,
    expression,
    linked,
    setLinked,
    showWire,
    t,
    updateDimension,
    updateHighlight,
    updateImmediate,
    updateSize,
    updateSpacing,
    updateWireVisibility,
  } = controller

  return (
    <>
      <ControlSection title="Corps" subtitle="Orientation et apparence générale de la pose.">
        <InspectorCard className="color-panel">
          <PanelTitle
            level={3}
            title="Couleur du corps"
            subtitle="La pose peut remplacer temporairement la couleur de l’avatar."
          />
          <ColorField
            label="Corps"
            value={expression.bodyColor ?? activeAvatar.colors.body}
            onChange={bodyColor => updateImmediate({ ...expression, bodyColor })}
          />
          {expression.bodyColor && (
            <Button
              className="inherit-colors"
              variant="ghost"
              size="icon-sm"
              aria-label={t('Reprendre la couleur de l’avatar')}
              onClick={() => {
                const next = { ...expression }
                delete next.bodyColor
                updateImmediate(next)
              }}
            >
              <RotateCcw />
            </Button>
          )}
        </InspectorCard>
        <InspectorCard>
          <PanelTitle
            level={3}
            title="Rotation de la tête"
            subtitle="Les libellés ↔ sont scrubbables, comme dans Figma."
          />
          <NumericField
            label="Rotation X"
            value={expression.headX}
            unit="°"
            onActiveChange={active => updateHighlight(active ? 'head' : null)}
            onChange={value => updateImmediate({ ...expression, headX: value })}
          />
          <NumericField
            label="Rotation Y"
            value={expression.headY}
            unit="°"
            onActiveChange={active => updateHighlight(active ? 'head' : null)}
            onChange={value => updateImmediate({ ...expression, headY: value })}
          />
          <NumericField
            label="Rotation Z"
            value={expression.headZ}
            unit="°"
            onActiveChange={active => updateHighlight(active ? 'head' : null)}
            onChange={value => updateImmediate({ ...expression, headZ: value })}
          />
        </InspectorCard>
      </ControlSection>
      <ControlSection title="Yeux" subtitle="Forme, placement, orientation et couleur du regard.">
        <InspectorCard className="color-panel">
          <PanelTitle
            level={3}
            title="Couleur des yeux"
            subtitle="La pose peut remplacer temporairement la couleur de l’avatar."
          />
          <ColorField
            label="Yeux"
            value={expression.eyeColor ?? activeAvatar.colors.eyes}
            onChange={eyeColor => updateImmediate({ ...expression, eyeColor })}
          />
          {expression.eyeColor && (
            <Button
              className="inherit-colors"
              variant="ghost"
              size="icon-sm"
              aria-label={t('Reprendre la couleur de l’avatar')}
              onClick={() => {
                const next = { ...expression }
                delete next.eyeColor
                updateImmediate(next)
              }}
            >
              <RotateCcw />
            </Button>
          )}
        </InspectorCard>
        {(['width', 'height', 'size'] as const).map(dimension => (
          <InspectorCard className="compact" key={dimension}>
            <div className="panel-inline-title">
              <h3>
                {t(
                  {
                    width: 'Largeur',
                    height: 'Hauteur',
                    size: 'Taille proportionnelle',
                  }[dimension]
                )}
              </h3>
              <LinkButton
                linked={linked[dimension]}
                label={`Lier ${dimension}`}
                onClick={() =>
                  setLinked(current => ({
                    ...current,
                    [dimension]: !current[dimension],
                  }))
                }
              />
            </div>
            <div className="eye-columns">
              {(['Left', 'Right'] as Side[]).map(side => {
                const width = expression[`width${side}`]
                const height = expression[`height${side}`]
                const value =
                  dimension === 'width'
                    ? width
                    : dimension === 'height'
                      ? height
                      : Math.max(width, height)
                return (
                  <NumericField
                    key={side}
                    label={side === 'Left' ? 'Œil gauche' : 'Œil droit'}
                    value={value}
                    min={10}
                    max={dimension === 'size' ? 110 : 100}
                    unit="u"
                    onActiveChange={active =>
                      updateHighlight(
                        active
                          ? linked[dimension]
                            ? 'both'
                            : side === 'Left'
                              ? 'left'
                              : 'right'
                          : null
                      )
                    }
                    onChange={next =>
                      dimension === 'size'
                        ? updateSize(side, next)
                        : updateDimension(side, dimension, next)
                    }
                  />
                )
              })}
            </div>
          </InspectorCard>
        ))}
        <InspectorCard>
          <PanelTitle
            level={3}
            title="Position et espacement"
            subtitle="Coordonnées communes projetées sur la forme choisie."
          />
          <div className="eye-columns">
            <div className="eye-column">
              <h3>{t('Œil gauche')}</h3>
              <NumericField
                label="Horizontale"
                value={expression.positionXLeft}
                unit="u"
                onActiveChange={active => updateHighlight(active ? 'left' : null)}
                onChange={value => updateImmediate({ ...expression, positionXLeft: value })}
              />
              <NumericField
                label="Verticale"
                value={expression.positionYLeft}
                unit="u"
                onActiveChange={active => updateHighlight(active ? 'left' : null)}
                onChange={value => updateImmediate({ ...expression, positionYLeft: value })}
              />
            </div>
            <div className="eye-column">
              <h3>{t('Œil droit')}</h3>
              <NumericField
                label="Horizontale"
                value={expression.positionXRight}
                unit="u"
                onActiveChange={active => updateHighlight(active ? 'right' : null)}
                onChange={value => updateImmediate({ ...expression, positionXRight: value })}
              />
              <NumericField
                label="Verticale"
                value={expression.positionYRight}
                unit="u"
                onActiveChange={active => updateHighlight(active ? 'right' : null)}
                onChange={value => updateImmediate({ ...expression, positionYRight: value })}
              />
            </div>
          </div>
          <div className="position-spacing">
            <NumericField
              label="Espacement"
              value={expression.spacing}
              min={0}
              max={150}
              unit="u"
              onActiveChange={active => updateHighlight(active ? 'both' : null)}
              onChange={updateSpacing}
            />
          </div>
        </InspectorCard>
        <InspectorCard>
          <div className="panel-inline-title">
            <PanelTitle
              level={3}
              title="Rotation locale"
              subtitle="Inclinaison propre à chaque œil."
            />
            <LinkButton
              linked={linked.rotation}
              label="Lier les rotations"
              onClick={() => setLinked(current => ({ ...current, rotation: !current.rotation }))}
            />
          </div>
          <div className="eye-columns">
            <NumericField
              label="Œil gauche"
              value={expression.leftAngle}
              unit="°"
              onActiveChange={active =>
                updateHighlight(active ? (linked.rotation ? 'both' : 'left') : null)
              }
              onChange={value =>
                updateImmediate({
                  ...expression,
                  leftAngle: value,
                  ...(linked.rotation ? { rightAngle: -value } : {}),
                })
              }
            />
            <NumericField
              label="Œil droit"
              value={expression.rightAngle}
              unit="°"
              onActiveChange={active =>
                updateHighlight(active ? (linked.rotation ? 'both' : 'right') : null)
              }
              onChange={value =>
                updateImmediate({
                  ...expression,
                  rightAngle: value,
                  ...(linked.rotation ? { leftAngle: -value } : {}),
                })
              }
            />
          </div>
        </InspectorCard>
      </ControlSection>
      <ControlSection
        title="Projection"
        subtitle="Perspective et repères appliqués à la surface active."
      >
        <InspectorCard>
          <PanelTitle level={3} title="Perspective" subtitle="Profondeur simulée du visage." />
          <NumericField
            label="Perspective"
            value={expression.perspective}
            step={0.01}
            unit="×"
            onChange={value => updateImmediate({ ...expression, perspective: value })}
          />
          <div className="switch">
            <span>{t('Afficher le maillage')}</span>
            <Switch
              checked={showWire}
              onCheckedChange={updateWireVisibility}
              aria-label={t('Afficher le maillage')}
            />
          </div>
        </InspectorCard>
      </ControlSection>
    </>
  )
}

export function StudioInspector({ controller }: { controller: StudioController }) {
  const [runtimePreviewOpen, setRuntimePreviewOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideCopyFeedback, setGuideCopyFeedback] = useState<{
    format: 'react' | 'javascript'
    status: 'success' | 'error'
  } | null>(null)
  useEffect(() => {
    if (!guideCopyFeedback) return
    const timeout = window.setTimeout(() => setGuideCopyFeedback(null), COPY_FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [guideCopyFeedback])
  const [exportAnimationsOpen, setExportAnimationsOpen] = useState(false)
  const {
    activateAvatar,
    activeAvatar,
    activeAvatarEyes,
    activeAvatarId,
    activeExpression,
    activeSequence,
    activeSequenceLabel,
    activeState,
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
    commitAvatarMove,
    commitExpressionMove,
    commitStateMove,
    copyAvatarRuntimeDefinition,
    createNewAvatar,
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
    language,
    launchSequence,
    linked,
    mode,
    openExpressionEditor,
    openPhotoMode,
    openSequenceEditor,
    pauseState,
    photoPanelSections,
    photoTool,
    playbackStatus,
    playbackVisual,
    prepareStudioProjectImport,
    previewAvatarMove,
    previewExpressionDraft,
    previewExpressionMove,
    previewStateMove,
    projectImportError,
    projectImportRef,
    reduceMotion,
    renameActiveAvatar,
    runtimeDefinitionResult,
    runtimeCopyStatus,
    runtimeExportErrors,
    saveAvatarEditing,
    saveEditing,
    saveSequenceEditing,
    selectedExportAnimations,
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
    setExportAnimationIds,
    setExportFormat,
    setFocusAvatarName,
    setLinked,
    setLanguage,
    setMode,
    setPhotoPanelSections,
    setPhotoTool,
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
    updateSize,
    updateSpacing,
    updateSurface,
    updateWireVisibility,
    workspaceBackButtonRef,
  } = controller

  const copyRuntimeGuide = async () => {
    if (!navigator.clipboard) {
      setGuideCopyFeedback({ format: exportFormat, status: 'error' })
      return
    }
    try {
      await navigator.clipboard.writeText(
        buildRuntimeGuideText({
          animationKey: runtimePreviewAnimation,
          integration: exportFormat,
          t,
        })
      )
      setGuideCopyFeedback({ format: exportFormat, status: 'success' })
    } catch {
      setGuideCopyFeedback({ format: exportFormat, status: 'error' })
    }
  }
  const runtimePreviewAnimation = runtimeDefinitionResult.ok
    ? runtimeDefinitionResult.value.animationOrder[0]
    : undefined
  const guideCopyStatus =
    guideCopyFeedback?.format === exportFormat ? guideCopyFeedback.status : 'idle'
  const updateSnapshotComposition = (patch: Partial<typeof snapshotComposition>) =>
    setSnapshotComposition(current => ({ ...current, ...patch }))
  const playbackFooterY = useMotionValue(0)
  const playbackHandleY = useMotionValue(0)
  const playbackHandleCounterY = useTransform(playbackHandleY, value => -value)
  const playbackFooterDragOriginY = useRef(0)
  const playbackDetailsRef = useRef<HTMLDivElement>(null)
  const measuredSequenceIdRef = useRef<string | null>(null)
  const [playbackFooterCollapsedOffset, setPlaybackFooterCollapsedOffset] = useState(0)
  const playbackDetailsOpacity = useTransform(
    playbackFooterY,
    [0, Math.max(playbackFooterCollapsedOffset, 1)],
    [1, 0]
  )

  useLayoutEffect(() => {
    const details = playbackDetailsRef.current
    if (!details || !activeSequence) return

    const measure = () => {
      const nextOffset = details.getBoundingClientRect().height
      if (nextOffset <= 0) return

      const firstMeasurement = measuredSequenceIdRef.current !== activeSequence.id
      if (firstMeasurement) {
        measuredSequenceIdRef.current = activeSequence.id
        playbackFooterY.set(statePlayerExpanded ? 0 : nextOffset)
      } else if (
        playbackFooterCollapsedOffset > 0 &&
        Math.abs(nextOffset - playbackFooterCollapsedOffset) > 0.5
      ) {
        const progress = Math.min(
          1,
          Math.max(0, playbackFooterY.get() / playbackFooterCollapsedOffset)
        )
        playbackFooterY.set(progress * nextOffset)
      }
      setPlaybackFooterCollapsedOffset(nextOffset)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(details)
    return () => observer.disconnect()
  }, [
    activeSequence,
    language,
    playbackFooterCollapsedOffset,
    playbackFooterY,
    statePlayerExpanded,
  ])

  const snapPlaybackFooter = (expanded: boolean) => {
    setStatePlayerExpanded(expanded)
    animate(playbackFooterY, expanded ? 0 : playbackFooterCollapsedOffset, {
      type: 'spring',
      stiffness: 440,
      damping: 40,
      duration: reduceMotion ? 0 : undefined,
    })
  }
  return (
    <Drawer>
      <main
        className={`inspector ${editing ? 'expression-workspace-active' : sequenceEditing ? 'sequence-workspace-active' : bodyEditing ? 'body-workspace' : 'studio-workspace'}${activeSequence && !editorPageOpen && mode !== 'photo' ? ' state-player-active' : ''}${mode === 'photo' ? ' photo-inspector-active' : ''}`}
      >
        <StudioIdentity
          className="inspector-identity"
          language={language}
          setLanguage={setLanguage}
          t={t}
        />
        {sequenceEditing && !editing && (
          <motion.div
            key={`sequence-${sequenceEditing.sourceId ?? 'new'}`}
            className="workspace-page sequence-workspace"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SequenceWorkspace
              editing={sequenceEditing}
              expressions={expressions}
              surface={surface}
              bodyNodes={bodyNodes}
              colors={activeAvatar.colors}
              avatarEyes={activeAvatarEyes}
              renderStyle={activeAvatar.renderStyle}
              selectedStepId={selectedSequenceStepId}
              backButtonRef={workspaceBackButtonRef}
              reduceMotion={Boolean(reduceMotion)}
              onSelectedStepChange={setSelectedSequenceStepId}
              onChange={draft =>
                setSequenceEditing(current => (current ? { ...current, draft } : current))
              }
              onPreviewStep={step => {
                const expressionIndex = findExpressionIndex(expressions, step.expressionId)
                const preset = expressions[expressionIndex]
                if (preset) transitionToExpression(preset, expressionIndex, step)
              }}
              onEditExpression={openExpressionEditor}
              onPlay={() => launchSequence(sequenceEditing.draft, false, false)}
              onPause={() => pauseState(false)}
              onStop={() => stopState(false)}
              playing={statePlaying}
              active={activeState === sequenceEditing.draft.id}
              onCancel={cancelSequenceEditing}
              onSave={saveSequenceEditing}
              onDuplicate={duplicateSequenceEditing}
              onDelete={() => setDeleteSequenceOpen(true)}
              semanticKeyError={animationSemanticKeyError(sequenceEditing.draft)}
            />
          </motion.div>
        )}
        {editing && (
          <motion.div
            key={`expression-${editing.index ?? 'new'}`}
            className="workspace-page expression-workspace"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <ExpressionWorkspace
              editing={editing}
              avatarColors={activeAvatar.colors}
              backButtonRef={workspaceBackButtonRef}
              onChange={previewExpressionDraft}
              onCancel={cancelExpressionEditing}
              onSave={saveEditing}
              onDuplicate={() => duplicateExpression(editing.index, editing.draft, true)}
              onDelete={() => setDeleteExpressionOpen(true)}
              semanticKeyError={expressionSemanticKeyError(editing.draft)}
            />
          </motion.div>
        )}
        {!sequenceEditing &&
          !editing &&
          (bodyEditing ? (
            <header className="workspace-header body-workspace-header">
              <Button
                ref={workspaceBackButtonRef}
                variant="ghost"
                size="icon"
                onClick={cancelAvatarEditing}
                aria-label={t('Retour au studio')}
              >
                <ArrowLeft />
              </Button>
              <div className="workspace-heading">
                <p className="eyebrow">{t('Construction du corps')}</p>
                <Input
                  className="avatar-name-input"
                  aria-label={t('Nom de l’avatar')}
                  autoFocus={focusAvatarName}
                  value={activeAvatar.name}
                  onChange={event => renameActiveAvatar(event.currentTarget.value)}
                  onFocus={event => {
                    if (focusAvatarName) event.currentTarget.select()
                  }}
                  onBlur={event => {
                    if (!event.currentTarget.value.trim()) renameActiveAvatar('Unknown')
                    setFocusAvatarName(false)
                  }}
                />
                <p>
                  {t('Choisis la forme principale puis assemble les primitives autour d’elle.')}
                </p>
              </div>
            </header>
          ) : null)}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="mode-page-transition"
            key={mode}
            initial={reduceMotion ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -18 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {!editorPageOpen && (
              <header className="mode-page-header">
                <div>
                  <p className="eyebrow">{activeAvatar.name}</p>
                  <h1>
                    {t(
                      mode === 'manual'
                        ? 'Pose'
                        : mode === 'avatars'
                          ? 'Avatars'
                          : mode === 'expressions'
                            ? 'Expressions'
                            : mode === 'states'
                              ? 'Animations'
                              : mode === 'photo'
                                ? 'Mode photo'
                                : 'Exporter'
                    )}
                  </h1>
                </div>
                {mode === 'manual' && (
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label={t('Réinitialiser')}
                    onClick={() => transitionToExpression({ ...defaultExpression })}
                  >
                    <RotateCcw />
                  </Button>
                )}
                {mode === 'photo' && (
                  <Button variant="outline" type="button" onClick={() => setMode('export')}>
                    <ArrowLeft />
                    {t('Quitter')}
                  </Button>
                )}
              </header>
            )}

            {!editing && mode === 'manual' && (
              <div className="panel-stack">
                {bodyEditing && (
                  <>
                    <ControlSection
                      title="Corps"
                      subtitle="Construction, forme et couleur de la tête de l’avatar."
                    >
                      <BodyConstructionAccordion
                        controller={controller}
                        reduceMotion={Boolean(reduceMotion)}
                      />
                      <InspectorCard className="color-panel">
                        <PanelTitle
                          level={3}
                          title="Couleur du corps"
                          subtitle="Couleur de base utilisée par les poses et les expressions."
                        />
                        <ColorField
                          label="Corps"
                          value={activeAvatar.colors.body}
                          onChange={body => updateAvatarColors({ body })}
                        />
                      </InspectorCard>
                    </ControlSection>
                    <ControlSection
                      title="Rendu"
                      subtitle="Le rendu Pixel est temporairement désactivé."
                    >
                      <InspectorCard className="render-style-panel render-style-disabled">
                        <PanelTitle
                          level={3}
                          title="Type de rendu"
                          subtitle="Le mode Vectoriel est utilisé pour l’instant."
                        />
                        <div className="render-style-status">
                          <Badge variant="secondary">{t('Vectoriel')}</Badge>
                        </div>
                      </InspectorCard>
                    </ControlSection>
                    <ControlSection
                      title="Yeux"
                      subtitle="Forme, placement, orientation et couleur du regard par défaut."
                    >
                      <p className="section-description">
                        {t(
                          'Définis l’identité du regard de cet avatar. Les poses s’ajoutent ensuite à cette base.'
                        )}
                      </p>
                      {(['width', 'height', 'size'] as const).map(dimension => (
                        <InspectorCard className="compact" key={`avatar-${dimension}`}>
                          <div className="panel-inline-title">
                            <h3>
                              {t(
                                {
                                  width: 'Largeur',
                                  height: 'Hauteur',
                                  size: 'Taille proportionnelle',
                                }[dimension]
                              )}
                            </h3>
                            <LinkButton
                              linked={linked[dimension]}
                              label={`Lier ${dimension}`}
                              onClick={() =>
                                setLinked(current => ({
                                  ...current,
                                  [dimension]: !current[dimension],
                                }))
                              }
                            />
                          </div>
                          <div className="eye-columns">
                            {(['Left', 'Right'] as Side[]).map(side => {
                              const width = activeAvatarEyes[`width${side}`]
                              const height = activeAvatarEyes[`height${side}`]
                              const value =
                                dimension === 'width'
                                  ? width
                                  : dimension === 'height'
                                    ? height
                                    : Math.max(width, height)
                              return (
                                <NumericField
                                  key={side}
                                  label={side === 'Left' ? 'Œil gauche' : 'Œil droit'}
                                  value={value}
                                  min={10}
                                  max={dimension === 'size' ? 110 : 100}
                                  unit="u"
                                  onActiveChange={active =>
                                    updateHighlight(
                                      active
                                        ? linked[dimension]
                                          ? 'both'
                                          : side === 'Left'
                                            ? 'left'
                                            : 'right'
                                        : null
                                    )
                                  }
                                  onChange={next =>
                                    dimension === 'size'
                                      ? updateAvatarEyeSize(side, next)
                                      : updateAvatarEyeDimension(side, dimension, next)
                                  }
                                />
                              )
                            })}
                          </div>
                        </InspectorCard>
                      ))}
                      <InspectorCard>
                        <div className="panel-inline-title">
                          <div>
                            <h3>{t('Position et espacement')}</h3>
                            <p className="panel-inline-subtitle">
                              {t('Coordonnées propres à l’avatar, indépendantes des poses.')}
                            </p>
                          </div>
                          <LinkButton
                            linked={linked.position}
                            label="Lier la position des yeux"
                            onClick={() =>
                              setLinked(current => ({ ...current, position: !current.position }))
                            }
                          />
                        </div>
                        <div className="eye-columns">
                          {(['Left', 'Right'] as Side[]).map(side => (
                            <div className="eye-column" key={side}>
                              <h3>{t(side === 'Left' ? 'Œil gauche' : 'Œil droit')}</h3>
                              <NumericField
                                label="Horizontale"
                                value={activeAvatarEyes[`positionX${side}`]}
                                unit="u"
                                onActiveChange={active =>
                                  updateHighlight(
                                    active
                                      ? linked.position
                                        ? 'both'
                                        : side === 'Left'
                                          ? 'left'
                                          : 'right'
                                      : null
                                  )
                                }
                                onChange={value => updateAvatarEyePosition(side, 'X', value)}
                              />
                              <NumericField
                                label="Verticale"
                                value={activeAvatarEyes[`positionY${side}`]}
                                unit="u"
                                onActiveChange={active =>
                                  updateHighlight(
                                    active
                                      ? linked.position
                                        ? 'both'
                                        : side === 'Left'
                                          ? 'left'
                                          : 'right'
                                      : null
                                  )
                                }
                                onChange={value => updateAvatarEyePosition(side, 'Y', value)}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="position-spacing">
                          <NumericField
                            label="Espacement"
                            value={activeAvatarEyes.spacing}
                            min={0}
                            max={150}
                            unit="u"
                            onActiveChange={active => updateHighlight(active ? 'both' : null)}
                            onChange={spacing => updateAvatarEyes({ spacing })}
                          />
                        </div>
                      </InspectorCard>
                      <InspectorCard>
                        <div className="panel-inline-title">
                          <PanelTitle
                            level={3}
                            title="Rotation locale"
                            subtitle="Inclinaison par défaut propre à chaque œil."
                          />
                          <LinkButton
                            linked={linked.rotation}
                            label="Lier les rotations"
                            onClick={() =>
                              setLinked(current => ({ ...current, rotation: !current.rotation }))
                            }
                          />
                        </div>
                        <div className="eye-columns">
                          <NumericField
                            label="Œil gauche"
                            value={activeAvatarEyes.leftAngle}
                            unit="°"
                            onActiveChange={active =>
                              updateHighlight(active ? (linked.rotation ? 'both' : 'left') : null)
                            }
                            onChange={leftAngle =>
                              updateAvatarEyes({
                                leftAngle,
                                ...(linked.rotation ? { rightAngle: -leftAngle } : {}),
                              })
                            }
                          />
                          <NumericField
                            label="Œil droit"
                            value={activeAvatarEyes.rightAngle}
                            unit="°"
                            onActiveChange={active =>
                              updateHighlight(active ? (linked.rotation ? 'both' : 'right') : null)
                            }
                            onChange={rightAngle =>
                              updateAvatarEyes({
                                rightAngle,
                                ...(linked.rotation ? { leftAngle: -rightAngle } : {}),
                              })
                            }
                          />
                        </div>
                      </InspectorCard>
                      <InspectorCard className="color-panel">
                        <PanelTitle
                          level={3}
                          title="Couleur des yeux"
                          subtitle="Couleur de base utilisée par les poses et les expressions."
                        />
                        <ColorField
                          label="Yeux"
                          value={activeAvatar.colors.eyes}
                          onChange={eyes => updateAvatarColors({ eyes })}
                        />
                      </InspectorCard>
                    </ControlSection>
                  </>
                )}
                {!bodyEditing && <PoseControls controller={controller} />}
              </div>
            )}
            {!editorPageOpen && mode === 'avatars' && <AvatarPage controller={controller} />}

            {!sequenceEditing && !editing && bodyEditing && (
              <footer className="workspace-footer">
                <div className="workspace-footer-secondary">
                  <Button
                    variant="destructive"
                    disabled={avatars.length <= 1}
                    onClick={() => setDeleteAvatarOpen(true)}
                  >
                    <Trash2 />
                    {t('Supprimer')}
                  </Button>
                  <Button variant="outline" onClick={() => duplicateAvatar(activeAvatar, true)}>
                    <Copy />
                    {t('Dupliquer')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!runtimeDefinitionResult.ok}
                    // downloadAvatarRuntimeDefinition is a no-op on an invalid
                    // definition, so surface why the button is dead.
                    title={runtimeExportErrors[0] ?? undefined}
                    onClick={downloadAvatarRuntimeDefinition}
                  >
                    <Download />
                    {t('Exporter')}
                  </Button>
                </div>
                <Button onClick={saveAvatarEditing}>{t('Enregistrer')}</Button>
              </footer>
            )}

            {!sequenceEditing && !editing && !bodyEditing && mode === 'expressions' && (
              <div className="panel-stack">
                <InspectorCard>
                  <div className="preset-header">
                    <div>
                      <p className="eyebrow">{expressions.length} presets</p>
                    </div>
                    <span>{t('Double-clic pour modifier')}</span>
                  </div>
                  <div className="expression-grid">
                    {expressions.map((preset, index) => (
                      <motion.div
                        className="expression-sort-item"
                        data-dragging={draggingExpressionId === preset.id || undefined}
                        key={preset.id}
                        layout="position"
                        layoutId={`expression-${preset.id}`}
                        animate={{
                          opacity: draggingExpressionId === preset.id ? 0.28 : 1,
                          scale: draggingExpressionId === preset.id ? 0.96 : 1,
                        }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
                        }
                      >
                        <ExpressionCard
                          expression={preset}
                          index={index}
                          active={activeExpression === index}
                          surface={surface}
                          bodyNodes={bodyNodes}
                          colors={activeAvatar.colors}
                          avatarEyes={activeAvatarEyes}
                          renderStyle={activeAvatar.renderStyle}
                          previewId={String(index)}
                          onSelect={() => transitionToExpression(preset, index)}
                          onEdit={() => openExpressionEditor(index, preset)}
                          onDuplicate={() => duplicateExpression(index, preset)}
                          onDelete={() => {
                            openExpressionEditor(index, preset)
                            setDeleteExpressionOpen(true)
                          }}
                          runtimeError={expressionSemanticKeyError(preset)}
                          draggable
                          onDragStart={event => {
                            expressionDragOrigin.current = expressions
                            expressionDragPreview.current = expressions
                            draggedExpressionId.current = preset.id
                            setDraggingExpressionId(preset.id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnter={() => previewExpressionMove(preset.id)}
                          onDragOver={event => {
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                          }}
                          onDrop={event => {
                            event.preventDefault()
                            commitExpressionMove(preset.id)
                          }}
                          onDragEnd={cancelExpressionMove}
                        />
                      </motion.div>
                    ))}
                    <Button
                      className="expression-add creation-card"
                      variant="outline"
                      type="button"
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => {
                        event.preventDefault()
                        commitExpressionMove(null)
                      }}
                      onClick={() => openExpressionEditor(null, expression)}
                      aria-label={t('Nouvelle expression')}
                    >
                      <Plus />
                    </Button>
                  </div>
                </InspectorCard>
                <InspectorCard>
                  <PanelTitle
                    title="Mouvement"
                    subtitle="Motion interpole les valeurs et notre moteur effectue le slerp quaternion."
                  />
                  <NumericField
                    label="Vitesse du ressort"
                    value={springSpeed}
                    step={0.5}
                    onChange={value => {
                      springSpeedRef.current = value
                      setSpringSpeed(value)
                    }}
                  />
                  <div className="button-row">
                    <Button variant="outline" type="button" onClick={() => blink()}>
                      {t('Cligner')}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const index = Math.floor(Math.random() * expressions.length)
                        transitionToExpression(expressions[index], index)
                      }}
                    >
                      {t('Expression aléatoire')}
                    </Button>
                  </div>
                </InspectorCard>
              </div>
            )}

            {!sequenceEditing && !editing && !bodyEditing && mode === 'states' && (
              <div className="panel-stack">
                <InspectorCard>
                  <div className="preset-header">
                    <div>
                      <p className="eyebrow">
                        {sequences.length} {t('animations')}
                      </p>
                    </div>
                  </div>
                  <div className="state-groups">
                    {groupSequences(sequences).map(group => (
                      <div
                        key={group.name}
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => {
                          event.preventDefault()
                          commitStateMove(null, group.name)
                        }}
                      >
                        <strong>
                          {group.sequences.every(sequence => sequence.builtIn)
                            ? t(group.name)
                            : group.name}
                        </strong>
                        <div className="state-buttons">
                          {group.sequences.map(sequence => {
                            const firstStep = sequence.steps[0]
                            const firstExpression = firstStep
                              ? expressionById.get(firstStep.expressionId)
                              : undefined
                            const card = (
                              <Button
                                className="expression-card state-card"
                                variant="outline"
                                type="button"
                                draggable
                                aria-pressed={selectedState === sequence.id}
                                onDragStart={event => {
                                  stateDragOrigin.current = sequences
                                  stateDragPreview.current = sequences
                                  draggedStateId.current = sequence.id
                                  setDraggingStateId(sequence.id)
                                  event.dataTransfer.effectAllowed = 'move'
                                }}
                                onDragEnter={() => previewStateMove(sequence.id, group.name)}
                                onDragOver={event => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  event.dataTransfer.dropEffect = 'move'
                                }}
                                onDrop={event => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  commitStateMove(sequence.id, group.name)
                                }}
                                onDragEnd={cancelStateMove}
                                onClick={() => launchSequence(sequence)}
                                onDoubleClick={() => openSequenceEditor(sequence)}
                              >
                                <ExpressionPreview
                                  expression={
                                    firstExpression ?? expressions[0] ?? defaultExpression
                                  }
                                  surface={surface}
                                  bodyNodes={bodyNodes}
                                  colors={activeAvatar.colors}
                                  avatarEyes={activeAvatarEyes}
                                  renderStyle={activeAvatar.renderStyle}
                                  id={`state-card-${sequence.id}`}
                                />
                                {animationSemanticKeyError(sequence) && (
                                  <i
                                    className="runtime-key-missing"
                                    role="img"
                                    aria-label={animationSemanticKeyError(sequence) ?? undefined}
                                    title={animationSemanticKeyError(sequence) ?? undefined}
                                  >
                                    !
                                  </i>
                                )}
                                <span>{sequence.builtIn ? t(sequence.name) : sequence.name}</span>
                              </Button>
                            )
                            return (
                              <motion.div
                                className="state-sort-item"
                                data-dragging={draggingStateId === sequence.id || undefined}
                                key={sequence.id}
                                layout="position"
                                layoutId={`state-${sequence.id}`}
                                animate={{
                                  opacity: draggingStateId === sequence.id ? 0.28 : 1,
                                  scale: draggingStateId === sequence.id ? 0.96 : 1,
                                }}
                                transition={
                                  reduceMotion
                                    ? { duration: 0 }
                                    : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
                                }
                              >
                                <ContextMenu>
                                  <ContextMenuTrigger render={card} />
                                  <ContextMenuContent>
                                    <ContextMenuItem onClick={() => openSequenceEditor(sequence)}>
                                      <Pencil />
                                      {t('Modifier')}
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => duplicateState(sequence)}>
                                      <Copy />
                                      {t('Dupliquer')}
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      variant="destructive"
                                      onClick={() => {
                                        openSequenceEditor(sequence)
                                        setDeleteSequenceOpen(true)
                                      }}
                                    >
                                      <Trash2 />
                                      {t('Supprimer')}
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="state-buttons">
                      <Button
                        className="expression-add creation-card"
                        variant="outline"
                        type="button"
                        onClick={() => openSequenceEditor()}
                        aria-label={t('Nouvelle animation')}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                </InspectorCard>
              </div>
            )}

            {!sequenceEditing && !editing && !bodyEditing && mode === 'photo' && (
              <div className="panel-stack photo-panel-stack">
                <Accordion
                  className="photo-tool-accordion"
                  multiple
                  value={photoPanelSections}
                  onValueChange={nextSections => {
                    const sections = nextSections as typeof photoPanelSections
                    const currentSections = new Set(photoPanelSections)
                    const openedSection = sections.find(section => !currentSections.has(section))
                    setPhotoPanelSections(sections)
                    if (openedSection) setPhotoTool(openedSection)
                  }}
                >
                  <AccordionItem
                    className="photo-tool-accordion-item"
                    value="pose"
                    data-active-tool={photoTool === 'pose' || undefined}
                  >
                    <AccordionTrigger className="photo-tool-accordion-trigger">
                      <span className="photo-tool-accordion-heading">
                        <span className="photo-tool-accordion-icon" aria-hidden="true">
                          <Move3D />
                        </span>
                        <span>
                          <strong>{t('Pose')}</strong>
                          <small>{t('Orientation, regard, couleurs et perspective.')}</small>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="photo-tool-accordion-content">
                      <PoseControls controller={controller} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    className="photo-tool-accordion-item"
                    value="frame"
                    data-active-tool={photoTool === 'frame' || undefined}
                  >
                    <AccordionTrigger className="photo-tool-accordion-trigger">
                      <span className="photo-tool-accordion-heading">
                        <span className="photo-tool-accordion-icon" aria-hidden="true">
                          <Scan />
                        </span>
                        <span>
                          <strong>{t('Cadrage')}</strong>
                          <small>{t('Position, zoom et coins du cadre photo.')}</small>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="photo-tool-accordion-content">
                      <div className="photo-frame-settings">
                        <div className="snapshot-composition-fields">
                          <NumericField
                            label="Position X"
                            value={snapshotComposition.x}
                            min={-180}
                            max={180}
                            step={1}
                            onChange={x => updateSnapshotComposition({ x })}
                          />
                          <NumericField
                            label="Position Y"
                            value={snapshotComposition.y}
                            min={-180}
                            max={180}
                            step={1}
                            onChange={y => updateSnapshotComposition({ y })}
                          />
                          <NumericField
                            label="Zoom"
                            value={snapshotComposition.scale * 100}
                            min={40}
                            max={300}
                            step={1}
                            unit="%"
                            onChange={zoom => updateSnapshotComposition({ scale: zoom / 100 })}
                          />
                          <NumericField
                            label="Coins arrondis"
                            value={snapshotComposition.cornerRadius}
                            min={0}
                            max={50}
                            step={1}
                            unit="%"
                            onChange={cornerRadius => updateSnapshotComposition({ cornerRadius })}
                          />
                        </div>
                        <Button
                          className="photo-reset-frame"
                          variant="outline"
                          type="button"
                          onClick={() =>
                            setSnapshotComposition(current => ({
                              ...current,
                              x: 0,
                              y: 0,
                              scale: 1,
                            }))
                          }
                        >
                          <RotateCcw />
                          {t('Recentrer le cadrage')}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <InspectorCard className="photo-expression-card">
                  <PanelTitle
                    title="Expression"
                    subtitle="Choisis l’expression visible sur la photo."
                  />
                  <div className="expression-grid photo-expression-grid">
                    {expressions.map((preset, index) => (
                      <ExpressionCard
                        key={preset.id}
                        expression={preset}
                        index={index}
                        active={activeExpression === index}
                        surface={surface}
                        bodyNodes={bodyNodes}
                        colors={activeAvatar.colors}
                        avatarEyes={activeAvatarEyes}
                        renderStyle={activeAvatar.renderStyle}
                        previewId={`photo-${preset.id}`}
                        onSelect={() => transitionToExpression(preset, index)}
                        runtimeError={expressionSemanticKeyError(preset)}
                      />
                    ))}
                  </div>
                </InspectorCard>

                <InspectorCard>
                  <PanelTitle
                    title="Arrière-plan"
                    subtitle="Choisis un fond transparent, uni ou en dégradé."
                  />
                  <Field className="snapshot-background-field" orientation="horizontal">
                    <FieldTitle>{t('Style')}</FieldTitle>
                    <Select
                      value={snapshotBackground}
                      items={[
                        { value: 'transparent', label: t('Transparent') },
                        { value: 'solid', label: t('Uni') },
                        { value: 'linear', label: t('Dégradé linéaire') },
                        { value: 'radial', label: t('Dégradé radial') },
                      ]}
                      onValueChange={next =>
                        next && setSnapshotBackground(next as SnapshotBackground)
                      }
                    >
                      <SelectTrigger aria-label={t('Style d’arrière-plan')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transparent">{t('Transparent')}</SelectItem>
                        <SelectItem value="solid">{t('Uni')}</SelectItem>
                        <SelectItem value="linear">{t('Dégradé linéaire')}</SelectItem>
                        <SelectItem value="radial">{t('Dégradé radial')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      className="snapshot-random-button"
                      variant="ghost"
                      size="sm"
                      type="button"
                      disabled={snapshotBackground === 'transparent'}
                      onClick={() => {
                        if (snapshotBackground === 'transparent') return
                        const palette = randomSnapshotPalette(
                          snapshotBackground,
                          expression.bodyColor ?? activeAvatar.colors.body,
                          { colorFrom: snapshotColorFrom, colorTo: snapshotColorTo }
                        )
                        setSnapshotColorFrom(palette.colorFrom)
                        setSnapshotColorTo(palette.colorTo)
                      }}
                    >
                      <Shuffle />
                      {t('Aléatoire')}
                    </Button>
                  </Field>
                  {snapshotBackground !== 'transparent' && (
                    <div className="snapshot-colors">
                      <ColorField
                        label={snapshotBackground === 'solid' ? 'Couleur' : 'Départ'}
                        value={snapshotColorFrom}
                        onChange={setSnapshotColorFrom}
                      />
                      {(snapshotBackground === 'linear' || snapshotBackground === 'radial') && (
                        <ColorField
                          label="Arrivée"
                          value={snapshotColorTo}
                          onChange={setSnapshotColorTo}
                        />
                      )}
                    </div>
                  )}
                </InspectorCard>

                <InspectorCard>
                  <Field className="snapshot-background-field" orientation="horizontal">
                    <div>
                      <FieldTitle>{t('Format d’export')}</FieldTitle>
                      <small>{t('Choisis le type de fichier généré par le mode photo.')}</small>
                    </div>
                    <Select
                      value={snapshotFormat}
                      items={[
                        { value: 'png', label: 'PNG' },
                        { value: 'svg', label: 'SVG' },
                      ]}
                      onValueChange={next => next && setSnapshotFormat(next as SnapshotFormat)}
                    >
                      <SelectTrigger aria-label={t('Format d’export du mode photo')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="svg">SVG</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Separator className="snapshot-settings-separator" />
                  <Field className="snapshot-background-field" orientation="horizontal">
                    <div>
                      <FieldTitle>{t('Définition')}</FieldTitle>
                      <small>{t('Dimensions du fichier exporté.')}</small>
                    </div>
                    <Select
                      value={snapshotSize}
                      items={['512', '1024', '2048'].map(value => ({
                        value,
                        label: `${value} px`,
                      }))}
                      onValueChange={next => next && setSnapshotSize(next)}
                    >
                      <SelectTrigger aria-label={t('Définition du mode photo')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512 px</SelectItem>
                        <SelectItem value="1024">1024 px</SelectItem>
                        <SelectItem value="2048">2048 px</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </InspectorCard>

                <Button className="snapshot-export-button" type="button" onClick={takePicture}>
                  <Camera />
                  {t('Prendre une photo')}
                  <span>{snapshotFormat.toUpperCase()}</span>
                </Button>
              </div>
            )}

            {!sequenceEditing && !editing && !bodyEditing && mode === 'export' && (
              <Accordion className="export-panel" defaultValue={['avatar']}>
                <ExportSection
                  value="avatar"
                  title="Exporter l’avatar"
                  subtitle="Choisis les animations puis utilise la même définition JSON avec React ou JavaScript."
                >
                  <InspectorCard>
                    <div className="export-avatar-summary">
                      <ExpressionPreview
                        expression={expressions[0] ?? defaultExpression}
                        surface={activeAvatar.body.primary}
                        bodyNodes={activeAvatar.body.nodes}
                        colors={activeAvatar.colors}
                        avatarEyes={activeAvatarEyes}
                        renderStyle={activeAvatar.renderStyle}
                        id={`export-avatar-${activeAvatar.id}`}
                      />
                      <div>
                        <small>{t('Avatar sélectionné')}</small>
                        <strong>{activeAvatar.name}</strong>
                      </div>
                    </div>
                  </InspectorCard>

                  <section className="export-format-section" aria-label={t('Format')}>
                    <PanelTitle
                      title="Format"
                      subtitle="Choisis l’intégration correspondant à ton projet."
                    />
                    <div className="export-format-grid">
                      <Button
                        variant="outline"
                        type="button"
                        aria-pressed={exportFormat === 'react'}
                        onClick={() => setExportFormat('react')}
                      >
                        <FileCode2 />
                        <span>
                          <strong>React / TypeScript</strong>
                          <small>{t('JSON runtime + createAvatar')}</small>
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        aria-pressed={exportFormat === 'javascript'}
                        onClick={() => setExportFormat('javascript')}
                      >
                        <FileCode2 />
                        <span>
                          <strong>{t('JavaScript / ESM')}</strong>
                          <small>{t('JSON runtime + avatar-web')}</small>
                        </span>
                      </Button>
                    </div>
                  </section>

                  <InspectorCard>
                    <div className="preset-header export-animation-header">
                      <div>
                        <p className="eyebrow">
                          {selectedExportAnimations.length}/{sequences.length} {t('sélectionnées')}
                        </p>
                        <h2>{t('Animations à exporter')}</h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        aria-expanded={exportAnimationsOpen}
                        onClick={() => setExportAnimationsOpen(open => !open)}
                      >
                        {exportAnimationsOpen ? <ChevronUp /> : <ChevronDown />}
                        {t(exportAnimationsOpen ? 'Masquer la sélection' : 'Personnaliser')}
                      </Button>
                    </div>
                    {exportAnimationsOpen && (
                      <div className="export-animation-picker">
                        <Button
                          className="export-animation-select-all"
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() =>
                            setExportAnimationIds(
                              selectedExportAnimations.length === sequences.length
                                ? []
                                : sequences.map(animation => animation.id)
                            )
                          }
                        >
                          {t(
                            selectedExportAnimations.length === sequences.length
                              ? 'Tout désélectionner'
                              : 'Tout sélectionner'
                          )}
                        </Button>
                        <div className="state-buttons export-animation-grid">
                          {sequences.map(animation => {
                            const firstStep = animation.steps[0]
                            const firstExpression = firstStep
                              ? expressionById.get(firstStep.expressionId)
                              : undefined
                            return (
                              <Button
                                className="expression-card state-card"
                                variant="outline"
                                type="button"
                                key={animation.id}
                                aria-pressed={exportAnimationIdSet.has(animation.id)}
                                onClick={() => toggleExportAnimation(animation.id)}
                              >
                                <ExpressionPreview
                                  expression={
                                    firstExpression ?? expressions[0] ?? defaultExpression
                                  }
                                  surface={surface}
                                  bodyNodes={bodyNodes}
                                  colors={activeAvatar.colors}
                                  avatarEyes={activeAvatarEyes}
                                  renderStyle={activeAvatar.renderStyle}
                                  id={`export-animation-${animation.id}`}
                                />
                                <span>
                                  {animation.builtIn ? t(animation.name) : animation.name}
                                </span>
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </InspectorCard>

                  {runtimeExportErrors.length > 0 && (
                    <InspectorCard>
                      <div className="runtime-export-error" role="alert">
                        <div className="runtime-export-error-heading">
                          <TriangleAlert />
                          <strong>{t('Export runtime incomplet')}</strong>
                        </div>
                        <ul className="runtime-error-list">
                          {runtimeExportErrors.map((error, index) => (
                            <li key={`${index}-${error}`}>{error}</li>
                          ))}
                        </ul>
                        <p className="runtime-export-error-help">
                          {t(
                            'Corrige les clés signalées dans les éditeurs Expressions ou Animations.'
                          )}
                        </p>
                        <div className="runtime-export-error-actions">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setMode('expressions')}
                          >
                            {t('Expressions')}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setMode('states')}>
                            {t('Animations')}
                          </Button>
                        </div>
                      </div>
                    </InspectorCard>
                  )}

                  <InspectorCard className="runtime-quick-start-card">
                    <div className="runtime-quick-start-heading">
                      <div>
                        <p className="eyebrow">{t('Démarrage rapide')}</p>
                      </div>
                    </div>
                    <div className="runtime-quick-start-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={
                          guideCopyStatus === 'success'
                            ? t('Guide d’utilisation copié dans le presse-papiers.')
                            : guideCopyStatus === 'error'
                              ? t('Impossible de copier le guide d’utilisation.')
                              : undefined
                        }
                        onClick={() => void copyRuntimeGuide()}
                      >
                        {guideCopyStatus === 'success' ? <Check /> : <Copy />}
                        {t('Copier les instructions pour l’IA')}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setGuideOpen(true)}>
                        {t('Voir le guide complet')}
                        <ArrowRight />
                      </Button>
                    </div>

                    <div className="runtime-quick-start-step">
                      <span>{t('Installation')}</span>
                      <code>
                        <HighlightedRuntimeCode>
                          {exportFormat === 'react' ? reactQuickStartInstall : webQuickStartInstall}
                        </HighlightedRuntimeCode>
                      </code>
                    </div>

                    <div className="runtime-quick-start-step">
                      <span>{t('Utilisation minimale')}</span>
                      <pre tabIndex={0}>
                        <code>
                          <HighlightedRuntimeCode>
                            {exportFormat === 'react'
                              ? reactQuickStartExample(runtimePreviewAnimation)
                              : webQuickStartExample(runtimePreviewAnimation)}
                          </HighlightedRuntimeCode>
                        </code>
                      </pre>
                    </div>
                  </InspectorCard>

                  <InspectorCard className="runtime-export-card">
                    <div className="runtime-export-heading">
                      <div>
                        <small>{t('Prêt à exporter')}</small>
                        <strong>
                          {selectedExportAnimations.length} {t('animations')} ·{' '}
                          {runtimeDefinitionResult.ok
                            ? runtimeDefinitionResult.value.expressionOrder.length
                            : 0}{' '}
                          {t('expressions')}
                        </strong>
                      </div>
                      <p className="runtime-export-description">
                        {t(
                          exportFormat === 'javascript'
                            ? 'Le ZIP contient le JSON exporté, une démo index.html et son README. La démo charge avatar-web depuis un CDN.'
                            : 'Le ZIP contient le JSON exporté et un projet Vite React TypeScript prêt à lancer avec npm install puis npm run dev.'
                        )}
                      </p>
                    </div>

                    <div className="runtime-export-actions">
                      <Button
                        className="export-download"
                        type="button"
                        disabled={!runtimeDefinitionResult.ok}
                        onClick={downloadAvatarRuntimeDefinition}
                      >
                        <Download />
                        {t('Télécharger la définition .avatar.json')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!runtimeDefinitionResult.ok}
                        onClick={downloadAvatarExport}
                      >
                        <Download />
                        {t(
                          exportFormat === 'javascript'
                            ? 'Télécharger la démo ESM (.zip)'
                            : 'Télécharger la démo React (.zip)'
                        )}
                      </Button>
                      <div className="runtime-export-secondary-actions">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!runtimeDefinitionResult.ok}
                          onClick={() => setRuntimePreviewOpen(true)}
                        >
                          <Play />
                          {t('Preview')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!runtimeDefinitionResult.ok}
                          aria-label={
                            runtimeCopyStatus === 'success'
                              ? t('JSON runtime copié dans le presse-papiers.')
                              : runtimeCopyStatus === 'error'
                                ? t('Impossible de copier le JSON runtime.')
                                : undefined
                          }
                          onClick={() => void copyAvatarRuntimeDefinition()}
                        >
                          {runtimeCopyStatus === 'success' ? <Check /> : <Copy />}
                          {t('Copier le JSON')}
                        </Button>
                      </div>
                    </div>
                  </InspectorCard>
                  <RuntimePreviewDialog
                    definition={runtimeDefinitionResult.ok ? runtimeDefinitionResult.value : null}
                    initialAnimation={runtimePreviewAnimation}
                    open={runtimePreviewOpen}
                    onOpenChange={setRuntimePreviewOpen}
                  />
                  <RuntimeGuideDialog
                    animationKey={runtimePreviewAnimation}
                    integration={exportFormat}
                    open={guideOpen}
                    onOpenChange={setGuideOpen}
                  />
                </ExportSection>

                <ExportSection
                  value="snapshot"
                  title="Mode photo"
                  subtitle="Prépare une image statique directement dans l’aperçu principal."
                >
                  <InspectorCard className="photo-mode-launch-card">
                    <div className="photo-mode-launch-icon" aria-hidden="true">
                      <Camera />
                    </div>
                    <div>
                      <strong>{t('Composer dans le live preview')}</strong>
                      <p>
                        {t(
                          'Choisis une expression, ajuste la pose et cadre l’avatar dans un espace dédié.'
                        )}
                      </p>
                    </div>
                    <Button type="button" onClick={openPhotoMode}>
                      {t('Ouvrir le mode photo')}
                      <ArrowRight />
                    </Button>
                  </InspectorCard>
                </ExportSection>

                <ExportSection
                  value="project"
                  title="Projet du Studio"
                  subtitle="Transfère tous les avatars, expressions et animations vers un autre navigateur."
                >
                  <div className="project-transfer-actions">
                    <Button variant="outline" type="button" onClick={downloadStudioProject}>
                      <Download />
                      {t('Télécharger le projet JSON')}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => projectImportRef.current?.click()}
                    >
                      <Upload />
                      {t('Importer un projet JSON')}
                    </Button>
                    <input
                      ref={projectImportRef}
                      className="project-import-input"
                      type="file"
                      accept="application/json,.json"
                      aria-label={t('Importer un projet JSON')}
                      onChange={event => {
                        prepareStudioProjectImport(event.currentTarget.files?.[0])
                        event.currentTarget.value = ''
                      }}
                    />
                  </div>
                  {projectImportError && (
                    <p className="project-transfer-error" role="alert">
                      {projectImportError}
                    </p>
                  )}
                </ExportSection>
              </Accordion>
            )}
          </motion.div>
        </AnimatePresence>
        {activeSequence && !editorPageOpen && mode !== 'photo' && (
          <motion.footer
            className={`state-playback-footer${statePlayerExpanded ? ' is-expanded' : ''}`}
            style={{ y: playbackFooterY }}
          >
            <div className="state-playback-drag-handle-slot">
              <motion.div style={{ y: playbackHandleCounterY }}>
                <motion.button
                  className="state-playback-drag-handle"
                  style={{ y: playbackHandleY }}
                  type="button"
                  drag="y"
                  dragMomentum={false}
                  aria-expanded={statePlayerExpanded}
                  aria-label={t(
                    statePlayerExpanded
                      ? 'Masquer les détails de l’animation'
                      : 'Afficher les détails de l’animation'
                  )}
                  onTap={() => snapPlaybackFooter(!statePlayerExpanded)}
                  onDragStart={() => {
                    playbackFooterDragOriginY.current = playbackFooterY.get()
                  }}
                  onDrag={(_, info) => {
                    playbackFooterY.set(
                      Math.min(
                        playbackFooterCollapsedOffset,
                        Math.max(0, playbackFooterDragOriginY.current + info.offset.y)
                      )
                    )
                  }}
                  onDragEnd={(_, info) => {
                    playbackHandleY.set(0)
                    const projectedY = playbackFooterY.get() + info.velocity.y * 0.16
                    snapPlaybackFooter(projectedY < playbackFooterCollapsedOffset / 2)
                  }}
                >
                  <span />
                </motion.button>
              </motion.div>
            </div>
            <div className="state-playback-bar">
              <div className="state-playback-timeline">
                {activeSequence.steps.map((step, position) => {
                  const expressionIndex = findExpressionIndex(expressions, step.expressionId)
                  const preset = expressions[expressionIndex]
                  if (!preset) return null
                  return (
                    <Button
                      className="state-playback-step"
                      variant="outline"
                      type="button"
                      key={step.id}
                      aria-pressed={activeExpression === expressionIndex}
                      onClick={() => transitionToExpression(preset, expressionIndex, step)}
                    >
                      <ExpressionPreview
                        expression={preset}
                        surface={surface}
                        bodyNodes={bodyNodes}
                        colors={activeAvatar.colors}
                        avatarEyes={activeAvatarEyes}
                        renderStyle={activeAvatar.renderStyle}
                        id={`player-${activeSequence.id}-${position}`}
                      />
                      {playbackVisual.position === position && (
                        <span
                          className="state-playback-progress"
                          key={`${step.id}-${playbackVisual.run}`}
                          aria-hidden="true"
                          style={
                            {
                              animationDuration: `${Math.max(playbackVisual.durationMs, 1)}ms`,
                              animationPlayState: statePlaying ? 'running' : 'paused',
                            } as CSSProperties
                          }
                        />
                      )}
                    </Button>
                  )
                })}
              </div>
              <div className="state-playback-controls">
                <StatePlayer
                  name={activeSequenceLabel}
                  status={playbackStatus}
                  onToggle={toggleStatePlayback}
                  onStop={stopState}
                />
              </div>
            </div>
            <motion.div
              ref={playbackDetailsRef}
              className="state-playback-details-shell"
              style={{ opacity: playbackDetailsOpacity }}
              aria-hidden={!statePlayerExpanded}
            >
              <div className="state-playback-details">
                <div className="state-playback-details-header">
                  <div>
                    <p className="eyebrow">{t('Détails de l’animation')}</p>
                    <h2>{activeSequenceLabel}</h2>
                    <p>
                      {activeSequence.builtIn
                        ? t(activeSequence.description)
                        : activeSequence.description}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {t('Mode de lecture')} · {t(activeSequence.playbackMode)}
                  </Badge>
                </div>
                <div className="state-playback-detail-grid">
                  <div>
                    <span>{t('Expressions')}</span>
                    <strong>{activeSequence.steps.length}</strong>
                    <small>
                      {activeSequence.steps
                        .map(step => formatSeconds(step.holdMs, language))
                        .join(' · ')}
                    </small>
                  </div>
                  <div>
                    <span>{t('Premier clignement')}</span>
                    <strong>
                      {activeSequence.blink.enabled
                        ? formatSeconds(activeSequence.blink.initialDelayMs, language)
                        : t('Désactivé')}
                    </strong>
                    <small>{t('après le lancement')}</small>
                  </div>
                  <div>
                    <span>{t('Intervalle du clignement')}</span>
                    <strong>
                      {formatSeconds(activeSequence.blink.minIntervalMs, language)}–
                      {formatSeconds(activeSequence.blink.maxIntervalMs, language)}
                    </strong>
                    <small>{t('tirage aléatoire')}</small>
                  </div>
                  <div>
                    <span>{t('Durée du clignement')}</span>
                    <strong>{activeSequence.blink.durationMs} ms</strong>
                    <small>{t('fermeture et ouverture')}</small>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.footer>
        )}
        {!editorPageOpen && mode !== 'photo' && (
          <nav className="mobile-mode-tabs" aria-label={t('Mode d’édition')}>
            <Button
              className="mobile-mode-tab mobile-avatar-tab"
              variant="ghost"
              type="button"
              aria-pressed={mode === 'avatars'}
              aria-label={t('Choisir un avatar')}
              onClick={() => setMode('avatars')}
            >
              <ExpressionPreview
                expression={expressions[0] ?? defaultExpression}
                surface={activeAvatar.body.primary}
                bodyNodes={activeAvatar.body.nodes}
                colors={activeAvatar.colors}
                avatarEyes={activeAvatarEyes}
                renderStyle={activeAvatar.renderStyle}
                id={`active-avatar-tab-${activeAvatar.id}`}
              />
              <span>{activeAvatar.name}</span>
            </Button>
            {(
              [
                ['manual', t('Pose'), Move3D],
                ['expressions', t('Expressions'), Smile],
                ['states', t('Animations'), Play],
                ['export', t('Exporter'), Download],
              ] as const
            ).map(([value, label, Icon]) => (
              <Button
                className="mobile-mode-tab"
                variant="ghost"
                type="button"
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                <Icon />
                <span>{label}</span>
              </Button>
            ))}
          </nav>
        )}
      </main>
    </Drawer>
  )
}
