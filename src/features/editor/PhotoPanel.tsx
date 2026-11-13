import { faceNames } from '@bible-strong/avatar-core'
import { Camera, Move3D, RotateCcw, Scan, Shuffle } from 'lucide-react'

import { InspectorCard, PanelTitle } from '@/app/components/common'
import { ColorField, NumericField } from '@/app/components/controls'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Field, FieldTitle } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { CharacterPreview } from '@/features/editor/CharacterPreview'
import { downloadPicture, pictureSvg } from '@/features/editor/picture'
import type { Editor } from '@/features/editor/useEditor'
import { normalizeSnapshotComposition } from '@/features/export/snapshotComposition'
import { randomSnapshotPalette } from '@/features/export/snapshotPalette'

export const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'avatar'

/** Save the avatar as it is on the stage, framed and on its background, in the chosen format. */
export const takePicture = (editor: Editor) => {
  if (!editor.character) return
  editor.flashPhoto()
  const { format, size, background, colorFrom, colorTo, composition } = editor.photo
  void downloadPicture(
    pictureSvg(editor.character, editor.engine.current, {
      background,
      colorFrom,
      colorTo,
      size: Number(size),
      composition,
    }),
    `${slugOf(editor.activeAvatar.name)}.${format}`,
    Number(size)
  )
}

/** The head's turn, the place and the size of an avatar posed by hand. */
export function PoseControls({ editor }: { editor: Editor }) {
  const { t, pose, setPose } = editor
  const turn = (index: 0 | 1 | 2, value: number) => {
    const head: [number, number, number] = [...pose.head]
    head[index] = value
    setPose({ ...pose, head })
  }
  const move = (index: 0 | 1, value: number) => {
    const position: [number, number] = [...pose.position]
    position[index] = value
    setPose({ ...pose, position })
  }
  return (
    <>
      <InspectorCard>
        <PanelTitle
          level={3}
          title="Rotation de la tête"
          subtitle="Les libellés ↔ sont scrubbables, comme dans Figma."
        />
        <div className="surface-fields">
          {(['X', 'Y', 'Z'] as const).map((axis, index) => (
            <NumericField
              label={`Rotation ${axis}`}
              value={pose.head[index]}
              min={-360}
              max={360}
              step={1}
              unit="°"
              key={axis}
              onChange={value => turn(index as 0 | 1 | 2, value)}
            />
          ))}
        </div>
      </InspectorCard>
      <InspectorCard>
        <PanelTitle
          level={3}
          title="Position et taille"
          subtitle="En rayons du corps ; la taille de repos vaut 0,6."
        />
        <div className="surface-fields">
          <NumericField
            label="Position X"
            value={pose.position[0]}
            min={-1.5}
            max={1.5}
            step={0.01}
            onChange={value => move(0, value)}
          />
          <NumericField
            label="Position Y"
            value={pose.position[1]}
            min={-1.5}
            max={1.5}
            step={0.01}
            onChange={value => move(1, value)}
          />
          <NumericField
            label="Zoom"
            value={pose.zoom}
            min={0.25}
            max={1.2}
            step={0.01}
            onChange={zoom => setPose({ ...pose, zoom })}
          />
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={editor.resetPose}>
          {t('Remettre au repos')}
        </Button>
      </InspectorCard>
    </>
  )
}

/** The nine faces as cards: picking one holds it, picking it again lets the avatar decide. */
export function FaceGrid({ editor }: { editor: Editor }) {
  const { character, face, setFace } = editor
  if (!character) return null
  return (
    <div className="expression-grid photo-expression-grid">
      {faceNames.map(name => (
        <Button
          className="expression-card"
          variant="outline"
          aria-pressed={face === name}
          aria-label={name}
          type="button"
          key={name}
          onClick={() => setFace(face === name ? null : name)}
        >
          <CharacterPreview character={character} face={name} />
          <span>{name}</span>
        </Button>
      ))}
    </div>
  )
}

export function PhotoPanel({ editor }: { editor: Editor }) {
  const { t, photo, updatePhoto, photoSections, setPhotoSections, photoTool, setPhotoTool } = editor
  const { composition } = photo
  const frame = (changes: Partial<typeof composition>) =>
    updatePhoto({ composition: normalizeSnapshotComposition({ ...composition, ...changes }) })
  return (
    <div className="panel-stack photo-panel-stack">
      <Accordion
        className="photo-tool-accordion"
        multiple
        value={photoSections}
        onValueChange={next => {
          const sections = next as typeof photoSections
          const opened = sections.find(section => !photoSections.includes(section))
          setPhotoSections(sections)
          if (opened) setPhotoTool(opened)
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
                <small>{t('Orientation, position et taille de l’avatar.')}</small>
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="photo-tool-accordion-content">
            <PoseControls editor={editor} />
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
                  value={composition.x}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={x => frame({ x })}
                />
                <NumericField
                  label="Position Y"
                  value={composition.y}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={y => frame({ y })}
                />
                <NumericField
                  label="Zoom"
                  value={composition.scale * 100}
                  min={40}
                  max={300}
                  step={1}
                  unit="%"
                  onChange={zoom => frame({ scale: zoom / 100 })}
                />
                <NumericField
                  label="Coins arrondis"
                  value={composition.cornerRadius}
                  min={0}
                  max={50}
                  step={1}
                  unit="%"
                  onChange={cornerRadius => frame({ cornerRadius })}
                />
              </div>
              <Button
                className="photo-reset-frame"
                variant="outline"
                type="button"
                onClick={() => frame({ x: 0, y: 0, scale: 1 })}
              >
                <RotateCcw />
                {t('Recentrer le cadrage')}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <InspectorCard className="photo-expression-card">
        <PanelTitle title="Visage" subtitle="Choisis le visage visible sur la photo." />
        <FaceGrid editor={editor} />
      </InspectorCard>

      <InspectorCard>
        <PanelTitle
          title="Arrière-plan"
          subtitle="Choisis un fond transparent, uni ou en dégradé."
        />
        <Field className="snapshot-background-field" orientation="horizontal">
          <FieldTitle>{t('Style')}</FieldTitle>
          <Select
            value={photo.background}
            items={[
              { value: 'transparent', label: t('Transparent') },
              { value: 'solid', label: t('Uni') },
              { value: 'linear', label: t('Dégradé linéaire') },
              { value: 'radial', label: t('Dégradé radial') },
            ]}
            onValueChange={next =>
              next && updatePhoto({ background: next as typeof photo.background })
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
            disabled={photo.background === 'transparent'}
            onClick={() => {
              if (photo.background === 'transparent') return
              updatePhoto(
                randomSnapshotPalette(photo.background, editor.activeAvatar.colors.body, {
                  colorFrom: photo.colorFrom,
                  colorTo: photo.colorTo,
                })
              )
            }}
          >
            <Shuffle />
            {t('Aléatoire')}
          </Button>
        </Field>
        {photo.background !== 'transparent' && (
          <div className="snapshot-colors">
            <ColorField
              label={photo.background === 'solid' ? 'Couleur' : 'Départ'}
              value={photo.colorFrom}
              onChange={colorFrom => updatePhoto({ colorFrom })}
            />
            {photo.background !== 'solid' && (
              <ColorField
                label="Arrivée"
                value={photo.colorTo}
                onChange={colorTo => updatePhoto({ colorTo })}
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
            value={photo.format}
            items={[
              { value: 'png', label: 'PNG' },
              { value: 'svg', label: 'SVG' },
            ]}
            onValueChange={next => next && updatePhoto({ format: next as typeof photo.format })}
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
            value={photo.size}
            items={['512', '1024', '2048'].map(value => ({ value, label: `${value} px` }))}
            onValueChange={next => next && updatePhoto({ size: next as typeof photo.size })}
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
      <Button className="snapshot-export-button" type="button" onClick={() => takePicture(editor)}>
        <Camera />
        {t('Prendre une photo')}
        <span>{photo.format.toUpperCase()}</span>
      </Button>
    </div>
  )
}
