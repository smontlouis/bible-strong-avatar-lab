import { defaultAvatarEyes } from '@/features/avatar/avatars'
import { defaultExpression } from '@/features/avatar/presets'
import {
  applyTalkTransformOverride,
  createTalkTransformTransition,
  resolveTalkTransformOverride,
} from '@/features/talk/talkTransform'

describe('Talk Mode transform override', () => {
  it('converts visible position to expression-relative values', () => {
    const avatarEyes = {
      ...defaultAvatarEyes,
      positionX: 15,
      positionY: -10,
      positionZ: 30,
    }

    expect(resolveTalkTransformOverride({ tx: 40, tz: 90, ry: 20 }, avatarEyes)).toEqual({
      positionX: 25,
      positionZ: 60,
      headY: 20,
    })
  })

  it('overrides only declared axes', () => {
    const expression = {
      ...defaultExpression,
      positionX: 12,
      positionY: 8,
      headY: -5,
    }

    expect(applyTalkTransformOverride(expression, { positionX: 50, headY: 20 })).toMatchObject({
      positionX: 50,
      positionY: 8,
      headY: 20,
    })
  })

  it('releases omitted axes toward the underlying expression', () => {
    const transition = createTalkTransformTransition(
      { ...defaultExpression, positionX: 12, headY: -5 },
      { positionX: 50 },
      { headY: 20 }
    )

    expect(transition.from).toMatchObject({ positionX: 50, headY: -5 })
    expect(transition.to).toMatchObject({ positionX: 12, headY: 20 })
  })
})
