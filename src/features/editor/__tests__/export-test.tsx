// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { Editor } from '@/features/editor/Editor'
import { agentInstructions, avatarNames, integrations } from '@/features/editor/ExportPanel'
import { StudioLanguageProvider } from '@/i18n'

describe('the names an avatar takes in code', () => {
  it('come from its name: a file, a value and a component', () => {
    expect(avatarNames('Grok bot')).toEqual({
      name: 'Grok bot',
      file: 'grok-bot.avatar.json',
      value: 'grokBot',
      component: 'GrokBot',
    })
    expect(avatarNames('3D Ball').value).toBe('avatar3dBall')
    expect(avatarNames('  ').file).toBe('avatar.avatar.json')
  })
})

describe('the instructions for a coding agent', () => {
  const names = avatarNames('Kirby')

  it('are the package README, with its example avatar renamed after this one', () => {
    for (const integration of integrations) {
      const text = agentInstructions(integration, names)
      expect(text).toContain(`# Add the avatar “Kirby” with ${integration.packageName}`)
      expect(text).toContain('`kirby.avatar.json`')
      expect(text).toContain(integration.readme.split('\n')[0])
      expect(text).not.toMatch(/\bstrobi\b|\bStrobi\b/)
      expect(text).toMatch(/\bkirby\b/)
    }
  })

  it('carry the setup each package needs, React Native its Bundle Mode', () => {
    const native = integrations.find(item => item.id === 'react-native')!
    const text = agentInstructions(native, names)
    expect(text).toContain('Bundle Mode')
    expect(text).toContain("importForwarding: { moduleNames: ['@bible-strong/avatar-core'] }")
    expect(text).toContain('<Kirby state=')
    const web = integrations.find(item => item.id === 'web')!
    expect(agentInstructions(web, names)).toContain('setLookAt')
  })
})

describe('the Export tab', () => {
  let pending = new Map<number, FrameRequestCallback>()
  let nextFrame = 1
  beforeEach(() => {
    pending = new Map()
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

  it('gives each integration its install, its example and its instructions to copy', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(
      <StudioLanguageProvider>
        <Editor />
      </StudioLanguageProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }))
    expect(screen.getByRole('button', { name: /Télécharger strobi\.avatar\.json/ })).toBeTruthy()
    expect(screen.getByLabelText('Installation').textContent).toBe(
      'npm install @bible-strong/avatar-react'
    )

    fireEvent.click(screen.getByRole('button', { name: /^React Native ·/ }))
    expect(screen.getByLabelText('Installation').textContent).toContain('react-native-worklets')
    expect(screen.getByLabelText('Utilisation minimale').textContent).toContain(
      "import strobi from './strobi.avatar.json'"
    )
    expect(
      screen.getByRole('link', { name: /Voir le guide complet/ }).getAttribute('href')
    ).toMatch(/packages\/avatar-react-native#readme$/)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copier les instructions pour l’IA/ }))
    })
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('@bible-strong/avatar-react-native')
    expect(screen.getByRole('status').textContent).toBe(
      'Instructions copiées dans le presse-papiers.'
    )
  })
})
