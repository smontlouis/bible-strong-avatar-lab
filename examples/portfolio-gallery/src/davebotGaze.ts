// Davebot's cursor gaze.
//
// The engine owns playback, blinking and body drift. Gaze is layered on top by
// translating the two existing eye paths, which sit inside a group clipped to
// the head silhouette.
//
// The clip is NOT a safety net worth relying on: a cut-off pupil reads as a
// rendering bug, not as anatomy. Nor is the budget fixed, because the engine's
// own expressions already displace and reshape the eyes before gaze is applied
// — measured, they swing an eye centre across roughly 100 units. So every frame
// the reach is capped to the room actually left inside the head, measured from
// live geometry. See the clamp in `paint`.
//
// Direction is exact: the offset is the unit vector to the pointer. Magnitude
// uses the angle to the pointer rather than a linear distance ramp:
//
//   gain = distance / hypot(distance, depth)   =   sin(atan2(distance, depth))
//
// That is the projection of a real eyeball rotating to face a target `depth`
// away, so it saturates — once the pointer is well past the knee the eye holds
// near-full deflection and keeps pointing straight at it, which is what reads
// as "looking at you". A linear ramp instead keeps drifting and reads as vague.

export type GazeSettings = {
  /** Requested pupil displacement in SVG units (viewBox is 300 wide). The
   * per-frame clip budget may cap the applied value below this. */
  travel: number
  /** Perceived distance to Davebot in screen px; sets how fast gaze saturates. */
  depth: number
  /** Exponential follow, 0 = locked to the pointer, 0.9 = slow and floaty. */
  smoothing: number
  /** Inward eye rotation for near targets, 0 = parallel eyes, 1 = strongly crossed. */
  convergence: number
  /** Whole-body lean toward the pointer at full deflection, in screen px. */
  lean: number
}

export const GAZE_DEFAULTS: GazeSettings = {
  travel: 30,
  depth: 260,
  smoothing: 0.18,
  convergence: 0.35,
  lean: 3,
}

// `travel` may be pushed to 48 because the per-frame clamp guarantees the pupils
// stay inside the head; past roughly 30 it simply spends more frames held at the
// silhouette edge. Measured: travel 30 is capped on 14% of frames, 36 on 33%,
// 48 on 81%.
export const GAZE_LIMITS: Record<keyof GazeSettings, { min: number; max: number; step: number }> = {
  travel: { min: 0, max: 48, step: 1 },
  depth: { min: 40, max: 900, step: 10 },
  smoothing: { min: 0, max: 0.9, step: 0.01 },
  convergence: { min: 0, max: 1, step: 0.01 },
  lean: { min: 0, max: 12, step: 0.5 },
}

export const GAZE_PRESETS: Record<string, GazeSettings> = {
  Subtle: { travel: 14, depth: 460, smoothing: 0.34, convergence: 0.15, lean: 1 },
  Balanced: GAZE_DEFAULTS,
  // Lock-on comes from the low `depth` knee, not raw amplitude; a larger travel
  // here would just sit clamped and lose its sense of response.
  'Locked on': { travel: 34, depth: 110, smoothing: 0.04, convergence: 0.5, lean: 6 },
}

const STORAGE_KEY = 'davebot-gaze-settings'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const sanitize = (raw: Partial<GazeSettings> | null | undefined): GazeSettings => {
  const merged = { ...GAZE_DEFAULTS, ...(raw ?? {}) }
  const keys = Object.keys(GAZE_DEFAULTS) as (keyof GazeSettings)[]
  const result = { ...GAZE_DEFAULTS }
  for (const key of keys) {
    const value = Number(merged[key])
    const limit = GAZE_LIMITS[key]
    result[key] = Number.isFinite(value) ? clamp(value, limit.min, limit.max) : GAZE_DEFAULTS[key]
  }
  return result
}

export const loadGazeSettings = (): GazeSettings => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? sanitize(JSON.parse(stored) as Partial<GazeSettings>) : { ...GAZE_DEFAULTS }
  } catch {
    // A blocked or corrupt store must never stop Davebot from rendering.
    return { ...GAZE_DEFAULTS }
  }
}

export const saveGazeSettings = (settings: GazeSettings): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Persisting the tuning is a convenience, not a requirement.
  }
}

// Support function of an axis-aligned box with half-extents a and b along a unit
// direction: the furthest any point of that box reaches along u. The eye's own
// bounding box contains the eye whatever its shape or rotation, so bounding the
// box bounds the eye. The ellipse boundary radius is smaller than this and would
// under-report the reach, which is what let the eye cross the silhouette.
const boxSupport = (a: number, b: number, ux: number, uy: number): number =>
  a * Math.abs(ux) + b * Math.abs(uy)

// Largest t >= 0 with |c + t*u| <= limit, i.e. how far a point may advance
// along a direction before leaving a circle of that radius.
const maxAdvance = (cx: number, cy: number, ux: number, uy: number, limit: number): number => {
  if (limit <= 0) return 0
  const dot = cx * ux + cy * uy
  const discriminant = dot * dot - (cx * cx + cy * cy) + limit * limit
  if (discriminant <= 0) return 0
  return Math.max(0, Math.sqrt(discriminant) - dot)
}

type Eye = {
  transform: SVGTransform
  /** Own geometry, re-read each frame because expressions reshape the eyes. */
  path: SVGPathElement
}

type Target = {
  mount: HTMLElement
  /** The head silhouette that clips the eyes; its `d` is repainted each frame. */
  clip: SVGGraphicsElement
  eyes: Eye[]
  centerX: number
  centerY: number
  currentX: number
  currentY: number
  targetX: number
  targetY: number
}

export type GazeTracker = {
  /** Registers one rendered avatar. Returns false when its eyes are missing. */
  track: (mount: HTMLElement) => boolean
  setSettings: (next: GazeSettings) => void
  getSettings: () => GazeSettings
  /** Current deflection as a fraction of `travel`, for live readouts. */
  getDeflection: () => number
  /** Clip room left on the last frame, in SVG units. Infinity when idle. */
  getHeadroom: () => number
  destroy: () => void
}

export const createGazeTracker = (initial: GazeSettings): GazeTracker => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let settings = sanitize(initial)
  const targets: Target[] = []

  let pointerX = 0
  let pointerY = 0
  let pointerPresent = false
  let geometryDirty = true
  let frame: number | null = null
  // Clip room measured on the most recent frame, surfaced for the tuning lab.
  let lastAllowance = Number.POSITIVE_INFINITY

  const measure = (): void => {
    for (const target of targets) {
      const rect = target.mount.getBoundingClientRect()
      target.centerX = rect.left + rect.width / 2
      target.centerY = rect.top + rect.height / 2
    }
    geometryDirty = false
  }

  const paint = (): void => {
    frame = null
    if (geometryDirty) measure()

    // With smoothing the eyes keep easing after the pointer stops, so the loop
    // must persist until every target has settled.
    let moving = false

    for (const target of targets) {
      let nextX = 0
      let nextY = 0
      let gain = 0

      // Measured once per frame and shared by the clamp and the convergence
      // sign. The head drifts during playback, so its centre is never assumed
      // to sit at the origin.
      const headBox = target.clip.getBBox()
      const headRadius = Math.min(headBox.width, headBox.height) / 2
      const headCx = headBox.x + headBox.width / 2
      const headCy = headBox.y + headBox.height / 2

      if (pointerPresent) {
        const deltaX = pointerX - target.centerX
        const deltaY = pointerY - target.centerY
        const distance = Math.hypot(deltaX, deltaY)
        if (distance > 0.0001) {
          gain = distance / Math.hypot(distance, settings.depth)
          const ux = deltaX / distance
          const uy = deltaY / distance

          // The engine's own expressions already displace and reshape the eyes,
          // consuming part of the head's interior before gaze is applied, so the
          // budget is recomputed every frame from live geometry rather than
          // assumed from the neutral pose. The head is treated as the circle
          // inscribed in its own bounding box, which is exact for a circle and
          // conservative for the near-circular ellipse Davebot actually uses.

          let allowance = Infinity
          for (const eye of target.eyes) {
            const box = eye.path.getBBox()
            const reachOut = boxSupport(box.width / 2, box.height / 2, ux, uy)
            const advance = maxAdvance(
              box.x + box.width / 2 - headCx,
              box.y + box.height / 2 - headCy,
              ux,
              uy,
              headRadius - reachOut
            )
            allowance = Math.min(allowance, advance)
          }
          // Both eyes share the tighter budget, so the pair keeps moving as one.
          lastAllowance = allowance

          const reach = Math.min(settings.travel * gain, allowance)
          nextX = ux * reach
          nextY = uy * reach
        }
      }

      target.targetX = nextX
      target.targetY = nextY

      const follow = reduceMotion ? 1 : 1 - settings.smoothing
      target.currentX += (target.targetX - target.currentX) * follow
      target.currentY += (target.targetY - target.currentY) * follow

      if (
        Math.abs(target.targetX - target.currentX) > 0.01 ||
        Math.abs(target.targetY - target.currentY) > 0.01
      ) {
        moving = true
      }

      // Near targets converge; distant targets stay parallel. Nearness is read
      // from the SMOOTHED offset, not the raw gain, so convergence eases with
      // the eyes instead of jumping when the pointer teleports.
      const settled =
        settings.travel > 0
          ? Math.min(Math.hypot(target.currentX, target.currentY) / settings.travel, 1)
          : 0
      const converge = pointerPresent
        ? settings.convergence * settings.travel * 0.35 * (1 - settled)
        : 0

      for (const eye of target.eyes) {
        // The inward direction is re-derived from live geometry every frame.
        // Expressions swing an eye clear across the centre line, so a sign cached
        // at setup would eventually point outward and spend budget the clamp
        // above never reserved. Measured this way, convergence always moves the
        // eye toward the head centre and can never breach the silhouette.
        const box = eye.path.getBBox()
        const inward = box.x + box.width / 2 + target.currentX > headCx ? -1 : 1
        eye.transform.setTranslate(target.currentX + converge * inward, target.currentY)
      }

      if (reduceMotion || settings.lean === 0) {
        target.mount.style.transform = ''
      } else {
        const leanScale = settings.travel > 0 ? settings.lean / settings.travel : 0
        const leanX = target.currentX * leanScale
        const leanY = target.currentY * leanScale
        target.mount.style.transform = `translate3d(${leanX.toFixed(2)}px, ${leanY.toFixed(2)}px, 0)`
      }
    }

    if (moving) frame = requestAnimationFrame(paint)
  }

  const request = (): void => {
    if (frame === null) frame = requestAnimationFrame(paint)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return
    pointerX = event.clientX
    pointerY = event.clientY
    pointerPresent = true
    request()
  }

  const release = (): void => {
    pointerPresent = false
    request()
  }

  const onPointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget !== null) return
    release()
  }

  const onVisibility = (): void => {
    if (document.hidden) release()
  }

  const markDirty = (): void => {
    geometryDirty = true
    request()
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerout', onPointerOut)
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('scroll', markDirty, { passive: true })
  const observer = new ResizeObserver(markDirty)
  observer.observe(document.documentElement)

  return {
    track: mount => {
      const svg = mount.querySelector<SVGSVGElement>('svg')
      const paths = svg?.querySelectorAll<SVGPathElement>('g[clip-path] > path')
      // The clip path child is the head silhouette, and getBBox works on it even
      // though clipPath contents are never painted.
      const clip = svg?.querySelector<SVGPathElement>('clipPath path')
      if (!svg || !clip || !paths || paths.length !== 2) return false

      const eyes: Eye[] = []
      for (const path of paths) {
        const transform = svg.createSVGTransform()
        transform.setTranslate(0, 0)
        // Chromium clones both the appended object and appendItem's return
        // value; only getItem yields the live handle that setTranslate updates.
        path.transform.baseVal.appendItem(transform)
        const attached = path.transform.baseVal.getItem(path.transform.baseVal.numberOfItems - 1)
        eyes.push({ transform: attached, path })
      }

      targets.push({
        mount,
        clip,
        eyes,
        centerX: 0,
        centerY: 0,
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
      })
      markDirty()
      return true
    },
    setSettings: next => {
      settings = sanitize(next)
      request()
    },
    getSettings: () => ({ ...settings }),
    getDeflection: () => {
      const target = targets[0]
      if (!target || settings.travel === 0) return 0
      return Math.hypot(target.currentX, target.currentY) / settings.travel
    },
    getHeadroom: () => lastAllowance,
    destroy: () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', markDirty)
      observer.disconnect()
    },
  }
}
