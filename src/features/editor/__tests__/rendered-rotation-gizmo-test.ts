import { restExpression as defaultExpression } from '@/features/editor/utils'
import {
  createRenderedRotationGizmo,
  paintRenderedRotationGizmo,
} from '@/features/editor/renderedRotationGizmo'

describe('rendered rotation gizmo', () => {
  it('updates its rings without requiring a React render', () => {
    const gizmo = createRenderedRotationGizmo(defaultExpression)
    const initialXPath = gizmo.xPath.get()
    const initialYPath = gizmo.yPath.get()

    paintRenderedRotationGizmo(gizmo, {
      ...defaultExpression,
      headX: 28,
      headY: -36,
      headZ: 17,
    })

    expect(gizmo.xPath.get()).not.toBe(initialXPath)
    expect(gizmo.yPath.get()).not.toBe(initialYPath)
  })
})
