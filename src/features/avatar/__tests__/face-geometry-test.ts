import { applyAvatarEyeDefaults, defaultAvatarEyes } from '@/features/avatar/avatars'
import { interpolatePose, poseFromExpression, renderAvatar } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import { surfacePointAt, surfacePresets } from '@/features/avatar/surfaces'

describe('facial geometry', () => {
  it('renders configurable eyes, a nose, a mouth and the trapezoid surface', () => {
    const expression = applyAvatarEyeDefaults(
      { ...defaultExpression, eyeShape: 'ellipse', mouthEnabled: true, mouthShape: 'ellipse' },
      { ...defaultAvatarEyes, noseEnabled: true }
    )
    const trapezoid = renderAvatar(poseFromExpression(expression), surfacePresets.trapezoid)

    expect(trapezoid.leftPath).not.toBe('')
    expect(trapezoid.nosePath).not.toBe('')
    expect(trapezoid.mouthPath).not.toBe('')
  })

  it('changes eye geometry between rounded and ellipse shapes', () => {
    const rounded = renderAvatar(
      poseFromExpression({ ...defaultExpression, eyeShape: 'rounded', eyeRoundness: 20 }),
      surfacePresets.sphere
    )
    const ellipse = renderAvatar(
      poseFromExpression({ ...defaultExpression, eyeShape: 'ellipse' }),
      surfacePresets.sphere
    )

    expect(rounded.leftPath).not.toBe(ellipse.leftPath)
  })

  it('continuously rounds the trapezoid surface', () => {
    const angular = { ...surfacePresets.trapezoid, roundness: 0 }
    const rounded = { ...surfacePresets.trapezoid, roundness: 5 }
    const angularPath = renderAvatar(poseFromExpression(defaultExpression), angular).headPath
    const roundedPath = renderAvatar(poseFromExpression(defaultExpression), rounded).headPath

    expect(surfacePointAt(angular, Math.PI / 2, 0.9)).not.toEqual(
      surfacePointAt(rounded, Math.PI / 2, 0.9)
    )
    expect(surfacePointAt(angular, Math.PI / 2, -Math.PI / 2)[0]).toBeCloseTo(
      (angular.width / 2) * (angular.topScale ?? 1)
    )
    expect(surfacePointAt(angular, Math.PI / 2, Math.PI / 2)[0]).toBeCloseTo(
      (angular.width / 2) * (angular.bottomScale ?? 1)
    )
    expect(angularPath).not.toContain('C')
    expect(roundedPath).toContain('C')
    expect(angularPath).not.toBe(roundedPath)
  })

  it('renders curve mouths as closed rounded bands like OneWorks', () => {
    const geometry = renderAvatar(
      poseFromExpression({
        ...defaultExpression,
        mouthEnabled: true,
        mouthShape: 'curve',
        mouthHeight: 14,
      }),
      surfacePresets.sphere
    )

    expect(geometry.mouthPath.endsWith('Z')).toBe(true)
    expect(geometry.mouthStrokeWidth).toBe(0)
  })

  it('switches discrete face choices halfway through a transition', () => {
    const from = poseFromExpression({
      ...defaultExpression,
      eyeShape: 'rounded',
      mouthEnabled: true,
      mouthShape: 'curve',
    })
    const to = poseFromExpression({
      ...defaultExpression,
      eyeShape: 'ellipse',
      mouthEnabled: false,
      mouthShape: 'ellipse',
    })

    expect(interpolatePose(from, to, 0.49).expression.eyeShape).toBe('rounded')
    expect(interpolatePose(from, to, 0.5).expression.eyeShape).toBe('ellipse')
    expect(interpolatePose(from, to, 0.5).expression.mouthEnabled).toBe(false)
  })

  it('uses the final mouth geometry immediately when its shape changes', () => {
    const from = poseFromExpression({
      ...defaultExpression,
      mouthEnabled: true,
      mouthShape: 'curve',
      mouthWidth: 20,
      mouthHeight: 6,
      mouthX: 0,
      mouthY: 35,
    })
    const to = poseFromExpression({
      ...defaultExpression,
      mouthEnabled: true,
      mouthShape: 'ellipse',
      mouthWidth: 48,
      mouthHeight: 22,
      mouthX: 9,
      mouthY: 27,
    })

    const firstFrame = interpolatePose(from, to, 0.01).expression

    expect(firstFrame).toMatchObject({
      mouthShape: 'ellipse',
      mouthWidth: 48,
      mouthHeight: 22,
    })
    expect(firstFrame.mouthX).toBeCloseTo(0.09)
    expect(firstFrame.mouthY).toBeCloseTo(34.92)
  })
})
