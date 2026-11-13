import {
  normalizeSnapshotComposition,
  snapshotCornerRadius,
} from '@/features/editor/snapshotComposition'

describe('snapshot composition', () => {
  it('keeps framing values inside the authoring limits', () => {
    expect(
      normalizeSnapshotComposition({
        x: -400,
        y: 400,
        scale: 8,
        cornerRadius: 80,
      })
    ).toEqual({ x: -180, y: 180, scale: 3, cornerRadius: 50 })
  })

  it('converts a percentage radius into the 300-unit snapshot viewBox', () => {
    expect(snapshotCornerRadius(18)).toBe(54)
    expect(snapshotCornerRadius(50)).toBe(150)
  })
})
