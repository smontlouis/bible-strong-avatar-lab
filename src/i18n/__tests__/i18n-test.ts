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

  it('translates every Photo Mode control to Simplified Chinese', () => {
    expect(translateStudioText('Mode photo', 'zh-CN')).toBe('照片模式')
    expect(translateStudioText('Dégradé radial', 'zh-CN')).toBe('径向渐变')
    expect(translateStudioText('Définition du mode photo', 'zh-CN')).toBe('照片模式分辨率')
    expect(translateStudioText('Télécharger en PNG', 'zh-CN')).toBe('下载 PNG')
    expect(translateStudioText('Prendre une photo', 'zh-CN')).toBe('拍照')
    expect(translateStudioText('Format d’export', 'zh-CN')).toBe('导出格式')
    expect(translateStudioText('Ouvrir le mode photo', 'en')).toBe('Open Photo Mode')
    expect(translateStudioText('Ouvrir le mode photo', 'zh-CN')).toBe('打开照片模式')
    expect(translateStudioText('Cadrage', 'en')).toBe('Framing')
    expect(translateStudioText('Recentrer le cadrage', 'zh-CN')).toBe('重置构图')
    expect(translateStudioText('Réinitialiser la pose et le cadrage', 'en')).toBe(
      'Reset pose and framing'
    )
    expect(translateStudioText('Réinitialiser la pose et le cadrage', 'zh-CN')).toBe(
      '重置姿态和构图'
    )
    expect(translateStudioText('Aléatoire', 'en')).toBe('Random')
    expect(translateStudioText('Aléatoire', 'zh-CN')).toBe('随机')
    expect(translateStudioText('Position, zoom et coins du cadre photo.', 'en')).toBe(
      'Position, zoom and photo frame corners.'
    )
    expect(translateStudioText('Orientation, regard, couleurs et perspective.', 'zh-CN')).toBe(
      '方向、视线、颜色和透视。'
    )
  })

  it('keeps every Talk Mode control synchronized in all three languages', () => {
    expect(translateStudioText('Talk Mode', 'fr')).toBe('Talk Mode')
    expect(translateStudioText('Ouvrir le Talk Mode', 'en')).toBe('Open Talk Mode')
    expect(translateStudioText('Talk Mode', 'zh-CN')).toBe('说话模式')
    expect(translateStudioText('Faire parler', 'en')).toBe('Speak')
    expect(translateStudioText('Faire parler', 'zh-CN')).toBe('开始说话')
    expect(translateStudioText('Hauteur de voix', 'en')).toBe('Pitch')
    expect(translateStudioText('Hauteur de voix', 'zh-CN')).toBe('音高')
    expect(translateStudioText('Pause de ponctuation', 'en')).toBe('Punctuation delay')
    expect(translateStudioText('Pause de ponctuation', 'zh-CN')).toBe('标点停顿')
    expect(translateStudioText('Ajouter une action', 'en')).toBe('Add an action')
    expect(translateStudioText('Ajouter une action', 'zh-CN')).toBe('添加动作')
    expect(translateStudioText('Retirer le tag', 'en')).toBe('Remove tag')
    expect(translateStudioText('Retirer le tag', 'zh-CN')).toBe('移除标签')
  })

  it('keeps runtime-export authoring copy synchronized in all three languages', () => {
    expect(translateStudioText('Clé sémantique', 'fr')).toBe('Clé sémantique')
    expect(translateStudioText('Clé sémantique', 'en')).toBe('Semantic key')
    expect(translateStudioText('Clé sémantique', 'zh-CN')).toBe('语义键')
    expect(translateStudioText('Exporter le JSON runtime', 'en')).toBe('Export runtime JSON')
    expect(translateStudioText('Exporter le JSON runtime', 'zh-CN')).toBe('导出运行时 JSON')
    expect(translateStudioText('JSON runtime + createAvatar', 'en')).toBe(
      'Runtime JSON + createAvatar'
    )
    expect(translateStudioText('JSON runtime + createAvatar', 'zh-CN')).toBe(
      '运行时 JSON + createAvatar'
    )
    expect(translateStudioText('JavaScript / ESM', 'en')).toBe('JavaScript / ESM')
    expect(translateStudioText('JSON runtime + avatar-web', 'zh-CN')).toBe(
      '运行时 JSON + avatar-web'
    )
    expect(translateStudioText('Guide d’utilisation de l’avatar JavaScript', 'en')).toBe(
      'JavaScript avatar usage guide'
    )
    expect(translateStudioText('Copier les instructions pour l’IA', 'en')).toBe(
      'Copy instruction for AI'
    )
    expect(translateStudioText('Copier les instructions pour l’IA', 'zh-CN')).toBe(
      '复制 AI 使用说明'
    )
    expect(translateStudioText('Preview de la définition exportée', 'en')).toBe(
      'Exported definition preview'
    )
    expect(translateStudioText('Animations exportées', 'zh-CN')).toBe('导出的动画')
    expect(
      translateStudioText(
        'Choisis les animations puis exporte le JSON runtime ou un package autonome.',
        'en'
      )
    ).toBe('Choose animations, then export runtime JSON or a standalone package.')
    expect(
      translateStudioText(
        'Choisis les animations puis exporte le JSON runtime ou un package autonome.',
        'zh-CN'
      )
    ).toBe('选择动画，然后导出运行时 JSON 或独立包。')
    expect(translateStudioText('Nouveau', 'en')).toBe('New')
    expect(translateStudioText('Nouveau', 'zh-CN')).toBe('新增')
    expect(translateStudioText('Lancer l’exemple', 'en')).toBe('Run example')
    expect(translateStudioText('Lancer l’exemple', 'zh-CN')).toBe('运行示例')
    expect(translateStudioText('Guide d’utilisation', 'en')).toBe('Usage guide')
    expect(translateStudioText('Guide d’utilisation', 'zh-CN')).toBe('使用指南')
    expect(translateStudioText('Le rendu Pixel est temporairement désactivé.', 'en')).toBe(
      'Pixel rendering is temporarily disabled.'
    )
    expect(translateStudioText('Le rendu Pixel est temporairement désactivé.', 'zh-CN')).toBe(
      '像素渲染暂时已禁用。'
    )
    expect(translateStudioText('Props de l’avatar', 'en')).toBe('Avatar props')
    expect(translateStudioText('Props de l’avatar', 'zh-CN')).toBe('头像 Props')
    expect(translateStudioText('Cible et lecture', 'en')).toBe('Target and playback')
    expect(translateStudioText('Présentation', 'zh-CN')).toBe('外观')
    expect(translateStudioText('API impérative', 'en')).toBe('Imperative API')
    expect(translateStudioText('API impérative', 'zh-CN')).toBe('命令式 API')
    expect(
      translateStudioText('Retourne l’animation, l’expression et le statut actifs.', 'en')
    ).toBe('Returns the active animation, expression and status.')
    expect(
      translateStudioText(
        'Utilise Avatar directement lorsque la définition est chargée à l’exécution ou change entre plusieurs avatars.',
        'en'
      )
    ).toBe(
      'Use Avatar directly when the definition is loaded at runtime or changes between multiple avatars.'
    )
    expect(
      translateStudioText(
        'createAvatar valide le JSON et retourne un composant dédié dont les clés d’animations sont typées.',
        'en'
      )
    ).toBe(
      'createAvatar validates the JSON and returns a dedicated component with typed animation keys.'
    )
    expect(
      translateStudioText(
        'Exporte le fichier .avatar.json utilisé par les nouveaux packages npm.',
        'en'
      )
    ).toBe('Export the .avatar.json file used by the new npm packages.')
    expect(
      translateStudioText(
        'Génère l’export ZIP autonome React ou JavaScript qui existait déjà.',
        'zh-CN'
      )
    ).toBe('生成原有的 React 或 JavaScript 独立 ZIP 导出。')
    expect(translateStudioText('Export runtime incomplet', 'en')).toBe(
      'Runtime export is incomplete'
    )
    expect(translateStudioText('Export runtime incomplet', 'zh-CN')).toBe('运行时导出不完整')
    expect(translateStudioText('Personnaliser', 'en')).toBe('Customize')
    expect(translateStudioText('Personnaliser', 'zh-CN')).toBe('自定义')
    expect(translateStudioText('Masquer la sélection', 'en')).toBe('Hide selection')
    expect(translateStudioText('Masquer la sélection', 'zh-CN')).toBe('隐藏选择')
    expect(translateStudioText('Expression de départ', 'en')).toBe('Starting expression')
    expect(translateStudioText('Expression de départ', 'zh-CN')).toBe('起始表情')
    expect(translateStudioText('Copier le JSON formaté', 'en')).toBe('Copy formatted JSON')
    expect(translateStudioText('Copier le JSON formaté', 'zh-CN')).toBe('复制格式化的 JSON')
    expect(translateStudioText('JSON runtime copié dans le presse-papiers.', 'en')).toBe(
      'Runtime JSON copied to the clipboard.'
    )
    expect(translateStudioText('JSON runtime copié dans le presse-papiers.', 'zh-CN')).toBe(
      '运行时 JSON 已复制到剪贴板。'
    )
  })

  it('covers every configured state description in English', () => {
    expect(translateStudioText('Rythme régulier et expressions concentrées.', 'en')).toBe(
      'Steady rhythm and focused expressions.'
    )
    expect(translateStudioText('Grandes expressions et transitions rapides.', 'en')).toBe(
      'Big expressions and fast transitions.'
    )
    expect(translateStudioText('Inclinaisons et forte asymétrie.', 'en')).toBe(
      'Tilts and strong asymmetry.'
    )
  })
})
