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
  it('opens on the character, with the avatars of the library and no expression or animation', () => {
    const { getByRole, queryByText, getAllByRole } = open()
    expect(getByRole('button', { name: 'Personnage' }).getAttribute('aria-current')).toBe('page')
    expect(getByRole('button', { name: 'Strobi' })).toBeTruthy()
    expect(getByRole('button', { name: 'Kirby' })).toBeTruthy()
    expect(queryByText('Expressions')).toBeNull()
    expect(queryByText('Animations')).toBeNull()
    expect(getAllByRole('button').some(button => button.textContent === 'États')).toBe(true)
  })

  it('plays a state picked in the States tab and says which clip plays', () => {
    const { getByRole, getAllByText } = open()
    fireEvent.click(getByRole('button', { name: 'États' }))
    fireEvent.click(getByRole('button', { name: 'finished' }))
    frames(30)
    expect(getAllByText(/Done_B/).length).toBeGreaterThan(0)
  })

  it('shows the nine faces and holds the one that is picked', () => {
    const { getByRole, getAllByText } = open()
    fireEvent.click(getByRole('button', { name: 'Visages' }))
    expect(getAllByText('Ne cligne pas').length).toBe(6)
    fireEvent.click(getByRole('button', { name: /happy/ }))
    fireEvent.click(getByRole('button', { name: 'Clips' }))
    frames(40)
    expect(getAllByText(/happy/).length).toBeGreaterThan(0)
  })

  it('renames the avatar and keeps the name after a reload', () => {
    const first = open()
    fireEvent.change(first.getByLabelText('Nom'), { target: { value: 'Strobi bis' } })
    first.unmount()
    expect(loadStudioDocument().library.avatars[0].name).toBe('Strobi bis')
    const { getByRole } = open()
    expect(getByRole('button', { name: 'Strobi bis' })).toBeTruthy()
  })

  it('adds an avatar and makes it the one on the stage', () => {
    const { getByRole, getByLabelText } = open()
    fireEvent.click(getByRole('button', { name: 'Nouveau' }))
    expect((getByLabelText('Nom') as HTMLInputElement).value).toBe('Nouvel avatar')
    expect(loadStudioDocument().library.avatars.at(-1)?.name).toBe('Nouvel avatar')
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

  it('is a standalone SVG of the avatar as the engine has it, on a background or on none', () => {
    const engine = createAvatarEngine()
    setEnginePose(engine, { rotation: [0, 30, 0] })
    const bare = pictureSvg(character, engine, null)
    expect(bare.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(bare).toContain(`fill="${character.colors.body}"`)
    expect(bare).not.toContain('<rect')
    expect(bare).not.toContain('NaN')
    expect(pictureSvg(character, engine, '#eef1f8')).toContain('<rect')
    // Another pose gives another picture.
    setEnginePose(engine, { rotation: [0, -30, 0] })
    expect(pictureSvg(character, engine, null)).not.toBe(bare)
  })

  it('draws a spinner too', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'radar')
    for (let step = 0; step < 90; step += 1) advanceEngine(engine, 1 / 60)
    expect(pictureSvg(character, engine, null)).toContain('stroke-linecap="round"')
  })
})
