import {
  blendExpressionTransitionTarget,
  scaleEye,
  updateEyeDimension,
  updateEyePosition,
} from '@/features/avatar/expressionEditing'
import { defaultExpression } from '@/features/avatar/presets'

describe('Expression eye editing', () => {
  it('applies linked dimensions through one invariant-preserving operation', () => {
    const next = updateEyeDimension(defaultExpression, 'Left', 'width', 140, true)
    expect(next.widthLeft).toBe(100)
    expect(next.widthRight).toBe(100)
  })

  it('scales both eyes proportionally without exceeding eye bounds', () => {
    const next = scaleEye(defaultExpression, 'Left', 100, true)
    expect(next.heightLeft).toBe(100)
    expect(next.widthLeft).toBe(40)
    expect(next.heightRight).toBe(100)
    expect(next.widthRight).toBe(40)
  })

  it('keeps linked eye positions symmetrical as an editing rule', () => {
    const next = updateEyePosition(defaultExpression, 'Right', 'Y', 12, true)
    expect(next.positionYLeft).toBe(12)
    expect(next.positionYRight).toBe(12)
  })
})

describe('Expression transition retargeting', () => {
  it('snaps the configured mouth geometry when a rapid retarget changes its shape', () => {
    const from = {
      ...defaultExpression,
      mouthShape: 'curve' as const,
      mouthWidth: 20,
      mouthHeight: 6,
      mouthX: 0,
      mouthY: 35,
    }
    const to = {
      ...defaultExpression,
      mouthShape: 'ellipse' as const,
      mouthWidth: 52,
      mouthHeight: 24,
      mouthX: 8,
      mouthY: 27,
      headY: 30,
    }

    const firstRetargetFrame = blendExpressionTransitionTarget(from, to, 0.01, true)

    expect(firstRetargetFrame).toMatchObject({
      mouthShape: 'ellipse',
      mouthWidth: 52,
      mouthHeight: 24,
    })
    expect(firstRetargetFrame.mouthX).toBeCloseTo(0.08)
    expect(firstRetargetFrame.mouthY).toBeCloseTo(34.92)
    expect(firstRetargetFrame.headY).toBeCloseTo(0.3)
  })
})
