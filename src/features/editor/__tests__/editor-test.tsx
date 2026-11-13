// @vitest-environment jsdom
import {
  createAvatarEngine,
  setEnginePose,
  setEngineState,
  advanceEngine,
} from '@bible-strong/avatar-core'
import { act, fireEvent, render } from '@testing-library/react'
import { vi } from 'vitest'

import { avatarFromSource, characterOfAvatar } from '@/features/editor/avatar'
import { loadLibrary } from '@/features/editor/document'
import { Editor } from '@/features/editor/Editor'
import { pictureSvg } from '@/features/editor/picture'
import { StudioLanguageProvider } from '@/i18n'

// Each frame asked for, by its number: cancelling one leaves the others.
let pending = new Map<number, FrameRequestCallback>()
let nextFrame = 1
let clock = 0
const frames = (count: number) => {
  act(() => {
    for (let index = 0; index < count; index += 1) {
      clock += 1000 / 60
      const due = [...pending.values()]
      pending = new Map()
      due.forEach(callback => callback(clock))
    }
  })
}

beforeEach(() => {
  pending = new Map()
  clock = 0
  window.localStorage.clear()
  window.localStorage.setItem('avatar-studio-language', 'fr')
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame++
    pending.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id))
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

  it('stops a clip on the keyframe that is picked and shows its curves and its easing', () => {
    const { getByRole, getAllByRole, getByText, container } = open()
    fireEvent.click(getByRole('button', { name: 'Clips' }))
    fireEvent.click(getByRole('button', { name: 'Working_B' }))
    frames(60)
    const keys = getAllByRole('button').filter(button =>
      button.getAttribute('aria-label')?.startsWith('Rotation · ')
    )
    expect(keys).toHaveLength(6)
    fireEvent.click(keys[1])
    frames(2)
    // The clip is paused on the key, whose time the clock shows.
    expect(getByRole('button', { name: 'Lecture' })).toBeTruthy()
    expect(container.querySelector('[data-joining] span.font-mono')?.textContent).toBe(
      '1.41 s / 4.80 s'
    )
    expect(getByText('Bézier →')).toBeTruthy()
    // One curve for each of the three angles, each with a point for every key.
    const points = getAllByRole('button').filter(button =>
      /^[XYZ] · /.test(button.getAttribute('aria-label') ?? '')
    )
    expect(points).toHaveLength(18)
    expect(getByText(/Utilisé par : reading/)).toBeTruthy()
  })

  it('leaves a state for its clip when a keyframe is picked, until the state is resumed', () => {
    const { getByRole, getAllByRole, getByText, queryByText } = open()
    fireEvent.click(getByRole('button', { name: 'États' }))
    fireEvent.click(getByRole('button', { name: 'finished' }))
    frames(30)
    expect(getByText('Clip courant')).toBeTruthy()
    const keys = getAllByRole('button').filter(button =>
      button.getAttribute('aria-label')?.startsWith('Étirement · ')
    )
    fireEvent.click(keys[1])
    frames(12)
    // The state is still the one shown, but its clip now plays alone.
    expect(getByText('Clip seul')).toBeTruthy()
    expect(getByRole('heading', { name: 'finished' })).toBeTruthy()
    expect(getByText('Boucle')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Reprendre l’état' }))
    frames(12)
    expect(queryByText('Clip seul')).toBeNull()
    expect(getByText('Clip courant')).toBeTruthy()
  })

  it('stops the avatar at rest with the stop button, and starts it anew with play', () => {
    const { getByRole, container } = open()
    const stage = () => container.querySelector('.avatar-wrap svg')!
    fireEvent.click(getByRole('button', { name: 'États' }))
    fireEvent.click(getByRole('button', { name: 'thinking' }))
    frames(60)
    fireEvent.click(getByRole('button', { name: 'Arrêter thinking' }))
    frames(30)
    const still = stage().innerHTML
    frames(60)
    expect(stage().innerHTML).toBe(still)
    expect(container.querySelector('.state-player')!.getAttribute('aria-label')).toBe(
      'Arrêté : thinking'
    )
    fireEvent.click(getByRole('button', { name: 'Reprendre thinking' }))
    frames(30)
    expect(container.querySelector('.state-player')!.getAttribute('aria-label')).toBe(
      'En lecture : thinking'
    )
    frames(30)
    expect(stage().innerHTML).not.toBe(still)
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
    expect(loadLibrary().avatars[0].name).toBe('Strobi bis')
    const { getByRole } = open()
    expect(getByRole('button', { name: 'Strobi bis' })).toBeTruthy()
  })

  it('adds an avatar and opens it to be built', () => {
    const { getByRole, getByLabelText } = open()
    fireEvent.click(getByRole('button', { name: 'Ajouter un avatar' }))
    expect((getByLabelText('Nom de l’avatar') as HTMLInputElement).value).toBe('Nouvel avatar')
    expect(loadLibrary().avatars.at(-1)?.name).toBe('Nouvel avatar')
  })

  it('stops the avatar and lets it be turned by hand in the Pose tab', () => {
    const { getByRole, getByLabelText, queryByRole } = open()
    // Gestures are a toy of the pose tool: the stage only offers the photo mode.
    expect(queryByRole('button', { name: 'bounce' })).toBeNull()
    expect(getByRole('button', { name: 'Ouvrir le mode photo' })).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Pose' }))
    frames(4)
    fireEvent.change(getByLabelText('Rotation Y'), { target: { value: '40' } })
    frames(4)
    expect(getByLabelText('Gizmo de rotation')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'bounce' }))
    frames(10)
    expect(getByRole('switch', { name: 'Suit le pointeur' })).toBeTruthy()
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
  const character = characterOfAvatar(loadLibrary().avatars[0])

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

describe('an avatar saved as a file', () => {
  it('comes back with its body, its colours and its face', () => {
    const avatar = loadLibrary().avatars.find(item => item.body.nodes.length > 0)!
    const character = characterOfAvatar(avatar)
    const back = avatarFromSource(JSON.stringify(character))
    expect(back.id).not.toBe(avatar.id)
    expect(characterOfAvatar(back)).toEqual(character)
  })

  it('carries the size and the gap of the eyes, and keeps them within bounds', () => {
    const avatar = loadLibrary().avatars[0]
    const built = { ...avatar, eyes: { ...avatar.eyes, eyeScale: 1.3, eyeGap: 0.8 } }
    const character = characterOfAvatar(built)
    expect(character.face.eyes).toMatchObject({ width: 1.3, height: 1.3, gap: 0.8 })
    expect(avatarFromSource(JSON.stringify(character)).eyes).toMatchObject({
      eyeScale: 1.3,
      eyeGap: 0.8,
    })
    const wild = {
      ...character,
      face: { ...character.face, eyes: { ...character.face.eyes, width: 9, gap: 0 } },
    }
    expect(avatarFromSource(JSON.stringify(wild)).eyes).toMatchObject({
      eyeScale: 1.6,
      eyeGap: 0.6,
    })
  })

  it('carries the perspective, flat for the bot drawn after the reference', () => {
    const avatars = loadLibrary().avatars
    expect(characterOfAvatar(avatars[0]).face.perspective).toBe(1)
    const flat = characterOfAvatar(avatars.find(avatar => avatar.name === 'Grok bot')!)
    expect(flat.face.perspective).toBe(0)
    expect(avatarFromSource(JSON.stringify(flat)).eyes.perspective).toBe(0)
  })

  it('refuses a file that holds no avatar', () => {
    expect(() => avatarFromSource('not json')).toThrow()
    expect(() => avatarFromSource('{"version":2}')).toThrow()
  })
})
