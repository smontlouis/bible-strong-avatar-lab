import { migrateBundledAvatarColors } from '@/features/avatar/avatars'
import {
  avatarBodyOutlineWidth,
  resolveAvatarNodeColor,
} from '@/features/rendering/avatarAppearance'

describe('outlined avatar appearance', () => {
  it('uses the same fixed body outline width for every avatar', () => {
    expect(avatarBodyOutlineWidth()).toBe(12)
  })

  it('migrates bundled avatar colors to Deslop accent tokens', () => {
    expect(migrateBundledAvatarColors('strobi', { body: '#5b7fe5', eyes: '#111316' })).toEqual({
      body: '#7c89ff',
      eyes: '#50d7fe',
    })
  })

  it('preserves user-customized colors', () => {
    expect(migrateBundledAvatarColors('strobi', { body: '#123456', eyes: '#654321' })).toEqual({
      body: '#123456',
      eyes: '#654321',
    })
  })

  it('lets an explicit expression color tint fixed-color body parts', () => {
    expect(
      resolveAvatarNodeColor({
        nodeColor: '#a95f47',
        bodyColor: '#ba3636',
        expressionBodyColor: '#ba3636',
      })
    ).toBe('#ba3636')
    expect(resolveAvatarNodeColor({ nodeColor: '#a95f47', bodyColor: '#e3b17f' })).toBe('#a95f47')
  })
})
