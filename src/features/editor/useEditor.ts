import {
  createAvatarEngine,
  createBodyNode,
  duplicateBodyNode,
  MAX_BODY_NODES,
  seedOfName,
  type AvatarEngine,
  type bodyPrimitiveTypes,
  type BodyNode,
  type SurfaceConfig,
} from '@bible-strong/avatar-core'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  avatarFromSource,
  characterOfAvatar,
  createAvatar,
  defaultAvatarOutlineStyle,
  type AvatarColors,
  type AvatarFeatures,
  type AvatarLibrary,
  type AvatarOutlineStyle,
  type StudioAvatar,
} from '@/features/editor/avatar'
import { loadLibrary, persistLibrary } from '@/features/editor/document'
import {
  defaultSnapshotComposition,
  type SnapshotComposition,
} from '@/features/editor/snapshotComposition'
import { restExpression, type PhotoTool, type SnapshotBackground } from '@/features/editor/utils'
import { useStudioLanguage } from '@/i18n'

export const editorTabs = [
  'avatars',
  'pose',
  'states',
  'clips',
  'faces',
  'status',
  'export',
] as const
export type EditorTab = (typeof editorTabs)[number]

/** What the avatar on the stage does: a scenario, a state, or one clip. */
export type Doing = { routine: string } | { state: string } | { clip: string }

/**
 * The pose set by hand. The head's turn is kept as the three angles the rotation gizmo works
 * with; the engine is given the turn they make.
 */
export type HandPose = { head: [number, number, number]; position: [number, number]; zoom: number }

const restPose: HandPose = { head: [0, 0, 0], position: [0, 0], zoom: 0.6 }

export type PhotoSettings = {
  background: SnapshotBackground
  colorFrom: string
  colorTo: string
  format: 'png' | 'svg'
  size: '512' | '1024' | '2048'
  composition: SnapshotComposition
}

export const useEditor = () => {
  const { t, language } = useStudioLanguage()
  const [library, setLibrary] = useState<AvatarLibrary>(() => loadLibrary())
  const [tab, setTab] = useState<EditorTab>('avatars')
  // Whether the avatar on the stage is being built: its body, colours and features.
  const [building, setBuilding] = useState(false)
  const [doing, setDoing] = useState<Doing>({ state: 'idle' })
  const [face, setFace] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [followsPointer, setFollowsPointer] = useState(false)
  const [pose, setPose] = useState<HandPose>(restPose)
  // The photo mode: the avatar posed by hand in a frame, on a background, saved as a file.
  const [photoMode, setPhotoMode] = useState(false)
  const [photoTool, setPhotoTool] = useState<PhotoTool>('frame')
  const [photoSections, setPhotoSections] = useState<PhotoTool[]>([])
  const [photoFlash, setPhotoFlash] = useState(0)
  const [photo, setPhoto] = useState<PhotoSettings>({
    background: 'transparent',
    colorFrom: '#F5F7FC',
    colorTo: '#DDE4F5',
    format: 'png',
    size: '1024',
    composition: defaultSnapshotComposition,
  })
  const [selectedBodyNodeId, setSelectedBodyNodeId] = useState<'primary' | string>('primary')

  const avatars = library.avatars
  const activeAvatar = avatars.find(avatar => avatar.id === library.activeAvatarId) ?? avatars[0]
  const character = useMemo(() => characterOfAvatar(activeAvatar), [activeAvatar])
  // One engine per avatar: two avatars do not draw the same clips at the same time.
  const engine = useRef<AvatarEngine>(createAvatarEngine({ seed: seedOfName(activeAvatar.id) }))

  useEffect(() => {
    persistLibrary(library)
  }, [library])

  const updateLibrary = (avatarsNext: StudioAvatar[], activeAvatarId = activeAvatar.id) =>
    setLibrary({ avatars: avatarsNext, activeAvatarId })

  const updateActiveAvatar = (update: (avatar: StudioAvatar) => StudioAvatar) =>
    updateLibrary(avatars.map(avatar => (avatar.id === activeAvatar.id ? update(avatar) : avatar)))

  // The library.
  const selectAvatar = (id: string) => {
    updateLibrary(avatars, id)
    setSelectedBodyNodeId('primary')
  }
  const addAvatar = () => {
    const avatar = createAvatar(t('Nouvel avatar'))
    updateLibrary([...avatars, avatar], avatar.id)
    setSelectedBodyNodeId('primary')
    setTab('avatars')
    setBuilding(true)
  }
  const duplicateAvatar = () => {
    const copy: StudioAvatar = {
      ...structuredClone(activeAvatar),
      id: `avatar-${crypto.randomUUID()}`,
      name: `${activeAvatar.name} ${t('copie')}`,
    }
    updateLibrary([...avatars, copy], copy.id)
  }
  const deleteAvatar = () => {
    if (avatars.length <= 1) return
    const rest = avatars.filter(avatar => avatar.id !== activeAvatar.id)
    updateLibrary(rest, rest[0].id)
    setSelectedBodyNodeId('primary')
  }
  const renameAvatar = (name: string) => updateActiveAvatar(avatar => ({ ...avatar, name }))
  /** Bring in an avatar from a file: its character is kept, its animations are not. */
  const importAvatar = (source: string) => {
    const avatar = avatarFromSource(source)
    updateLibrary([...avatars, avatar], avatar.id)
    setSelectedBodyNodeId('primary')
    setTab('avatars')
    setBuilding(true)
  }

  // The body.
  const surface = activeAvatar.body.primary
  const bodyNodes = activeAvatar.body.nodes
  const updateBodyNodes = (nodes: BodyNode[]) =>
    updateActiveAvatar(avatar => ({ ...avatar, body: { ...avatar.body, nodes } }))
  const updateSurface = (primary: SurfaceConfig) =>
    updateActiveAvatar(avatar => ({ ...avatar, body: { ...avatar.body, primary } }))
  const selectBodyNode = (id: 'primary' | string | null) => setSelectedBodyNodeId(id ?? 'primary')
  const selectedBodyNode =
    selectedBodyNodeId === 'primary'
      ? null
      : (bodyNodes.find(node => node.id === selectedBodyNodeId) ?? null)
  const addBodyNode = (type: (typeof bodyPrimitiveTypes)[number]) => {
    if (bodyNodes.length >= MAX_BODY_NODES) return
    const node = createBodyNode(type, bodyNodes.length)
    updateBodyNodes([...bodyNodes, node])
    setSelectedBodyNodeId(node.id)
  }
  const commitBodyNode = (next: BodyNode) =>
    updateBodyNodes(bodyNodes.map(node => (node.id === next.id ? next : node)))
  const updateSelectedBodyNode = (update: (node: BodyNode) => BodyNode) => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(bodyNodes.map(node => (node.id === selectedBodyNodeId ? update(node) : node)))
  }
  const updateNodeVector = (property: 'position' | 'rotation', index: 0 | 1 | 2, value: number) =>
    updateSelectedBodyNode(node => {
      const vector = [...node[property]] as [number, number, number]
      vector[index] = value
      return { ...node, [property]: vector }
    })
  const deleteSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(bodyNodes.filter(node => node.id !== selectedBodyNodeId))
    setSelectedBodyNodeId('primary')
  }
  const duplicateSelectedBodyNode = () => {
    if (!selectedBodyNode || bodyNodes.length >= MAX_BODY_NODES) return
    const copy = duplicateBodyNode(selectedBodyNode)
    updateBodyNodes([...bodyNodes, copy])
    setSelectedBodyNodeId(copy.id)
  }

  // Colours, outline and the face's own features.
  const updateColors = (changes: Partial<AvatarColors>) =>
    updateActiveAvatar(avatar => ({ ...avatar, colors: { ...avatar.colors, ...changes } }))
  const updateFeatures = (changes: Partial<AvatarFeatures>) =>
    updateActiveAvatar(avatar => ({ ...avatar, eyes: { ...avatar.eyes, ...changes } }))
  const outline: AvatarOutlineStyle = activeAvatar.renderStyle.outline ?? defaultAvatarOutlineStyle
  const updateOutline = (changes: Partial<AvatarOutlineStyle>) =>
    updateActiveAvatar(avatar => ({
      ...avatar,
      renderStyle: { type: 'vector', outline: { ...outline, ...changes } },
    }))

  return {
    t,
    language,
    tab,
    setTab: (next: EditorTab) => {
      setTab(next)
      setBuilding(false)
    },
    building,
    setBuilding,
    engine,
    character,
    avatars,
    activeAvatar,
    selectAvatar,
    addAvatar,
    duplicateAvatar,
    deleteAvatar,
    renameAvatar,
    importAvatar,
    doing,
    setDoing,
    face,
    setFace,
    playing,
    setPlaying,
    speed,
    setSpeed,
    followsPointer,
    setFollowsPointer,
    pose,
    setPose,
    resetPose: () => setPose(restPose),
    photoMode,
    openPhotoMode: () => {
      setPhotoTool('frame')
      setPhotoSections([])
      setBuilding(false)
      setPhotoMode(true)
    },
    closePhotoMode: () => setPhotoMode(false),
    photoTool,
    setPhotoTool,
    photoSections,
    setPhotoSections,
    photoFlash,
    flashPhoto: () => setPhotoFlash(current => current + 1),
    photo,
    updatePhoto: (changes: Partial<PhotoSettings>) =>
      setPhoto(current => ({ ...current, ...changes })),
    surface,
    bodyNodes,
    expression: restExpression,
    selectedBodyNodeId,
    selectedBodyNode,
    selectBodyNode,
    addBodyNode,
    commitBodyNode,
    updateSurface,
    updateSelectedBodyNode,
    updateNodeVector,
    deleteSelectedBodyNode,
    duplicateSelectedBodyNode,
    updateColors,
    updateFeatures,
    outline,
    updateOutline,
  }
}

export type Editor = ReturnType<typeof useEditor>
