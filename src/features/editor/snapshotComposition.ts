export type SnapshotComposition = Readonly<{
  x: number
  y: number
  scale: number
  cornerRadius: number
}>

export const defaultSnapshotComposition: SnapshotComposition = {
  x: 0,
  y: 0,
  scale: 1,
  cornerRadius: 0,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

export const normalizeSnapshotComposition = (
  composition: SnapshotComposition
): SnapshotComposition => ({
  x: clamp(composition.x, -180, 180),
  y: clamp(composition.y, -180, 180),
  scale: clamp(composition.scale, 0.4, 3),
  cornerRadius: clamp(composition.cornerRadius, 0, 50),
})

export const snapshotCornerRadius = (cornerRadius: number) =>
  normalizeSnapshotComposition({
    ...defaultSnapshotComposition,
    cornerRadius,
  }).cornerRadius * 3
