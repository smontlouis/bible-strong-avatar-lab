import { translateStudioText } from '@/i18n'

describe('avatar studio translations', () => {
  it('uses English for static interface copy', () => {
    expect(translateStudioText('Couleur des yeux', 'en')).toBe('Eye color')
  })

  it('translates dynamic editor labels', () => {
    expect(translateStudioText('Modifier l’expression 08', 'en')).toBe('Edit expression 08')
    expect(translateStudioText('Sphère · porte les yeux', 'en')).toBe('Sphere · carries the eyes')
    expect(translateStudioText('Cône 1 copie', 'en')).toBe('Cone 1 copy')
  })

  it('keeps the original French copy in French', () => {
    expect(translateStudioText('Nouvel avatar', 'fr')).toBe('Nouvel avatar')
    expect(translateStudioText('sleeping', 'fr')).toBe('sommeil')
  })

  it('translates the studio interface and dynamic labels to Simplified Chinese', () => {
    expect(translateStudioText('Couleur des yeux', 'zh-CN')).toBe('眼睛颜色')
    expect(translateStudioText('Modifier l’expression 08', 'zh-CN')).toBe('编辑表情 08')
    expect(translateStudioText('sleeping', 'zh-CN')).toBe('睡眠')
  })

  it('translates the Photo Mode controls', () => {
    expect(translateStudioText('Mode photo', 'zh-CN')).toBe('照片模式')
    expect(translateStudioText('Dégradé radial', 'zh-CN')).toBe('径向渐变')
    expect(translateStudioText('Définition du mode photo', 'zh-CN')).toBe('照片模式分辨率')
    expect(translateStudioText('Prendre une photo', 'zh-CN')).toBe('拍照')
    expect(translateStudioText('Format d’export', 'zh-CN')).toBe('导出格式')
    expect(translateStudioText('Ouvrir le mode photo', 'en')).toBe('Open Photo Mode')
    expect(translateStudioText('Ouvrir le mode photo', 'zh-CN')).toBe('打开照片模式')
    expect(translateStudioText('Cadrage', 'en')).toBe('Framing')
    expect(translateStudioText('Recentrer le cadrage', 'zh-CN')).toBe('重置构图')
    expect(translateStudioText('Aléatoire', 'en')).toBe('Random')
    expect(translateStudioText('Position, zoom et coins du cadre photo.', 'en')).toBe(
      'Position, zoom and photo frame corners.'
    )
  })

  it('translates the Export tab in all three languages', () => {
    expect(translateStudioText('Intégration', 'fr')).toBe('Intégration')
    expect(translateStudioText('Intégration', 'en')).toBe('Integration')
    expect(translateStudioText('Intégration', 'zh-CN')).toBe('集成')
    expect(translateStudioText('Copier les instructions pour l’IA', 'en')).toBe(
      'Copy instructions for AI'
    )
    expect(translateStudioText('Copier les instructions pour l’IA', 'zh-CN')).toBe(
      '复制 AI 使用说明'
    )
    expect(translateStudioText('Instructions copiées dans le presse-papiers.', 'en')).toBe(
      'Instructions copied to the clipboard.'
    )
    expect(translateStudioText('Impossible de copier les instructions.', 'zh-CN')).toBe(
      '无法复制说明。'
    )
    expect(translateStudioText('Navigateur, sans framework', 'en')).toBe('Browser, no framework')
    expect(translateStudioText('Utilisation minimale', 'en')).toBe('Minimal usage')
  })

  it('translates the weight of a clip drawn more often than the others', () => {
    expect(translateStudioText('Sort 3 fois plus souvent', 'en')).toBe('Comes out 3 times as often')
    expect(translateStudioText('Sort 3 fois plus souvent', 'zh-CN')).toBe('出现频率为 3 倍')
  })
})
