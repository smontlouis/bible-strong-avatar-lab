import {
  surfaceField,
  surfacePointAt,
  surfacePresets,
  surfaceTracePointAt,
  type SurfaceConfig,
} from '../index'

const variants: SurfaceConfig[] = [
  ...Object.values(surfacePresets),
  { ...surfacePresets.sphere, width: 180, height: 260, depth: 120 },
  { ...surfacePresets.cube, roundness: 0.4 },
  { ...surfacePresets.cube, roundness: 1.6 },
  { ...surfacePresets.diamond, roundness: 1.2 },
  { ...surfacePresets.capsule, width: 260, height: 180 },
  { ...surfacePresets.cylinder, roundness: 0 },
  { ...surfacePresets.cylinder, roundness: 1, morphRoundness: 1 },
  { ...surfacePresets.cone, tipRoundness: 0.8, baseRoundness: 0.6 },
  { ...surfacePresets.cone, morphRoundness: 1.2 },
  { ...surfacePresets.cursor, roundness: 0.6 },
  { ...surfacePresets.trapezoid, roundness: 2 },
  { ...surfacePresets.trapezoid, roundness: 5, topScale: 0.5, bottomScale: 1.3 },
]

const label = (surface: SurfaceConfig) => JSON.stringify(surface)

describe('surface fields', () => {
  it.each(variants.map(surface => [label(surface), surface] as const))(
    'is zero on the surface, negative inside and positive outside: %s',
    (_, surface) => {
      const field = surfaceField(surface)
      const centerY = surface.type === 'cursor' ? surface.height * 0.18 : 0
      expect(field(0, centerY, 0)).toBeLessThan(0)
      for (let row = 0; row <= 12; row += 1) {
        for (let column = 0; column < 24; column += 1) {
          const latitude = -Math.PI / 2 + (row / 12) * Math.PI
          const longitude = -Math.PI + (column / 24) * Math.PI * 2
          for (const pointAt of [surfacePointAt, surfaceTracePointAt]) {
            const [x, y, z] = pointAt(surface, longitude, latitude)
            expect(Math.abs(field(x, y, z))).toBeLessThan(0.02)
            const towards = (ratio: number) =>
              field(x * ratio, centerY + (y - centerY) * ratio, z * ratio)
            expect(towards(0.7)).toBeLessThan(0)
            expect(towards(1.4)).toBeGreaterThan(0)
          }
        }
      }
    }
  )

  it.each(variants.map(surface => [label(surface), surface] as const))(
    'falls until a line enters the solid, and rises once it has left: %s',
    (_, surface) => {
      const field = surfaceField(surface)
      const size = Math.max(surface.width, surface.height, surface.depth)
      const centerY = surface.type === 'cursor' ? surface.height * 0.18 : 0
      for (let line = 0; line < 200; line += 1) {
        // Lines through points spread inside the solid, in varied directions.
        const through = [
          Math.sin(line * 1.3) * surface.width * 0.2,
          centerY + Math.sin(line * 2.1) * surface.height * 0.2,
          Math.sin(line * 0.7) * surface.depth * 0.2,
        ]
        const direction = [Math.sin(line), Math.cos(line * 1.7), Math.sin(line * 0.4 + 1)]
        const length = Math.hypot(direction[0], direction[1], direction[2])
        const values: number[] = []
        for (let step = -200; step <= 200; step += 1) {
          const distance = ((step / 200) * size * 1.5) / length
          values.push(
            field(
              through[0] + direction[0] * distance,
              through[1] + direction[1] * distance,
              through[2] + direction[2] * distance
            )
          )
        }
        const enters = values.findIndex(value => value <= 0)
        const leaves = values.length - 1 - [...values].reverse().findIndex(value => value <= 0)
        if (enters < 0) continue
        for (let index = 1; index < enters; index += 1) {
          expect(values[index]).toBeLessThan(values[index - 1] + 1e-9)
        }
        for (let index = leaves + 2; index < values.length; index += 1) {
          expect(values[index]).toBeGreaterThan(values[index - 1] - 1e-9)
        }
      }
    }
  )
})
