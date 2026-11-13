import { clips, states } from '@bible-strong/avatar-core'
import {
  Activity,
  ArrowLeft,
  Camera,
  Copy,
  Download,
  Film,
  Move3D,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { InspectorCard, PanelTitle } from '@/features/editor/panels'
import { Player } from '@/features/editor/Player'
import { ColorField, NumericField } from '@/features/editor/controls'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Switch } from '@/components/ui/switch'
import {
  characterOfAvatar,
  EYE_BUILD_MAX,
  EYE_BUILD_MIN,
  PERSPECTIVE_MAX,
} from '@/features/editor/avatar'
import { CharacterPreview } from '@/features/editor/CharacterPreview'
import { ExportPanel } from '@/features/editor/ExportPanel'
import { ClipsPanel, StatesPanel } from '@/features/editor/ClipExplorer'
import { PhotoPanel, PoseControls, takePicture } from '@/features/editor/PhotoPanel'
import { Scene } from '@/features/editor/Scene'
import { emptyStatus, Stage, type StageStatus } from '@/features/editor/Stage'
import {
  editorTabs,
  useEditor,
  type Editor as EditorState,
  type EditorTab,
} from '@/features/editor/useEditor'
import { BodyConstructionAccordion } from '@/features/editor/BodyConstruction'
import { PhotoStageFrame } from '@/features/editor/PhotoStageFrame'
import { StudioIdentity } from '@/features/editor/StudioIdentity'
import { useStudioLanguage } from '@/i18n'

const STACKED_LAYOUT_QUERY = '(max-width: 980px)'

const tabLabels: Record<EditorTab, string> = {
  avatars: 'Avatars',
  pose: 'Pose',
  states: 'États',
  clips: 'Clips',
  export: 'Exporter',
}

const tabIcons: Record<Exclude<EditorTab, 'avatars'>, typeof Play> = {
  pose: Move3D,
  states: Activity,
  clips: Film,
  export: Download,
}

const note = 'body-gizmo-help'

/** A choice among several, as the Studio draws them: a small outlined button that stays pressed. */
function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useStudioLanguage()
  return (
    <InspectorCard>
      <p className="eyebrow">{t(title)}</p>
      {children}
    </InspectorCard>
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

function AvatarsPanel({ editor }: { editor: EditorState }) {
  const { t, avatars, activeAvatar } = editor
  const file = useRef<HTMLInputElement | null>(null)
  const [importError, setImportError] = useState(false)
  return (
    <div className="panel-stack avatar-page">
      <section className="avatar-shelf" aria-label={t('Choisir un avatar')}>
        <div className="avatar-shelf-heading">
          <strong>{t('Double-clic pour modifier')}</strong>
          <span>{avatars.length}</span>
        </div>
        <div className="avatar-grid">
          {avatars.map(avatar => {
            const character = characterOfAvatar(avatar)
            return (
              <div className="avatar-sort-item" key={avatar.id}>
                <Button
                  className="avatar-card"
                  variant="outline"
                  aria-pressed={activeAvatar.id === avatar.id}
                  type="button"
                  onClick={() => editor.selectAvatar(avatar.id)}
                  onDoubleClick={() => {
                    editor.selectAvatar(avatar.id)
                    editor.setBuilding(true)
                  }}
                >
                  {character && <CharacterPreview character={character} />}
                  <span>{avatar.name}</span>
                </Button>
              </div>
            )
          })}
          <Button
            variant="outline"
            className="avatar-add creation-card"
            aria-label={t('Ajouter un avatar')}
            onClick={editor.addAvatar}
          >
            <Plus />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => editor.setBuilding(true)}
          >
            <Pencil /> {t('Modifier')}
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => file.current?.click()}>
            <Upload /> {t('Importer un .avatar.json')}
          </Button>
          <input
            ref={file}
            className="project-import-input"
            type="file"
            accept="application/json,.json,.avatar.json"
            aria-label={t('Importer un .avatar.json')}
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
        {importError ? (
          <p className="project-transfer-error" role="alert">
            {t('Ce fichier n’est pas une définition d’avatar.')}
          </p>
        ) : (
          <p className={note}>
            {t(
              'Un avatar importé garde son corps, ses couleurs, son nez et sa bouche. Ses expressions et ses animations ne sont pas reprises.'
            )}
          </p>
        )}
      </section>
    </div>
  )
}

function CharacterPanel({ editor }: { editor: EditorState }) {
  const { t, activeAvatar, outline } = editor
  const features = activeAvatar.eyes
  return (
    <div className="panel-stack">
      <BodyConstructionAccordion controller={editor} />

      <InspectorCard>
        <PanelTitle
          level={3}
          title="Perspective"
          subtitle="À 0, l’avatar est vu à plat : rien ne grossit en venant vers l’avant. À 1, la vue habituelle."
        />
        <div className="surface-fields">
          <NumericField
            label="Perspective"
            value={features.perspective}
            min={0}
            max={PERSPECTIVE_MAX}
            step={0.05}
            onChange={perspective => editor.updateFeatures({ perspective })}
            onActiveChange={editor.setShowsDepth}
          />
        </div>
      </InspectorCard>

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
          subtitle="Les yeux gardent leurs proportions sur tous les avatars. Leur taille, leur écart et leur hauteur se règlent."
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
          <NumericField
            label="Taille des yeux"
            value={features.eyeScale}
            min={EYE_BUILD_MIN}
            max={EYE_BUILD_MAX}
            step={0.05}
            onChange={eyeScale => editor.updateFeatures({ eyeScale })}
          />
          <NumericField
            label="Écart des yeux"
            value={features.eyeGap}
            min={EYE_BUILD_MIN}
            max={EYE_BUILD_MAX}
            step={0.05}
            onChange={eyeGap => editor.updateFeatures({ eyeGap })}
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
    </div>
  )
}

function PosePanel({ editor }: { editor: EditorState }) {
  const { t } = editor
  return (
    <div className="panel-stack">
      <p className={note}>
        {t(
          'Glisse l’avatar sur la scène, depuis n’importe quel onglet : ce qu’il fait se met en pause et il suit ta main. Affine ici avec le gizmo ou les valeurs. Lecture le fait reprendre là où il en était.'
        )}
      </p>
      <PoseControls editor={editor} />
      <InspectorCard>
        <SwitchRow
          label="Suit le pointeur"
          checked={editor.followsPointer}
          onChange={editor.setFollowsPointer}
        />
      </InspectorCard>
    </div>
  )
}

export function Editor() {
  const editor = useEditor()
  const { t, tab, setTab, activeAvatar, character, building, engine, doing, playing } = editor
  const { language, setLanguage } = useStudioLanguage()
  const [status, setStatus] = useState<StageStatus>(emptyStatus)
  const [deleting, setDeleting] = useState(false)
  const [stacked, setStacked] = useState(() => window.matchMedia(STACKED_LAYOUT_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(STACKED_LAYOUT_QUERY)
    const update = () => setStacked(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // What the avatar is doing, as the stage and the bar at the bottom name it.
  const doingName = (status.state ?? status.clip) || ('state' in doing ? doing.state : doing.clip)
  const { photoMode } = editor
  const stopped = building || photoMode

  const stage = (
    <section
      className={`stage-column${photoMode ? ' photo-mode-active' : ''}`}
      style={
        {
          '--avatar-body-color': activeAvatar.colors.body,
          '--avatar-eye-color': activeAvatar.colors.eyes,
        } as CSSProperties
      }
    >
      <div
        className="stage-mode-halo stage-mode-halo-blue"
        aria-hidden="true"
        style={{ opacity: photoMode ? 1 : 0.72, transform: photoMode ? 'scale(1.16)' : undefined }}
      />
      <StudioIdentity
        className="stage-identity"
        language={language}
        setLanguage={setLanguage}
        t={t}
      />
      {photoMode ? (
        <div className="stage-mode-content">
          <PhotoStageFrame
            background={editor.photo.background}
            colorFrom={editor.photo.colorFrom}
            colorTo={editor.photo.colorTo}
            composition={editor.photo.composition}
            tool={editor.photoTool}
            onCompositionChange={composition => editor.updatePhoto({ composition })}
          >
            <Stage editor={editor} onStatus={setStatus} status={doingName} />
          </PhotoStageFrame>
        </div>
      ) : (
        <div className="stage-mode-content live-stage-scene">
          <div className="stage-avatar-positioner">
            <Stage editor={editor} onStatus={setStatus} status={doingName} />
          </div>
        </div>
      )}
      {editor.photoFlash > 0 && (
        <motion.div
          className="photo-flash"
          key={editor.photoFlash}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0] }}
          transition={{ duration: 0.38, times: [0, 0.16, 1], ease: 'easeOut' }}
        />
      )}
      {!building && (
        <div className="photo-capture-bar">
          {photoMode && (
            <Button
              className="photo-capture-button stage-exit-button"
              variant="secondary"
              size="icon"
              type="button"
              aria-label={t('Quitter')}
              onClick={editor.closePhotoMode}
            >
              <ArrowLeft />
            </Button>
          )}
          <Button
            className="photo-capture-button"
            type="button"
            aria-label={t(photoMode ? 'Prendre une photo' : 'Ouvrir le mode photo')}
            onClick={() => (photoMode ? takePicture(editor) : editor.openPhotoMode())}
          >
            <Camera />
            <span className="photo-capture-label">
              {t(photoMode ? 'Prendre une photo' : 'Mode photo')}
            </span>
          </Button>
        </div>
      )}
      <p className="stage-credit">
        Made with ❤️ by{' '}
        <a href="https://x.com/_smontlouis" target="_blank" rel="noreferrer">
          @_smontlouis
        </a>
        .
      </p>
    </section>
  )

  const inspector = (
    <main
      className={`inspector ${building ? 'body-workspace' : 'studio-workspace'}${
        stopped ? '' : ' state-player-active'
      }${photoMode ? ' photo-inspector-active' : ''}`}
    >
      <StudioIdentity
        className="inspector-identity"
        language={language}
        setLanguage={setLanguage}
        t={t}
      />
      {building ? (
        <header className="workspace-header body-workspace-header">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.setBuilding(false)}
            aria-label={t('Retour au studio')}
          >
            <ArrowLeft />
          </Button>
          <div className="workspace-heading">
            <p className="eyebrow">{t('Construction du corps')}</p>
            <Input
              className="avatar-name-input"
              aria-label={t('Nom de l’avatar')}
              value={activeAvatar.name}
              onChange={event => editor.renameAvatar(event.currentTarget.value)}
            />
            <p>{t('Choisis la forme principale puis assemble les primitives autour d’elle.')}</p>
          </div>
        </header>
      ) : (
        <header className="mode-page-header">
          <div>
            <p className="eyebrow">{activeAvatar.name}</p>
            <h1>{t(photoMode ? 'Mode photo' : tabLabels[tab])}</h1>
          </div>
          {photoMode && (
            <Button variant="outline" type="button" onClick={editor.closePhotoMode}>
              <ArrowLeft />
              {t('Quitter')}
            </Button>
          )}
          {tab === 'pose' && !photoMode && (
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label={t('Réinitialiser')}
              onClick={editor.resetPose}
            >
              <RotateCcw />
            </Button>
          )}
        </header>
      )}
      <div className="mode-page-transition" key={building ? 'building' : photoMode ? 'photo' : tab}>
        {building ? (
          <CharacterPanel editor={editor} />
        ) : photoMode ? (
          <PhotoPanel editor={editor} />
        ) : (
          <>
            {tab === 'avatars' && <AvatarsPanel editor={editor} />}
            {tab === 'pose' && <PosePanel editor={editor} />}
            {tab === 'states' && <StatesPanel editor={editor} status={status} />}
            {tab === 'clips' && <ClipsPanel editor={editor} status={status} />}
            {tab === 'export' && <ExportPanel editor={editor} />}
          </>
        )}
      </div>
      {building && (
        <footer className="workspace-footer">
          <div className="workspace-footer-secondary">
            <Button
              variant="destructive"
              disabled={editor.avatars.length <= 1}
              onClick={() => setDeleting(true)}
            >
              <Trash2 />
              {t('Supprimer')}
            </Button>
            <Button variant="outline" onClick={editor.duplicateAvatar}>
              <Copy />
              {t('Dupliquer')}
            </Button>
          </div>
          <Button onClick={() => editor.setBuilding(false)}>{t('Enregistrer')}</Button>
        </footer>
      )}
      {!stopped && (
        <footer className="state-playback-footer">
          <Player
            editor={editor}
            status={status}
            name={editor.held ? `${doingName} · ${t('posé à la main')}` : doingName}
          />
        </footer>
      )}
      {!building && !photoMode && (
        <nav className="mobile-mode-tabs has-five-tabs" aria-label={t('Mode d’édition')}>
          <Button
            className="mobile-mode-tab mobile-avatar-tab"
            variant="ghost"
            type="button"
            aria-pressed={tab === 'avatars'}
            aria-label={t('Choisir un avatar')}
            onClick={() => setTab('avatars')}
          >
            {character && <CharacterPreview character={character} />}
            <span>{activeAvatar.name}</span>
          </Button>
          {editorTabs
            .filter((item): item is Exclude<EditorTab, 'avatars'> => item !== 'avatars')
            .map(item => {
              const Icon = tabIcons[item]
              return (
                <Button
                  className="mobile-mode-tab"
                  variant="ghost"
                  type="button"
                  key={item}
                  aria-pressed={tab === item}
                  onClick={() => setTab(item)}
                >
                  <Icon />
                  <span>{t(tabLabels[item])}</span>
                </Button>
              )
            })}
        </nav>
      )}
    </main>
  )

  return (
    <div className="studio-root" lang={language}>
      {stacked ? (
        <ResizablePanelGroup
          className="studio studio-mobile-resizable"
          orientation="vertical"
          resizeTargetMinimumSize={{ coarse: 40, fine: 12 }}
        >
          <ResizablePanel
            id="preview"
            className="mobile-stage-panel"
            defaultSize="42%"
            minSize={180}
          >
            {stage}
          </ResizablePanel>
          <ResizableHandle
            className="studio-resize-handle"
            withHandle
            aria-label={t('Redimensionner l’aperçu et l’éditeur')}
          />
          <ResizablePanel id="editor" className="mobile-inspector-panel" minSize={260}>
            {inspector}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="studio">
          {stage}
          {inspector}
        </div>
      )}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`Supprimer ${activeAvatar.name} ?`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Le corps, les couleurs et le visage de cet avatar seront définitivement supprimés.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                editor.deleteAvatar()
                editor.setBuilding(false)
                setDeleting(false)
              }}
            >
              {t('Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
