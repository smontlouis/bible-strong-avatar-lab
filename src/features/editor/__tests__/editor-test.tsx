// @vitest-environment jsdom
import {
  characterFromLegacyDefinition,
  createAvatarEngine,
  setEnginePose,
  setEngineState,
  advanceEngine,
} from '@bible-strong/avatar-core'
import { act, fireEvent, render } from '@testing-library/react'
import { vi } from 'vitest'

import { createAvatarDefinition } from '@/features/avatar/avatarDefinition'
import { Editor } from '@/features/editor/Editor'
import { pictureSvg } from '@/features/editor/picture'
import { loadStudioDocument } from '@/features/studio/studioDocument'
import { StudioLanguageProvider } from '@/i18n'

let pending: FrameRequestCallback[] = []
let clock = 0
const frames = (count: number) => {
  act(() => {
    for (let index = 0; index < count; index += 1) {
      clock += 1000 / 60
      const due = pending
      pending = []
      due.forEach(callback => callback(clock))
    }
  })
}

beforeEach(() => {
  pending = []
  clock = 0
  window.localStorage.clear()
  window.localStorage.setItem('avatar-studio-language', 'fr')
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => pending.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = []
  })
})
afterEach(() => vi.unstubAllGlobals())

const open = () => {
  const view = render(
    <StudioLanguageProvider>
      <Editor />
    </StudioLanguageProvider>
  )
  frames(8)
  return view
}

describe('the editor', () => {
  it('opens on the gallery of avatars, with no expression or animation to edit', () => {
    const { getByRole, queryByText } = open()
    expect(getByRole('heading', { level: 1 }).textContent).toBe('Avatars')
    expect(getByRole('button', { name: 'Strobi' })).toBeTruthy()
    expect(getByRole('button', { name: 'Kirby' })).toBeTruthy()
    expect(queryByText('Expressions')).toBeNull()
    expect(queryByText('Animations')).toBeNull()
    expect(getByRole('button', { name: 'États' })).toBeTruthy()
  })

  it('plays a state picked in the States tab and says which clip plays', () => {
    const { getByRole, getAllByText } = open()
    fireEvent.click(getByRole('button', { name: 'États' }))
    fireEvent.click(getByRole('button', { name: 'finished' }))
    frames(30)
    expect(getAllByText(/Done_B/).length).toBeGreaterThan(0)
  })

  it('shows the nine faces and holds the one that is picked', () => {
    const { getByRole, getAllByRole } = open()
    fireEvent.click(getByRole('button', { name: 'Visages' }))
    const cards = getAllByRole('button').filter(button =>
      button.classList.contains('expression-card')
    )
    expect(cards).toHaveLength(9)
    fireEvent.click(getByRole('button', { name: 'happy' }))
    expect(getByRole('button', { name: 'happy' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'Automatique' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('builds an avatar on a page of its own, and keeps its new name after a reload', () => {
    const first = open()
    fireEvent.doubleClick(first.getByRole('button', { name: 'Strobi' }))
    fireEvent.change(first.getByLabelText('Nom de l’avatar'), { target: { value: 'Strobi bis' } })
    fireEvent.click(first.getByRole('button', { name: 'Enregistrer' }))
    first.unmount()
    expect(loadStudioDocument().library.avatars[0].name).toBe('Strobi bis')
    const { getByRole } = open()
    expect(getByRole('button', { name: 'Strobi bis' })).toBeTruthy()
  })

  it('adds an avatar and opens it to be built', () => {
    const { getByRole, getByLabelText } = open()
    fireEvent.click(getByRole('button', { name: 'Ajouter un avatar' }))
    expect((getByLabelText('Nom de l’avatar') as HTMLInputElement).value).toBe('Nouvel avatar')
    expect(loadStudioDocument().library.avatars.at(-1)?.name).toBe('Nouvel avatar')
  })

  it('stops the avatar and lets it be turned by hand in the Pose tab', () => {
    const { getByRole, getByLabelText, queryByRole } = open()
    fireEvent.click(getByRole('button', { name: 'Pose' }))
    frames(4)
    fireEvent.change(getByLabelText('Rotation Y'), { target: { value: '40' } })
    frames(4)
    // The rotation gizmo is on the stage; the gestures are for an avatar that plays.
    expect(getByLabelText('Gizmo de rotation')).toBeTruthy()
    expect(queryByRole('button', { name: 'bounce' })).toBeNull()
  })

  it('opens the photo mode from the stage, with its tools, and leaves it', () => {
    const { getByRole, getAllByRole, queryByRole, getByText } = open()
    fireEvent.click(getByRole('button', { name: 'Ouvrir le mode photo' }))
    frames(4)
    expect(getByRole('heading', { level: 1 }).textContent).toBe('Mode photo')
    expect(getByText('Cadrage')).toBeTruthy()
    expect(getByText('Arrière-plan')).toBeTruthy()
    expect(getAllByRole('button', { name: /Prendre une photo/ }).length).toBeGreaterThan(0)
    // The tabs give way to the photo mode until it is left.
    expect(queryByRole('button', { name: 'États' })).toBeNull()
    fireEvent.click(getAllByRole('button', { name: 'Quitter' })[0])
    expect(getByRole('button', { name: 'États' })).toBeTruthy()
  })
})

describe('the picture of an avatar', () => {
  const avatar = loadStudioDocument().library.avatars[0]
  const definition = createAvatarDefinition({
    avatar,
    behavior: { expressions: [], sequences: [] },
  })
  if (!definition.ok) throw new Error('The fixture avatar has no definition.')
  const character = characterFromLegacyDefinition(definition.value)

  const plain = {
    background: 'transparent',
    colorFrom: '#f5f7fc',
    colorTo: '#dde4f5',
    size: 1024,
    composition: { x: 0, y: 0, scale: 1, cornerRadius: 0 },
  } as const

  it('is a standalone SVG of the avatar as the engine has it', () => {
    const engine = createAvatarEngine()
    setEnginePose(engine, { rotation: [0, 30, 0] })
    const bare = pictureSvg(character, engine, plain)
    expect(bare.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(bare).toContain('width="1024"')
    expect(bare).toContain(`fill="${character.colors.body}"`)
    expect(bare).not.toContain('NaN')
    // Another pose gives another picture.
    setEnginePose(engine, { rotation: [0, -30, 0] })
    expect(pictureSvg(character, engine, plain)).not.toBe(bare)
  })

  it('takes the background, the framing and the round corners of the photo mode', () => {
    const engine = createAvatarEngine()
    expect(pictureSvg(character, engine, plain)).not.toContain('<linearGradient')
    const solid = pictureSvg(character, engine, { ...plain, background: 'solid' })
    expect(solid).toContain('fill="#f5f7fc"')
    const framed = pictureSvg(character, engine, {
      ...plain,
      background: 'linear',
      size: 512,
      composition: { x: 12, y: -8, scale: 1.5, cornerRadius: 20 },
    })
    expect(framed).toContain('<linearGradient id="background"')
    expect(framed).toContain('translate(12 -8) scale(1.5)')
    expect(framed).toContain('rx="60"')
    expect(framed).toContain('width="512"')
    expect(pictureSvg(character, engine, { ...plain, background: 'radial' })).toContain(
      '<radialGradient'
    )
  })

  it('draws a spinner too', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'radar')
    for (let step = 0; step < 90; step += 1) advanceEngine(engine, 1 / 60)
    expect(pictureSvg(character, engine, plain)).toContain('stroke-linecap="round"')
  })
})
