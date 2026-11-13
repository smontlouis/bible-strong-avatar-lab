import {
  characterFromLegacyDefinition,
  createAvatarEngine,
  createBodyNode,
  duplicateBodyNode,
  expressionFromDefinition,
  MAX_BODY_NODES,
  seedOfName,
  type AvatarCharacter,
  type AvatarEngine,
  type bodyPrimitiveTypes,
  type BodyNode,
  type Expression,
  type FreePose,
  type SurfaceConfig,
} from '@bible-strong/avatar-core'
import { useEffect, useMemo, useRef, useState } from 'react'

import { createAvatarDefinition } from '@/features/avatar/avatarDefinition'
import {
  createAvatar,
  defaultAvatarOutlineStyle,
  type AvatarColors,
  type AvatarEyeDefaults,
  type AvatarOutlineStyle,
  type StudioAvatar,
} from '@/features/avatar/avatars'
import { studioAvatarFromDefinitionSource } from '@/features/avatar/importAvatarDefinition'
import {
  loadStudioDocument,
  persistStudioDocument,
  type StudioDocument,
} from '@/features/studio/studioDocument'
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

const restPose: Required<FreePose> = { rotation: [0, 0, 0], position: [0, 0], zoom: 0.6 }

/** The character of an avatar of the Studio: what it is, apart from what it does. */
export const characterOfAvatar = (avatar: StudioAvatar): AvatarCharacter | null => {
  const definition = createAvatarDefinition({
    avatar,
    behavior: { expressions: [], sequences: [] },
  })
  return definition.ok ? characterFromLegacyDefinition(definition.value) : null
}

export const useEditor = () => {
  const { t, language } = useStudioLanguage()
  const [document, setDocument] = useState<StudioDocument>(() => loadStudioDocument())
  const [tab, setTab] = useState<EditorTab>('avatars')
  // Whether the avatar on the stage is being built: its body, colours and features.
  const [building, setBuilding] = useState(false)
  const [doing, setDoing] = useState<Doing>({ state: 'idle' })
  const [face, setFace] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [followsPointer, setFollowsPointer] = useState(false)
  const [pose, setPose] = useState<Required<FreePose>>(restPose)
  const [selectedBodyNodeId, setSelectedBodyNodeId] = useState<'primary' | string>('primary')

  const avatars = document.library.avatars
  const activeAvatar =
    avatars.find(avatar => avatar.id === document.library.activeAvatarId) ?? avatars[0]
  const character = useMemo(() => characterOfAvatar(activeAvatar), [activeAvatar])
  // One engine per avatar: two avatars do not draw the same clips at the same time.
  const engine = useRef<AvatarEngine>(createAvatarEngine({ seed: seedOfName(activeAvatar.id) }))

  useEffect(() => {
    persistStudioDocument(document)
  }, [document])

  const updateLibrary = (avatarsNext: StudioAvatar[], activeAvatarId = activeAvatar.id) =>
    setDocument(current => ({
      ...current,
      library: { ...current.library, avatars: avatarsNext, activeAvatarId },
    }))

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
    const imported = studioAvatarFromDefinitionSource(source)
    const avatar: StudioAvatar = { ...imported.avatar, behavior: undefined }
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
  const updateFeatures = (changes: Partial<AvatarEyeDefaults>) =>
    updateActiveAvatar(avatar => ({ ...avatar, eyes: { ...avatar.eyes, ...changes } }))
  const outline: AvatarOutlineStyle =
    activeAvatar.renderStyle.type === 'vector' && activeAvatar.renderStyle.outline
      ? activeAvatar.renderStyle.outline
      : defaultAvatarOutlineStyle
  const updateOutline = (changes: Partial<AvatarOutlineStyle>) =>
    updateActiveAvatar(avatar => ({
      ...avatar,
      renderStyle: { type: 'vector', outline: { ...outline, ...changes } },
    }))

  // A neutral face at rest, for the thumbnails of the body's shapes.
  const expression: Expression = useMemo(
    () =>
      expressionFromDefinition('neutral', {
        head: { x: 0, y: 0, z: 0 },
        eyes: {
          left: { width: 0, height: 0, x: 0, y: 0, angle: 0 },
          right: { width: 0, height: 0, x: 0, y: 0, angle: 0 },
          spacing: 0,
        },
        perspective: 1,
        motion: { eyes: 'none', body: 'none' },
      }),
    []
  )

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
    surface,
    bodyNodes,
    expression,
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
