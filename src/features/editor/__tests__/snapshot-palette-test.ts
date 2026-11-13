import { randomSnapshotPalette, snapshotPaletteContrast } from '@/features/editor/snapshotPalette'

describe('snapshot background palettes', () => {
  it('returns a solid color for the solid style', () => {
    const palette = randomSnapshotPalette(
      'solid',
      '#FFFFFF',
      { colorFrom: '#000000', colorTo: '#000000' },
      () => 0
    )

    expect(palette.colorFrom).toBe(palette.colorTo)
    expect(snapshotPaletteContrast(palette.colorFrom, '#FFFFFF')).toBeGreaterThanOrEqual(3)
  })

  it.each(['linear', 'radial'] as const)('returns two compatible colors for %s', style => {
    const palette = randomSnapshotPalette(
      style,
      '#FFFFFF',
      { colorFrom: '#000000', colorTo: '#000000' },
      () => 0
    )

    expect(palette.colorFrom).not.toBe(palette.colorTo)
    expect(snapshotPaletteContrast(palette.colorFrom, '#FFFFFF')).toBeGreaterThanOrEqual(3)
    expect(snapshotPaletteContrast(palette.colorTo, '#FFFFFF')).toBeGreaterThanOrEqual(3)
  })

  it('creates a visibly deeper edge for radial backgrounds', () => {
    const palette = randomSnapshotPalette(
      'radial',
      '#FFFFFF',
      { colorFrom: '#000000', colorTo: '#000000' },
      () => 0.35
    )

    expect(snapshotPaletteContrast(palette.colorFrom, palette.colorTo)).toBeGreaterThanOrEqual(1.5)
  })

  it('does not immediately repeat the current palette', () => {
    const initial = randomSnapshotPalette(
      'linear',
      '#151515',
      { colorFrom: '#000000', colorTo: '#000000' },
      () => 0
    )
    const next = randomSnapshotPalette('linear', '#151515', initial, () => 0)

    expect(next).not.toEqual(initial)
  })

  it('produces broad hue variation instead of cycling through a short preset list', () => {
    const palettes = Array.from({ length: 12 }, (_, index) =>
      randomSnapshotPalette(
        'solid',
        '#FFFFFF',
        { colorFrom: '#000000', colorTo: '#000000' },
        () => index / 12
      )
    )

    expect(new Set(palettes.map(palette => palette.colorFrom)).size).toBe(12)
  })
})
