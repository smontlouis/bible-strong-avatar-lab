import { buildRuntimeGuideText } from '@/features/studio/components/RuntimeGuideDialog'
import {
  agentGuideSections,
  reactNativeGuideSections,
  type GuideSection,
} from '@/features/studio/components/runtimeGuideSections'
import { translateStudioText } from '@/i18n'

const sourceStrings = (sections: readonly GuideSection[]) =>
  sections.flatMap(section => [
    section.title,
    ...(section.intro ? [section.intro] : []),
    ...section.blocks.flatMap(block =>
      block.kind === 'text'
        ? [block.text]
        : block.kind === 'list'
          ? [...block.items]
          : block.kind === 'rows'
            ? [...(block.title ? [block.title] : []), ...block.rows.map(row => row[2])]
            : []
    ),
  ])

describe('runtime usage guide copy', () => {
  it('copies the complete React guide with the selected animation', () => {
    const guide = buildRuntimeGuideText({
      animationKey: 'friendly-wave',
      integration: 'react',
      t: text => text,
    })

    expect(guide).toContain('# Guide d’utilisation de l’avatar React')
    expect(guide).toContain('npm install @bible-strong/avatar-react react react-dom')
    expect(guide).toContain('defaultAnimation="friendly-wave"')
    expect(guide).toContain('## Props de l’avatar')
    expect(guide).toContain('`onAnimationEnd`')
    expect(guide).toContain('## Avatar générique')
    expect(guide).toContain('## API impérative')
    expect(guide).toContain('`getState()`')
  })

  it('copies the complete JavaScript guide with browser and controller instructions', () => {
    const guide = buildRuntimeGuideText({
      integration: 'javascript',
      t: text => text,
    })

    expect(guide).toContain('# Guide d’utilisation de l’avatar JavaScript')
    expect(guide).toContain('npm install @bible-strong/avatar-web')
    expect(guide).toContain("defaultExpression: 'neutral'")
    expect(guide).toContain('## Options de createAvatar')
    expect(guide).toContain('`destroy()`')
    expect(guide).toContain('## Navigateur sans bundler')
    expect(guide).toContain("await fetch('./avatar.avatar.json')")
  })

  it('copies a React Native guide an agent can follow from install to verification', () => {
    const guide = buildRuntimeGuideText({
      animationKey: 'friendly-wave',
      integration: 'react-native',
      t: text => text,
    })

    expect(guide).toContain('# Guide d’utilisation de l’avatar React Native')
    expect(guide).toContain('npm install @bible-strong/avatar-react-native')
    expect(guide).toContain("importForwarding: { moduleNames: ['@bible-strong/avatar-core'] }")
    expect(guide).toContain('getBundleModeMetroConfig')
    expect(guide).toContain('animation="friendly-wave"')
    expect(guide).toContain('`settleAfterMs`')
    expect(guide).toContain('## Erreurs et corrections')
    expect(guide).toContain('`controlled_by_props`')
    expect(guide).toContain('## À ne pas faire')
    expect(guide).toContain('## Vérifier l’intégration')
  })

  it('ends the React and JavaScript guides with errors and a checklist', () => {
    for (const integration of ['react', 'javascript'] as const) {
      const guide = buildRuntimeGuideText({ integration, t: text => text })
      expect(guide).toContain('## Erreurs et corrections')
      expect(guide).toContain('`unknown_animation`')
      expect(guide).toContain('## Vérifier l’intégration')
    }
  })

  it('has every guide string in English and in Simplified Chinese', () => {
    const strings = new Set([
      ...sourceStrings(reactNativeGuideSections('idle')),
      ...sourceStrings(agentGuideSections('react')),
      ...sourceStrings(agentGuideSections('javascript')),
      'Guide d’utilisation de l’avatar React Native',
      'Installe le package, active le Bundle Mode, puis crée ton composant.',
      'JSON runtime + avatar-react-native',
      'Télécharge la définition .avatar.json et importe-la dans ton projet React Native. Le guide décrit la configuration à faire une fois.',
    ])
    for (const text of strings) {
      // « Installation » is the same word in English.
      if (text !== 'Installation') expect(translateStudioText(text, 'en'), text).not.toBe(text)
      expect(translateStudioText(text, 'zh-CN'), text).not.toBe(text)
    }
  })
})
