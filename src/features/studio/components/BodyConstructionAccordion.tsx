import { ChevronDown, Plus, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { InspectorCard, PanelTitle } from '@/app/components/common'
import { ColorField, NumericField } from '@/app/components/controls'
import { getPreviewGeometry, scaleSurface } from '@/app/studio-utils'
import { bodyPrimitiveTypes, MAX_BODY_NODES, type BodyNode } from '@/features/avatar/body'
import { SurfaceThumbnail } from '@/features/avatar/components/ExpressionWorkspace'
import { surfaceLabels, surfacePresets, type SurfaceConfig } from '@/features/avatar/surfaces'
import type { StudioController } from '@/features/studio/useStudioController'

function BodyStructureThumbnail({
  surface,
  bodyNodes,
  activeNodeId,
  expression,
}: {
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  activeNodeId: string
  expression: StudioController['expression']
}) {
  const geometry = getPreviewGeometry(expression, surface, bodyNodes)
  const pathClassName = (nodeId: string | null) =>
    activeNodeId === 'primary'
      ? nodeId === null
        ? 'is-active'
        : 'is-context'
      : nodeId === activeNodeId
        ? 'is-active'
        : 'is-context'

  return (
    <span className="body-structure-thumbnail" aria-hidden="true">
      <svg viewBox="-150 -150 300 300">
        {geometry.backPaths.map((pathValue, index) => (
          <path
            className={pathClassName(geometry.backNodeIds[index] ?? null)}
            d={pathValue}
            key={`back-${geometry.backNodeIds[index] ?? index}`}
          />
        ))}
        <path className={pathClassName(null)} d={geometry.headPath} />
        {geometry.frontPaths.map((pathValue, index) => (
          <path
            className={pathClassName(geometry.frontNodeIds[index] ?? null)}
            d={pathValue}
            key={`front-${geometry.frontNodeIds[index] ?? index}`}
          />
        ))}
      </svg>
    </span>
  )
}

export function BodyConstructionAccordion({
  controller,
  reduceMotion,
}: {
  controller: StudioController
  reduceMotion: boolean
}) {
  const [addOpen, setAddOpen] = useState(false)
  const {
    activeAvatar,
    addBodyNode,
    bodyNodes,
    deleteSelectedBodyNode,
    duplicateSelectedBodyNode,
    expression,
    selectBodyNode,
    selectedBodyNode,
    selectedBodyNodeId,
    surface,
    t,
    updateNodeVector,
    updateSelectedBodyNode,
    updateSurface,
  } = controller

  return (
    <InspectorCard className="body-panel">
      <PanelTitle
        level={3}
        title="Construction du corps"
        subtitle="Une forme principale porte les yeux. Les autres primitives se placent autour d’elle."
      />
      <Accordion
        className="body-tree"
        value={[selectedBodyNodeId]}
        onValueChange={value => {
          const nextNodeId = value.at(-1)
          if (nextNodeId) selectBodyNode(nextNodeId)
        }}
      >
        <AccordionItem value="primary" className="body-node-accordion-item">
          <AccordionTrigger className="body-node-trigger">
            <BodyStructureThumbnail
              surface={surface}
              bodyNodes={bodyNodes}
              activeNodeId="primary"
              expression={expression}
            />
            <span className="body-node-summary">
              <span className="body-node-title-line">
                <strong>{t(surfaceLabels[surface.type])}</strong>
                <Badge>{t('Principale')}</Badge>
              </span>
              <small>{t('porte les yeux')}</small>
            </span>
          </AccordionTrigger>
          <AccordionContent className="body-node-accordion-content">
            <div className="surface-grid body-surface-grid">
              {bodyPrimitiveTypes.map(type => {
                const previewSurface = type === surface.type ? surface : surfacePresets[type]
                return (
                  <Button
                    className="surface-card"
                    variant="outline"
                    type="button"
                    key={type}
                    aria-pressed={surface.type === type}
                    onClick={() => {
                      if (type !== surface.type) updateSurface({ ...surfacePresets[type] })
                    }}
                  >
                    <SurfaceThumbnail surface={previewSurface} />
                    <span>{t(surfaceLabels[type])}</span>
                  </Button>
                )
              })}
            </div>
            <div className="surface-fields">
              <NumericField
                label="Échelle"
                value={Math.max(surface.width, surface.height, surface.depth)}
                min={120}
                max={300}
                unit="u"
                onChange={size =>
                  updateSurface(
                    scaleSurface(surface, size, { width: 120, height: 120, depth: 100 })
                  )
                }
              />
              <NumericField
                label="Largeur"
                value={surface.width}
                min={120}
                max={300}
                unit="u"
                onChange={width => updateSurface({ ...surface, width })}
              />
              <NumericField
                label="Hauteur"
                value={surface.height}
                min={120}
                max={300}
                unit="u"
                onChange={height => updateSurface({ ...surface, height })}
              />
              <NumericField
                label="Profondeur"
                value={surface.depth}
                min={100}
                max={300}
                unit="u"
                onChange={depth => updateSurface({ ...surface, depth })}
              />
              {(surface.type === 'cube' || surface.type === 'diamond') && (
                <NumericField
                  label="Rondeur"
                  value={surface.roundness}
                  min={0}
                  max={2}
                  step={0.01}
                  onActiveChange={active => controller.updateHighlight(active ? 'head' : null)}
                  onChange={roundness => updateSurface({ ...surface, roundness })}
                />
              )}
              {surface.type === 'cylinder' && (
                <NumericField
                  label="Rondeur des arêtes"
                  value={surface.roundness}
                  min={0}
                  max={2}
                  step={0.01}
                  onActiveChange={active => controller.updateHighlight(active ? 'head' : null)}
                  onChange={roundness => updateSurface({ ...surface, roundness })}
                />
              )}
              {(surface.type === 'cylinder' || surface.type === 'cone') && (
                <NumericField
                  label="Rondeur globale"
                  value={surface.morphRoundness ?? 0}
                  min={0}
                  max={2}
                  step={0.01}
                  onActiveChange={active => controller.updateHighlight(active ? 'head' : null)}
                  onChange={morphRoundness => updateSurface({ ...surface, morphRoundness })}
                />
              )}
              {surface.type === 'cone' && (
                <>
                  <NumericField
                    label="Rondeur pointe"
                    value={surface.tipRoundness ?? 0}
                    min={0}
                    max={2}
                    step={0.01}
                    onActiveChange={active => controller.updateHighlight(active ? 'head' : null)}
                    onChange={tipRoundness => updateSurface({ ...surface, tipRoundness })}
                  />
                  <NumericField
                    label="Rondeur base"
                    value={surface.baseRoundness ?? 0}
                    min={0}
                    max={2}
                    step={0.01}
                    onActiveChange={active => controller.updateHighlight(active ? 'head' : null)}
                    onChange={baseRoundness => updateSurface({ ...surface, baseRoundness })}
                  />
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {bodyNodes.map(node => (
          <AccordionItem value={node.id} key={node.id} className="body-node-accordion-item">
            <AccordionTrigger className="body-node-trigger">
              <BodyStructureThumbnail
                surface={surface}
                bodyNodes={bodyNodes}
                activeNodeId={node.id}
                expression={expression}
              />
              <span className="body-node-summary">
                <strong>{t(node.name)}</strong>
                <small>{t(surfaceLabels[node.surface.type])}</small>
              </span>
            </AccordionTrigger>
            <AccordionContent className="body-node-accordion-content">
              {selectedBodyNodeId === node.id && selectedBodyNode && (
                <div className="body-node-editor">
                  <div className="body-node-actions">
                    <strong>{t('Réglages de la forme')}</strong>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={bodyNodes.length >= MAX_BODY_NODES}
                        onClick={duplicateSelectedBodyNode}
                      >
                        {t('Dupliquer')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={deleteSelectedBodyNode}
                      >
                        {t('Supprimer')}
                      </Button>
                    </div>
                  </div>
                  <p className="body-gizmo-help">
                    <Badge variant="outline">{t('Gizmo local')}</Badge>
                    {t('Glisse un axe pour déplacer la forme, ou un anneau pour la faire tourner.')}
                  </p>
                  <div className="surface-fields">
                    <NumericField
                      label="Échelle"
                      value={Math.max(
                        selectedBodyNode.surface.width,
                        selectedBodyNode.surface.height,
                        selectedBodyNode.surface.depth
                      )}
                      min={10}
                      max={300}
                      unit="u"
                      onChange={size =>
                        updateSelectedBodyNode(currentNode => ({
                          ...currentNode,
                          surface: scaleSurface(currentNode.surface, size, {
                            width: 10,
                            height: 10,
                            depth: 10,
                          }),
                        }))
                      }
                    />
                    {(['width', 'height', 'depth'] as const).map(dimension => (
                      <NumericField
                        key={dimension}
                        label={
                          { width: 'Largeur', height: 'Hauteur', depth: 'Profondeur' }[dimension]
                        }
                        value={selectedBodyNode.surface[dimension]}
                        min={10}
                        max={300}
                        unit="u"
                        onChange={value =>
                          updateSelectedBodyNode(currentNode => ({
                            ...currentNode,
                            surface: { ...currentNode.surface, [dimension]: value },
                          }))
                        }
                      />
                    ))}
                    {(selectedBodyNode.surface.type === 'cube' ||
                      selectedBodyNode.surface.type === 'diamond' ||
                      selectedBodyNode.surface.type === 'cylinder') && (
                      <NumericField
                        label="Rondeur"
                        value={selectedBodyNode.surface.roundness}
                        min={0}
                        max={2}
                        step={0.01}
                        onChange={roundness =>
                          updateSelectedBodyNode(currentNode => ({
                            ...currentNode,
                            surface: { ...currentNode.surface, roundness },
                          }))
                        }
                      />
                    )}
                    {(selectedBodyNode.surface.type === 'cylinder' ||
                      selectedBodyNode.surface.type === 'cone') && (
                      <NumericField
                        label="Rondeur globale"
                        value={selectedBodyNode.surface.morphRoundness ?? 0}
                        min={0}
                        max={2}
                        step={0.01}
                        onChange={morphRoundness =>
                          updateSelectedBodyNode(currentNode => ({
                            ...currentNode,
                            surface: { ...currentNode.surface, morphRoundness },
                          }))
                        }
                      />
                    )}
                    {selectedBodyNode.surface.type === 'cone' && (
                      <>
                        <NumericField
                          label="Rondeur pointe"
                          value={selectedBodyNode.surface.tipRoundness ?? 0}
                          min={0}
                          max={2}
                          step={0.01}
                          onChange={tipRoundness =>
                            updateSelectedBodyNode(currentNode => ({
                              ...currentNode,
                              surface: { ...currentNode.surface, tipRoundness },
                            }))
                          }
                        />
                        <NumericField
                          label="Rondeur base"
                          value={selectedBodyNode.surface.baseRoundness ?? 0}
                          min={0}
                          max={2}
                          step={0.01}
                          onChange={baseRoundness =>
                            updateSelectedBodyNode(currentNode => ({
                              ...currentNode,
                              surface: { ...currentNode.surface, baseRoundness },
                            }))
                          }
                        />
                      </>
                    )}
                  </div>
                  <div className="color-panel body-node-color-panel">
                    <PanelTitle
                      level={3}
                      title="Couleur de la forme"
                      subtitle="Indépendante de la couleur du corps."
                    />
                    <ColorField
                      label="Forme"
                      value={selectedBodyNode.color ?? activeAvatar.colors.body}
                      onChange={color =>
                        updateSelectedBodyNode(currentNode => ({ ...currentNode, color }))
                      }
                    />
                    {selectedBodyNode.color && (
                      <Button
                        className="inherit-colors"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('Reprendre la couleur du corps')}
                        onClick={() =>
                          updateSelectedBodyNode(currentNode => {
                            const next = { ...currentNode }
                            delete next.color
                            return next
                          })
                        }
                      >
                        <RotateCcw />
                      </Button>
                    )}
                  </div>
                  <div className="body-transform-grid">
                    <div>
                      <h3>{t('Position locale')}</h3>
                      {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                        <NumericField
                          key={axis}
                          label={axis}
                          value={selectedBodyNode.position[index]}
                          unit="u"
                          onChange={value =>
                            updateNodeVector('position', index as 0 | 1 | 2, value)
                          }
                        />
                      ))}
                    </div>
                    <div>
                      <h3>{t('Rotation locale')}</h3>
                      {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                        <NumericField
                          key={axis}
                          label={axis}
                          value={selectedBodyNode.rotation[index]}
                          unit="°"
                          onChange={value =>
                            updateNodeVector('rotation', index as 0 | 1 | 2, value)
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="body-add">
        <Button
          className="body-add-trigger"
          variant="outline"
          type="button"
          aria-expanded={addOpen}
          disabled={bodyNodes.length >= MAX_BODY_NODES}
          onClick={() => setAddOpen(open => !open)}
        >
          <Plus />
          <span>{t('Ajouter une forme')}</span>
          <small>
            {bodyNodes.length}/{MAX_BODY_NODES}
          </small>
          <ChevronDown />
        </Button>
        <AnimatePresence initial={false}>
          {addOpen && (
            <motion.div
              className="body-add-options"
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            >
              {bodyPrimitiveTypes.map(type => (
                <Button
                  className="surface-card body-add-card"
                  variant="outline"
                  type="button"
                  key={type}
                  onClick={() => {
                    addBodyNode(type)
                    setAddOpen(false)
                  }}
                >
                  <SurfaceThumbnail surface={surfacePresets[type]} />
                  <span>{t(surfaceLabels[type])}</span>
                </Button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </InspectorCard>
  )
}
