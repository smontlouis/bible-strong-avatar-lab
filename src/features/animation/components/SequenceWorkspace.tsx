import { ArrowLeft, Copy, GripVertical, Pause, Pencil, Play, Square, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Field, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useStudioLanguage } from '@/i18n'

import { ControlSection, InspectorCard, PanelTitle } from '@/app/components/common'
import { NumericField } from '@/app/components/controls'
import {
  createSequenceStep,
  findExpressionIndex,
  type AvatarSequence,
  type SequenceStep,
} from '@/features/animation/sequences'
import {
  type AvatarColors,
  type AvatarEyeDefaults,
  type AvatarRenderStyle,
} from '@/features/avatar/avatars'
import { type BodyNode } from '@/features/avatar/body'
import { ExpressionPreview } from '@/features/avatar/components/ExpressionWorkspace'
import { type Expression } from '@/features/avatar/geometry'
import { type SurfaceConfig } from '@/features/avatar/surfaces'
export function SequenceWorkspace({
  editing,
  expressions,
  surface,
  bodyNodes,
  colors,
  avatarEyes,
  renderStyle,
  selectedStepId,
  backButtonRef,
  reduceMotion,
  onSelectedStepChange,
  onChange,
  onPreviewStep,
  onEditExpression,
  onPlay,
  onPause,
  onStop,
  playing,
  active,
  onCancel,
  onSave,
  onDuplicate,
  onDelete,
  semanticKeyError,
}: {
  editing: { sourceId: string | null; draft: AvatarSequence }
  expressions: Expression[]
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  colors: AvatarColors
  avatarEyes: AvatarEyeDefaults
  renderStyle: AvatarRenderStyle
  selectedStepId: string | null
  backButtonRef: RefObject<HTMLButtonElement | null>
  reduceMotion: boolean
  onSelectedStepChange: (id: string | null) => void
  onChange: (draft: AvatarSequence) => void
  onPreviewStep: (step: SequenceStep) => void
  onEditExpression: (index: number, expression: Expression) => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  playing: boolean
  active: boolean
  onCancel: () => void
  onSave: () => void
  onDuplicate: () => void
  onDelete: () => void
  semanticKeyError: string | null
}) {
  const { t } = useStudioLanguage()
  const draggedStepId = useRef<string | null>(null)
  const selectedStep =
    editing.draft.steps.find(step => step.id === selectedStepId) ?? editing.draft.steps[0]

  const updateStep = (changes: Partial<SequenceStep>) => {
    if (!selectedStep) return
    onChange({
      ...editing.draft,
      steps: editing.draft.steps.map(step =>
        step.id === selectedStep.id ? { ...step, ...changes } : step
      ),
    })
  }

  const moveStep = (targetId: string) => {
    const draggedId = draggedStepId.current
    if (!draggedId || draggedId === targetId) return
    const dragged = editing.draft.steps.find(step => step.id === draggedId)
    const targetIndex = editing.draft.steps.findIndex(step => step.id === targetId)
    if (!dragged || targetIndex < 0) return
    const next = editing.draft.steps.filter(step => step.id !== draggedId)
    next.splice(targetIndex, 0, dragged)
    onChange({ ...editing.draft, steps: next })
  }

  return (
    <>
      <header className="workspace-header">
        <Button
          ref={backButtonRef}
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label={t('Retour aux animations')}
        >
          <ArrowLeft />
        </Button>
        <div className="workspace-heading">
          <p className="eyebrow">{t('Éditeur d’animation')}</p>
          <h1>{editing.sourceId ? t('Modifier l’animation') : t('Nouvelle animation')}</h1>
          <p>{t('Compose les expressions, leur cadence et les clignements de cette animation.')}</p>
        </div>
        <div className="workspace-header-actions">
          <Button
            variant="outline"
            size="icon"
            onClick={active && playing ? onPause : onPlay}
            aria-label={t(
              active && playing ? 'Pause' : active ? 'Reprendre' : 'Prévisualiser l’animation'
            )}
          >
            {active && playing ? <Pause /> : <Play fill="currentColor" />}
          </Button>
          {active && (
            <Button
              variant="outline"
              size="icon"
              onClick={onStop}
              aria-label={t('Arrêter l’animation')}
            >
              <Square fill="currentColor" />
            </Button>
          )}
        </div>
      </header>

      <div className="workspace-scroll sequence-workspace-scroll">
        <ControlSection
          title="Identité"
          subtitle="Nom, catégorie et comportement de lecture de l’animation."
          compact
        >
          <InspectorCard>
            <Field>
              <label className="semantic-key-label" htmlFor={`animation-key-${editing.draft.id}`}>
                {t('Clé sémantique')}
              </label>
              <Input
                id={`animation-key-${editing.draft.id}`}
                value={editing.draft.semanticKey ?? ''}
                maxLength={64}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                aria-invalid={Boolean(semanticKeyError)}
                aria-describedby={`animation-key-help-${editing.draft.id}`}
                onChange={event =>
                  onChange({
                    ...editing.draft,
                    semanticKey: event.currentTarget.value || undefined,
                  })
                }
              />
              <p
                id={`animation-key-help-${editing.draft.id}`}
                className={semanticKeyError ? 'semantic-key-error' : 'field-help'}
                role={semanticKeyError ? 'alert' : undefined}
              >
                {semanticKeyError ??
                  t('Clé publique stable utilisée par l’API runtime, par exemple thinking.')}
              </p>
            </Field>
            <Field>
              <FieldTitle>{t('Nom')}</FieldTitle>
              <Input
                value={editing.draft.name}
                onChange={event => onChange({ ...editing.draft, name: event.currentTarget.value })}
              />
            </Field>
            <Field>
              <FieldTitle>{t('Catégorie')}</FieldTitle>
              <Select
                value={editing.draft.group}
                items={[
                  { value: 'Cycle de vie', label: t('Cycle de vie') },
                  { value: 'Réactions', label: t('Réactions') },
                  { value: 'Custom', label: t('Custom') },
                ]}
                onValueChange={value => value && onChange({ ...editing.draft, group: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cycle de vie">{t('Cycle de vie')}</SelectItem>
                  <SelectItem value="Réactions">{t('Réactions')}</SelectItem>
                  <SelectItem value="Custom">{t('Custom')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldTitle>{t('Description')}</FieldTitle>
              <Input
                value={editing.draft.description}
                onChange={event =>
                  onChange({ ...editing.draft, description: event.currentTarget.value })
                }
              />
            </Field>
            <Field>
              <FieldTitle>{t('Mode de lecture')}</FieldTitle>
              <Select
                value={editing.draft.playbackMode}
                items={[
                  { value: 'loop', label: t('Boucle') },
                  { value: 'once', label: t('Une fois') },
                  { value: 'pingPong', label: t('Aller-retour') },
                ]}
                onValueChange={value =>
                  value &&
                  onChange({
                    ...editing.draft,
                    playbackMode: value as AvatarSequence['playbackMode'],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loop">{t('Boucle')}</SelectItem>
                  <SelectItem value="once">{t('Une fois')}</SelectItem>
                  <SelectItem value="pingPong">{t('Aller-retour')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </InspectorCard>
        </ControlSection>

        <ControlSection
          title="Timeline"
          subtitle="Glisse les étapes pour les réordonner, puis sélectionne-en une pour régler sa cadence."
          compact
        >
          <InspectorCard>
            {editing.draft.steps.length ? (
              <div className="sequence-timeline">
                {editing.draft.steps.map((step, position) => {
                  const expressionIndex = findExpressionIndex(expressions, step.expressionId)
                  const preset = expressions[expressionIndex]
                  if (!preset) return null
                  const card = (
                    <Button
                      variant="outline"
                      type="button"
                      aria-pressed={selectedStep?.id === step.id}
                      onClick={() => {
                        onSelectedStepChange(step.id)
                        onPreviewStep(step)
                      }}
                      onDoubleClick={() => onEditExpression(expressionIndex, preset)}
                    >
                      <GripVertical className="sequence-grip" />
                      <ExpressionPreview
                        expression={preset}
                        surface={surface}
                        bodyNodes={bodyNodes}
                        colors={colors}
                        avatarEyes={avatarEyes}
                        renderStyle={renderStyle}
                        id={`sequence-${editing.draft.id}-${step.id}`}
                      />
                      <span>{String(expressionIndex).padStart(2, '0')}</span>
                      <small>{position + 1}</small>
                    </Button>
                  )
                  return (
                    <motion.div
                      className="sequence-step"
                      data-selected={selectedStep?.id === step.id || undefined}
                      key={step.id}
                      layout="position"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 500, damping: 40 }
                      }
                      draggable
                      onDragStart={() => {
                        draggedStepId.current = step.id
                        onSelectedStepChange(step.id)
                      }}
                      onDragEnter={() => moveStep(step.id)}
                      onDragOver={event => event.preventDefault()}
                      onDragEnd={() => {
                        draggedStepId.current = null
                      }}
                    >
                      <ContextMenu>
                        <ContextMenuTrigger render={card} />
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => onEditExpression(expressionIndex, preset)}
                          >
                            <Pencil /> {t('Modifier')}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <p className="sequence-empty">{t('Ajoute une expression pour commencer.')}</p>
            )}

            {selectedStep ? (
              <div className="sequence-step-settings">
                <div className="state-section-heading">
                  <div>
                    <h3>{t('Étape sélectionnée')}</h3>
                    <p>{t('Durée visible avant de passer à l’expression suivante.')}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => {
                      const next = editing.draft.steps.filter(step => step.id !== selectedStep.id)
                      onChange({ ...editing.draft, steps: next })
                      onSelectedStepChange(next[0]?.id ?? null)
                    }}
                    aria-label={t('Supprimer cette étape')}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <NumericField
                  label="Temps d’affichage"
                  value={selectedStep.holdMs}
                  min={100}
                  max={60000}
                  step={100}
                  unit="ms"
                  onChange={holdMs => updateStep({ holdMs })}
                />
                <NumericField
                  label="Durée de transition"
                  value={selectedStep.transitionMs}
                  min={0}
                  max={5000}
                  step={50}
                  unit="ms"
                  onChange={transitionMs => updateStep({ transitionMs })}
                />
                <Field className="sequence-transition-field" orientation="horizontal">
                  <FieldTitle>{t('Transition')}</FieldTitle>
                  <Select
                    value={selectedStep.transition}
                    items={[
                      { value: 'spring', label: t('Ressort') },
                      { value: 'gentleSpring', label: t('Ressort léger') },
                      { value: 'smooth', label: t('Douce') },
                      { value: 'snappy', label: t('Rapide') },
                    ]}
                    onValueChange={value =>
                      value && updateStep({ transition: value as SequenceStep['transition'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spring">{t('Ressort')}</SelectItem>
                      <SelectItem value="gentleSpring">{t('Ressort léger')}</SelectItem>
                      <SelectItem value="smooth">{t('Douce')}</SelectItem>
                      <SelectItem value="snappy">{t('Rapide')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}
          </InspectorCard>

          <InspectorCard>
            <PanelTitle
              level={3}
              title="Ajouter une expression"
              subtitle="Sélectionne un preset pour l’ajouter à la fin de la timeline."
            />
            <div className="expression-grid sequence-expression-library">
              {expressions.map((preset, index) => (
                <Button
                  className="expression-card"
                  variant="outline"
                  type="button"
                  key={index}
                  onClick={() => {
                    const step = createSequenceStep(preset.id)
                    onChange({ ...editing.draft, steps: [...editing.draft.steps, step] })
                    onSelectedStepChange(step.id)
                    onPreviewStep(step)
                  }}
                >
                  <ExpressionPreview
                    expression={preset}
                    surface={surface}
                    bodyNodes={bodyNodes}
                    colors={colors}
                    avatarEyes={avatarEyes}
                    renderStyle={renderStyle}
                    id={`sequence-library-${index}`}
                  />
                  <span>{String(index).padStart(2, '0')}</span>
                </Button>
              ))}
            </div>
          </InspectorCard>
        </ControlSection>

        <ControlSection
          title="Clignements"
          subtitle="Le blink fonctionne indépendamment des changements d’expression."
          compact
        >
          <InspectorCard>
            <div className="switch">
              <span>{t('Activer les clignements')}</span>
              <Switch
                checked={editing.draft.blink.enabled}
                onCheckedChange={enabled =>
                  onChange({
                    ...editing.draft,
                    blink: { ...editing.draft.blink, enabled },
                  })
                }
              />
            </div>
            <NumericField
              label="Premier clignement"
              value={editing.draft.blink.initialDelayMs}
              min={0}
              max={60000}
              step={100}
              unit="ms"
              onChange={initialDelayMs =>
                onChange({
                  ...editing.draft,
                  blink: { ...editing.draft.blink, initialDelayMs },
                })
              }
            />
            <div className="eye-columns">
              <NumericField
                label="Intervalle minimum"
                value={editing.draft.blink.minIntervalMs}
                min={100}
                max={60000}
                step={100}
                unit="ms"
                onChange={minIntervalMs =>
                  onChange({
                    ...editing.draft,
                    blink: {
                      ...editing.draft.blink,
                      minIntervalMs,
                      maxIntervalMs: Math.max(minIntervalMs, editing.draft.blink.maxIntervalMs),
                    },
                  })
                }
              />
              <NumericField
                label="Intervalle maximum"
                value={editing.draft.blink.maxIntervalMs}
                min={editing.draft.blink.minIntervalMs}
                max={60000}
                step={100}
                unit="ms"
                onChange={maxIntervalMs =>
                  onChange({
                    ...editing.draft,
                    blink: { ...editing.draft.blink, maxIntervalMs },
                  })
                }
              />
            </div>
            <NumericField
              label="Durée du clignement"
              value={editing.draft.blink.durationMs}
              min={40}
              max={3000}
              step={20}
              unit="ms"
              onChange={durationMs =>
                onChange({
                  ...editing.draft,
                  blink: { ...editing.draft.blink, durationMs },
                })
              }
            />
          </InspectorCard>
        </ControlSection>
      </div>

      <footer className="workspace-footer">
        <div className="workspace-footer-secondary">
          {editing.sourceId && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 /> {t('Supprimer')}
            </Button>
          )}
          <Button variant="outline" onClick={onDuplicate}>
            <Copy /> {t('Dupliquer')}
          </Button>
        </div>
        <Button
          disabled={!editing.draft.steps.length || !editing.draft.name.trim()}
          onClick={onSave}
        >
          {t('Enregistrer')}
        </Button>
      </footer>
    </>
  )
}
