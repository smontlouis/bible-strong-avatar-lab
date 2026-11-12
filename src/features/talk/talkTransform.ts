import { defaultAvatarEyes, type AvatarEyeDefaults } from '@/features/avatar/avatars'
import type { Expression } from '@/features/avatar/geometry'
import type { TalkTransform } from '@/features/talk/talkScript'

export const talkExpressionTransformFields = [
  'positionX',
  'positionY',
  'positionZ',
  'headX',
  'headY',
  'headZ',
] as const

export type TalkExpressionTransformField = (typeof talkExpressionTransformFields)[number]
export type TalkExpressionTransformOverride = Partial<Record<TalkExpressionTransformField, number>>

export const resolveTalkTransformOverride = (
  transform: TalkTransform,
  avatarEyes: AvatarEyeDefaults
): TalkExpressionTransformOverride => ({
  ...(transform.tx === undefined
    ? {}
    : {
        positionX: transform.tx - avatarEyes.positionX + defaultAvatarEyes.positionX,
      }),
  ...(transform.ty === undefined
    ? {}
    : {
        positionY: transform.ty - avatarEyes.positionY + defaultAvatarEyes.positionY,
      }),
  ...(transform.tz === undefined
    ? {}
    : {
        positionZ: transform.tz - avatarEyes.positionZ + defaultAvatarEyes.positionZ,
      }),
  ...(transform.rx === undefined ? {} : { headX: transform.rx }),
  ...(transform.ry === undefined ? {} : { headY: transform.ry }),
  ...(transform.rz === undefined ? {} : { headZ: transform.rz }),
})

export const applyTalkTransformOverride = (
  expression: Expression,
  override: TalkExpressionTransformOverride
): Expression => ({ ...expression, ...override })

export const createTalkTransformTransition = (
  expression: Expression,
  currentOverride: TalkExpressionTransformOverride,
  nextOverride: TalkExpressionTransformOverride
) => ({
  from: talkExpressionTransformFields.reduce<TalkExpressionTransformOverride>(
    (values, field) => ({
      ...values,
      [field]: currentOverride[field] ?? expression[field],
    }),
    {}
  ),
  to: talkExpressionTransformFields.reduce<TalkExpressionTransformOverride>(
    (values, field) => ({
      ...values,
      [field]: nextOverride[field] ?? expression[field],
    }),
    {}
  ),
})
