import {
  clipNames,
  clips,
  createAvatarPlayer,
  faceNames,
  faces,
  faceSmiles,
  gestureNames,
  playEngineClip,
  playerFrame,
  pokeEngine,
  renderCharacterFrame,
  routines,
  stateGroups,
  states,
  type AvatarCharacter,
  type ClipDefinition,
  type FaceName,
} from '@bible-strong/avatar-core'
import { useMemo, useRef, useState } from 'react'

import { InspectorCard, PanelTitle } from '@/app/components/common'
import { ColorField, NumericField } from '@/app/components/controls'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { downloadPicture, pictureSvg } from '@/features/editor/picture'
import { Scene } from '@/features/editor/Scene'
import { emptyStatus, Stage, type StageStatus } from '@/features/editor/Stage'
import {
  editorTabs,
  useEditor,
  type Editor as EditorState,
  type EditorTab,
} from '@/features/editor/useEditor'
import { BodyConstructionAccordion } from '@/features/studio/components/BodyConstructionAccordion'
import { useStudioLanguage, type StudioLanguage } from '@/i18n'

const tabLabels: Record<EditorTab, string> = {
  character: 'Personnage',
  pose: 'Pose',
  states: 'États',
  clips: 'Clips',
  faces: 'Visages',
  gestures: 'Gestes',
  status: 'Status',
  export: 'Export',
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${
    active
      ? 'border-transparent bg-neutral-900 text-white'
      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
  }`
const heading = 'mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase'
const note = 'text-xs leading-relaxed text-neutral-500'

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useStudioLanguage()
  return (
    <section>
      <h2 className={heading}>{t(title)}</h2>
      {children}
    </section>
  )
}

function Chips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const { t } = useStudioLanguage()
  return (
    <div className="switch">
      <span>{t(label)}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={t(label)} />
    </div>
  )
}

function CharacterPanel({ editor }: { editor: EditorState }) {
  const { t, activeAvatar, avatars, outline } = editor
  const features = activeAvatar.eyes
  const file = useRef<HTMLInputElement | null>(null)
  const [importError, setImportError] = useState(false)
  return (
    <>
      <Group title="Avatars">
        <Chips>
          {avatars.map(avatar => (
            <button
              className={chip(avatar.id === activeAvatar.id)}
              type="button"
              key={avatar.id}
              onClick={() => editor.selectAvatar(avatar.id)}
            >
              {avatar.name}
            </button>
          ))}
        </Chips>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={editor.addAvatar}>
            {t('Nouveau')}
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={editor.duplicateAvatar}>
            {t('Dupliquer')}
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={() => file.current?.click()}>
            {t('Importer')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={avatars.length <= 1}
            onClick={editor.deleteAvatar}
          >
            {t('Supprimer')}
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async event => {
              const chosen = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!chosen) return
              try {
                editor.importAvatar(await chosen.text())
                setImportError(false)
              } catch {
                setImportError(true)
              }
            }}
          />
        </div>
        <p className={`mt-2 ${note}`}>
          {importError
            ? t('Ce fichier n’est pas une définition d’avatar.')
            : t(
                'Un avatar importé garde son corps, ses couleurs, son nez et sa bouche. Ses expressions et ses animations ne sont pas reprises.'
              )}
        </p>
      </Group>

      <Group title="Nom">
        <input
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          value={activeAvatar.name}
          aria-label={t('Nom')}
          onChange={event => editor.renameAvatar(event.currentTarget.value)}
        />
      </Group>

      <BodyConstructionAccordion controller={editor} />

      <InspectorCard>
        <PanelTitle level={3} title="Couleurs" subtitle="Le corps et le visage." />
        <div className="color-panel">
          <ColorField
            label="Couleur du corps"
            value={activeAvatar.colors.body}
            onChange={body => editor.updateColors({ body })}
          />
          <ColorField
            label="Couleur des yeux"
            value={activeAvatar.colors.eyes}
            onChange={eyes => editor.updateColors({ eyes })}
          />
        </div>
        <SwitchRow
          label="Contour"
          checked={outline.enabled}
          onChange={enabled => editor.updateOutline({ enabled })}
        />
        {outline.enabled && (
          <div className="surface-fields">
            <ColorField
              label="Couleur du contour"
              value={outline.color}
              onChange={color => editor.updateOutline({ color })}
            />
            <NumericField
              label="Épaisseur"
              value={outline.width}
              min={0.5}
              max={12}
              step={0.5}
              onChange={width => editor.updateOutline({ width })}
            />
            <NumericField
              label="Opacité"
              value={outline.opacity}
              min={0}
              max={1}
              step={0.05}
              onChange={opacity => editor.updateOutline({ opacity })}
            />
          </div>
        )}
      </InspectorCard>

      <InspectorCard>
        <PanelTitle
          level={3}
          title="Visage"
          subtitle="Les yeux sont les mêmes pour tous les avatars. Seule leur hauteur se règle."
        />
        <div className="surface-fields">
          <NumericField
            label="Hauteur des yeux"
            value={features.positionYLeft}
            min={-90}
            max={90}
            step={1}
            unit="u"
            onChange={y => editor.updateFeatures({ positionYLeft: y, positionYRight: y })}
          />
        </div>
        <SwitchRow
          label="Afficher le nez"
          checked={features.noseEnabled}
          onChange={noseEnabled => editor.updateFeatures({ noseEnabled })}
        />
        {features.noseEnabled && (
          <div className="surface-fields">
            <NumericField
              label="Largeur"
              value={features.noseWidth}
              min={2}
              max={80}
              step={1}
              unit="u"
              onChange={noseWidth => editor.updateFeatures({ noseWidth })}
            />
            <NumericField
              label="Hauteur"
              value={features.noseHeight}
              min={2}
              max={80}
              step={1}
              unit="u"
              onChange={noseHeight => editor.updateFeatures({ noseHeight })}
            />
            <NumericField
              label="Position Y"
              value={features.noseY}
              min={-110}
              max={110}
              step={1}
              unit="u"
              onChange={noseY => editor.updateFeatures({ noseY })}
            />
          </div>
        )}
        <SwitchRow
          label="Afficher la bouche"
          checked={features.mouthEnabled}
          onChange={mouthEnabled => editor.updateFeatures({ mouthEnabled })}
        />
        {features.mouthEnabled && (
          <>
            <div className="surface-fields">
              <NumericField
                label="Largeur"
                value={features.mouthWidth}
                min={4}
                max={160}
                step={1}
                unit="u"
                onChange={mouthWidth => editor.updateFeatures({ mouthWidth })}
              />
              <NumericField
                label="Épaisseur"
                value={features.mouthHeight}
                min={1}
                max={60}
                step={0.5}
                unit="u"
                onChange={mouthHeight => editor.updateFeatures({ mouthHeight })}
              />
              <NumericField
                label="Position Y"
                value={features.mouthY}
                min={-110}
                max={110}
                step={1}
                unit="u"
                onChange={mouthY => editor.updateFeatures({ mouthY })}
              />
              <NumericField
                label="Courbure au repos"
                value={features.mouthCurve}
                min={-100}
                max={100}
                step={1}
                onChange={mouthCurve => editor.updateFeatures({ mouthCurve })}
              />
            </div>
            <p className={note}>
              {t('Une bouche en trait suit le visage : elle se relève pour happy, tombe pour sad.')}
            </p>
          </>
        )}
      </InspectorCard>
    </>
  )
}

function FaceChips({ editor }: { editor: EditorState }) {
  const { t, face, setFace } = editor
  return (
    <Chips>
      <button className={chip(face === null)} type="button" onClick={() => setFace(null)}>
        {t('Automatique')}
      </button>
      {faceNames.map(name => (
        <button
          className={chip(face === name)}
          type="button"
          key={name}
          onClick={() => setFace(name)}
        >
          {name}
        </button>
      ))}
    </Chips>
  )
}

function PosePanel({ editor }: { editor: EditorState }) {
  const { t, pose, setPose } = editor
  const turn = (index: 0 | 1 | 2, value: number) => {
    const rotation: [number, number, number] = [...pose.rotation]
    rotation[index] = value
    setPose({ ...pose, rotation })
  }
  const move = (index: 0 | 1, value: number) => {
    const position: [number, number] = [...pose.position]
    position[index] = value
    setPose({ ...pose, position })
  }
  return (
    <>
      <p className={note}>
        {t(
          'Place l’avatar librement : glisse sur la scène pour le tourner, ou règle les valeurs. Le clip est arrêté ; l’image de l’onglet Export reprend cette pose.'
        )}
      </p>
      <InspectorCard>
        <PanelTitle level={3} title="Rotation" subtitle="En degrés, autour de X, Y et Z." />
        <div className="surface-fields">
          {(['X', 'Y', 'Z'] as const).map((axis, index) => (
            <NumericField
              label={`Rotation ${axis}`}
              value={pose.rotation[index]}
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
      <Group title="Visage">
        <FaceChips editor={editor} />
      </Group>
    </>
  )
}

function StatesPanel({ editor, status }: { editor: EditorState; status: StageStatus }) {
  const { t, doing, setDoing } = editor
  const name = status.state
  const state = name ? states[name] : undefined
  const policy = !state
    ? ''
    : state.next && state.holdSeconds !== undefined
      ? `${t('Temporisé')} · ${state.holdSeconds} s → ${state.next}`
      : state.next
        ? `${t('Dans l’ordre')} → ${state.next}`
        : t('Paquet mélangé, en boucle')
  return (
    <>
      {state && name && (
        <InspectorCard>
          <PanelTitle level={3} title={name} subtitle={policy} />
          <Chips>
            {state.clips.map((clip, index) => (
              <span className={chip(clip === status.clip)} key={`${clip}-${index}`}>
                {clip} · {clips[clip].duration} s
              </span>
            ))}
          </Chips>
          <p className={`mt-2 ${note}`}>
            {status.joining
              ? `${t('Raccord vers')} ${status.clip}`
              : `${t('Clip en cours')} : ${status.clip}`}
            {' · '}
            {t('visage')} {state.face ?? t('automatique')}
            {state.morph ? ` · ${t('morphing')} ${state.morph}` : ''}
          </p>
          {!state.next && state.clips.length > 1 && (
            <p className={note}>
              {t(
                'Chaque clip passe une fois par tour, dans un ordre retiré à chaque tour. Ce n’est pas une liste de lecture.'
              )}
            </p>
          )}
        </InspectorCard>
      )}
      {stateGroups.map(group => (
        <Group title={group.label} key={group.label}>
          <Chips>
            {group.states.map(item => (
              <button
                className={chip('state' in doing ? doing.state === item : status.state === item)}
                type="button"
                key={item}
                onClick={() => setDoing({ state: item })}
              >
                {item}
              </button>
            ))}
          </Chips>
        </Group>
      ))}
    </>
  )
}

const trackColors: Record<string, string> = {
  position: '#2f855a',
  rotation: '#805ad5',
  squash: '#c05621',
  scale: '#b7791f',
  lids: '#2b6cb0',
  expression: '#4a5568',
}

function ClipTracks({ clip, time }: { clip: ClipDefinition; time: number }) {
  const { t } = useStudioLanguage()
  const names: Record<string, string> = {
    position: 'Position',
    rotation: 'Rotation',
    squash: 'Étirement',
    scale: 'Zoom',
    lids: 'Paupières',
    expression: 'Visage',
  }
  return (
    <div className="flex flex-col gap-1.5">
      {Object.entries(clip.tracks).map(([name, keys]) => (
        <div className="flex items-center gap-2" key={name}>
          <span className="w-20 shrink-0 text-xs text-neutral-600">{t(names[name] ?? name)}</span>
          <div className="relative h-5 flex-1 rounded bg-neutral-100">
            {(keys as { t: number; v: unknown }[]).map((key, index) => (
              <span
                className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45"
                style={{ left: `${(key.t / clip.duration) * 100}%`, background: trackColors[name] }}
                title={`${key.t.toFixed(2)} s · ${typeof key.v === 'string' ? key.v : (key.v as number[]).map(value => value.toFixed(2)).join(', ')}`}
                key={index}
              />
            ))}
            <span
              className="absolute top-0 h-full w-px bg-neutral-900"
              style={{ left: `${Math.min(100, (time / clip.duration) * 100)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs text-neutral-400">{keys.length}</span>
        </div>
      ))}
    </div>
  )
}

function ClipsPanel({ editor, status }: { editor: EditorState; status: StageStatus }) {
  const { t, doing, setDoing, playing, setPlaying, speed, setSpeed, engine } = editor
  const clip = clips[status.clip]
  return (
    <>
      {clip && (
        <InspectorCard>
          <PanelTitle
            level={3}
            title={clip.name}
            subtitle={
              status.joining
                ? t('Raccord : le corps rejoint la pose de départ du clip.')
                : `${status.time.toFixed(2)} s / ${clip.duration} s`
            }
          />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setPlaying(!playing)}
            >
              {t(playing ? 'Pause' : 'Lecture')}
            </Button>
            {[0.25, 0.5, 1].map(value => (
              <button
                className={chip(speed === value)}
                type="button"
                key={value}
                onClick={() => setSpeed(value)}
              >
                ×{value}
              </button>
            ))}
          </div>
          <input
            className="mb-3 w-full"
            type="range"
            min={0}
            max={clip.duration}
            step={0.01}
            value={status.joining ? 0 : Math.min(status.time, clip.duration)}
            aria-label={t('Temps du clip')}
            onChange={event => {
              // Moving the cursor shows the clip at that time, alone and stopped.
              setPlaying(false)
              setDoing({ clip: clip.name })
              playEngineClip(engine.current, clip, {
                phase: Number(event.currentTarget.value) / clip.duration,
                transition: 'cut',
              })
            }}
          />
          <ClipTracks clip={clip} time={status.joining ? 0 : status.time} />
          <p className={`mt-3 ${note}`}>
            {t(
              'Chaque piste a ses propres images clés : une rotation peut partir avant un déplacement. Les clips se lisent, ils ne se modifient pas ici.'
            )}
          </p>
        </InspectorCard>
      )}
      <Group title="Clips">
        <Chips>
          {clipNames.map(name => (
            <button
              className={chip('clip' in doing ? doing.clip === name : status.clip === name)}
              type="button"
              key={name}
              onClick={() => {
                setPlaying(true)
                setDoing({ clip: name })
              }}
            >
              {name}
            </button>
          ))}
        </Chips>
      </Group>
    </>
  )
}

const restFrame = playerFrame(createAvatarPlayer())

function FaceThumbnail({
  character,
  name,
  turned,
}: {
  character: AvatarCharacter
  name: FaceName
  turned: boolean
}) {
  const scene = useMemo(
    () =>
      renderCharacterFrame(character, {
        ...restFrame,
        face: name,
        eyes: faces[name].eyes,
        smile: faceSmiles[name],
        inspectWeight: name === 'inspecting' ? 1 : 0,
        rotation: turned ? [-8, 32, 0] : [0, 0, 0],
      }),
    [character, name, turned]
  )
  return (
    <Scene scene={scene} character={character} className="size-16" viewBox="-170 -170 340 340" />
  )
}

function FacesPanel({ editor }: { editor: EditorState }) {
  const { t, character, face, setFace } = editor
  if (!character) return null
  return (
    <>
      <p className={note}>
        {t(
          'Un visage, c’est la forme des deux yeux. Le clip choisit le visage, sauf si un état le tient ou si tu en imposes un ici.'
        )}
      </p>
      <button className={chip(face === null)} type="button" onClick={() => setFace(null)}>
        {t('Automatique : laisser le clip décider')}
      </button>
      <div className="grid grid-cols-1 gap-2">
        {faceNames.map(name => (
          <button
            className={`flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
              face === name
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 bg-white hover:bg-neutral-50'
            }`}
            type="button"
            key={name}
            onClick={() => setFace(name)}
          >
            <FaceThumbnail character={character} name={name} turned={false} />
            <FaceThumbnail character={character} name={name} turned />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{name}</span>
              <span className={note}>
                {t(faces[name].blinks ? 'Cligne avec les clips' : 'Ne cligne pas')}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

function GesturesPanel({ editor, status }: { editor: EditorState; status: StageStatus }) {
  const { t, engine, doing, setDoing, followsPointer, setFollowsPointer } = editor
  const spinners = stateGroups.find(group => group.label === 'Spinners')?.states ?? []
  return (
    <>
      <Group title="Gestes">
        <Chips>
          {gestureNames.map(name => (
            <button
              className={chip(false)}
              type="button"
              key={name}
              onClick={() => pokeEngine(engine.current, name)}
            >
              {name}
            </button>
          ))}
        </Chips>
        <p className={`mt-2 ${note}`}>
          {t(
            'Un geste se pose par-dessus ce qui joue, sans le relancer. Plusieurs gestes s’additionnent.'
          )}
        </p>
      </Group>
      <Group title="Regard">
        <SwitchRow label="Suit le pointeur" checked={followsPointer} onChange={setFollowsPointer} />
      </Group>
      <Group title="Spinners">
        <Chips>
          {spinners.map(name => (
            <button
              className={chip('state' in doing ? doing.state === name : status.state === name)}
              type="button"
              key={name}
              onClick={() => setDoing({ state: name })}
            >
              {name}
            </button>
          ))}
          <button className={chip(false)} type="button" onClick={() => setDoing({ state: 'idle' })}>
            {t('Revenir à idle')}
          </button>
        </Chips>
        <p className={`mt-2 ${note}`}>
          {t(
            'Le corps se rassemble en un petit disque et un motif se dessine autour. Le clip s’arrête pendant ce temps.'
          )}
        </p>
      </Group>
    </>
  )
}

function StatusPanel({ editor, status }: { editor: EditorState; status: StageStatus }) {
  const { t, doing, setDoing } = editor
  const running = 'routine' in doing ? doing.routine : null
  return (
    <>
      <Group title="Scénarios">
        <Chips>
          {Object.keys(routines).map(name => (
            <button
              className={chip(running === name)}
              type="button"
              key={name}
              onClick={() => setDoing({ routine: name })}
            >
              {name}
            </button>
          ))}
        </Chips>
        <p className={`mt-2 ${note}`}>
          {t(
            'Un scénario mène l’avatar d’état en état, chacun pour un temps, avec ce qui se dit pendant. Il tourne en boucle.'
          )}
        </p>
      </Group>
      {running && (
        <ol className="flex flex-col gap-1">
          {routines[running].map(([state, seconds, text], index) => {
            const active = index === status.routineStep
            return (
              <li
                className={`flex items-baseline gap-2 rounded-lg px-3 py-1.5 text-sm ${
                  active ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-700'
                }`}
                key={index}
              >
                <span className="w-5 shrink-0 text-xs opacity-60">{index + 1}</span>
                <span className="w-24 shrink-0 font-medium">{state}</span>
                <span className="w-10 shrink-0 text-xs opacity-70">{seconds} s</span>
                <span className="truncate text-xs opacity-80">
                  {active
                    ? (status.text ?? '')
                    : typeof text === 'string'
                      ? text
                      : (text?.[0] ?? '')}
                  {!active && Array.isArray(text) && text.length > 1 ? ` +${text.length - 1}` : ''}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}

const snippet = (name: string) => `import { Avatar } from '@bible-strong/avatar-react'
import ${name} from './${name}.character.json'

<Avatar character={${name}} state="thinking" />
<Avatar character={${name}} clip="Done_A" face="happy" />
<Avatar character={${name}} routine="chat" followPointer />`

function ExportPanel({ editor }: { editor: EditorState }) {
  const { t, character, activeAvatar, engine } = editor
  const [background, setBackground] = useState<string | null>(null)
  if (!character) return null
  const slug =
    activeAvatar.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'avatar'
  const identifier = slug.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
  const saveCharacter = () => {
    const link = window.document.createElement('a')
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' })
    )
    link.download = `${slug}.character.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return (
    <>
      <InspectorCard>
        <PanelTitle
          level={3}
          title="Personnage"
          subtitle="Le corps, les couleurs et le visage. Les clips, les états et les visages viennent avec la bibliothèque."
        />
        <Button type="button" onClick={saveCharacter}>
          {t('Télécharger le personnage (.json)')}
        </Button>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-100">
          {snippet(identifier)}
        </pre>
      </InspectorCard>
      <InspectorCard>
        <PanelTitle
          level={3}
          title="Image"
          subtitle="L’avatar tel qu’il est sur la scène. Règle sa pose dans l’onglet Pose."
        />
        <SwitchRow
          label="Fond de couleur"
          checked={background !== null}
          onChange={enabled => setBackground(enabled ? '#eef1f8' : null)}
        />
        {background !== null && (
          <div className="color-panel">
            <ColorField label="Couleur du fond" value={background} onChange={setBackground} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(['png', 'svg'] as const).map(format => (
            <Button
              variant="secondary"
              type="button"
              key={format}
              onClick={() =>
                void downloadPicture(
                  pictureSvg(character, engine.current, background),
                  `${slug}.${format}`
                )
              }
            >
              {t('Télécharger')} .{format}
            </Button>
          ))}
        </div>
      </InspectorCard>
    </>
  )
}

const languages: { value: StudioLanguage; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '中文' },
]

export function Editor() {
  const editor = useEditor()
  const { t, tab, setTab, activeAvatar } = editor
  const { language, setLanguage } = useStudioLanguage()
  const [status, setStatus] = useState<StageStatus>(emptyStatus)
  const stopped = tab === 'character' || tab === 'pose'

  return (
    <main
      className="grid h-dvh grid-cols-1 grid-rows-[minmax(260px,42dvh)_minmax(0,1fr)] bg-neutral-100 text-neutral-900 md:grid-cols-[minmax(0,1fr)_460px] md:grid-rows-1"
      lang={language}
    >
      <section className="flex min-h-0 flex-col items-center justify-center gap-2 bg-[#141821] p-4 text-neutral-300">
        <div className="aspect-square min-h-0 w-full max-w-[600px] flex-1">
          <Stage editor={editor} onStatus={setStatus} />
        </div>
        <p className="text-center font-mono text-xs">
          {activeAvatar.name}
          {stopped
            ? ` · ${t(tab === 'pose' ? 'pose libre' : 'au repos')}`
            : ` · ${status.state ? `${status.state} · ` : ''}${status.clip}${
                status.joining ? ` · ${t('raccord')}` : ''
              } · ${status.face}`}
        </p>
        <p className="h-5 text-sm text-white">{stopped ? '' : status.text}</p>
      </section>

      <aside className="flex min-h-0 flex-col border-l border-neutral-200 bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <strong className="text-sm">Bible Strong · Avatar Lab</strong>
          <select
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
            value={language}
            aria-label={t('Langue de l’interface')}
            onChange={event => setLanguage(event.currentTarget.value as StudioLanguage)}
          >
            {languages.map(item => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </header>
        <nav
          className="flex flex-wrap gap-1 border-b border-neutral-200 px-3 py-2"
          aria-label={t('Mode d’édition')}
        >
          {editorTabs.map(item => (
            <button
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                item === tab ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
              type="button"
              aria-current={item === tab ? 'page' : undefined}
              key={item}
              onClick={() => setTab(item)}
            >
              {t(tabLabels[item])}
            </button>
          ))}
        </nav>
        <div className="inspector-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {tab === 'character' && <CharacterPanel editor={editor} />}
          {tab === 'pose' && <PosePanel editor={editor} />}
          {tab === 'states' && <StatesPanel editor={editor} status={status} />}
          {tab === 'clips' && <ClipsPanel editor={editor} status={status} />}
          {tab === 'faces' && <FacesPanel editor={editor} />}
          {tab === 'gestures' && <GesturesPanel editor={editor} status={status} />}
          {tab === 'status' && <StatusPanel editor={editor} status={status} />}
          {tab === 'export' && <ExportPanel editor={editor} />}
        </div>
      </aside>
    </main>
  )
}
