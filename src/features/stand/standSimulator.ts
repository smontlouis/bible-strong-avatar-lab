import { clamp, radians } from '@/features/avatar/geometry'
import type { CameraStatus } from './standCamera'
import type { Landmark, ObservedHand, StandObservation, Visitor } from './standDirector'
import { unprojectHand } from './standHandNavigation'

// Same pinhole assumptions as standGaze: a 16 cm face seen through a 60° lens.
const focalX = 1 / (2 * Math.tan(radians(60) / 2))
const faceWidthAt = (distance: number) => (0.16 * focalX) / clamp(distance, 0.4, 5)

export type SimulatorKey =
  | 'visitor'
  | 'closer'
  | 'farther'
  | 'left'
  | 'right'
  | 'wave'
  | 'smile'
  | 'thumb'
  | 'victory'
  | 'thumbDown'
  | 'tilt'
  | 'hand'
  | 'addVisitor'
  | 'removeVisitor'
export const simulatorKeys: Record<string, SimulatorKey> = {
  ' ': 'visitor',
  ArrowUp: 'closer',
  ArrowDown: 'farther',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'wave',
  s: 'smile',
  t: 'thumb',
  v: 'victory',
  b: 'thumbDown',
  p: 'tilt',
  m: 'hand',
  a: 'addVisitor',
  r: 'removeVisitor',
}
// Where additional visitors stand (camera x) and how far away they are.
const extraSpots = [
  { x: 0.2, distance: 2.1 },
  { x: 0.8, distance: 1.9 },
  { x: 0.1, distance: 2.4 },
]

/**
 * Synthetic MediaPipe observations for design and demo work without a camera.
 * It feeds the real director and hand navigation, so it exercises the same
 * detectors; it does not model recognition accuracy.
 */
export function createStandSimulator() {
  const state = {
    present: false,
    distance: 2.8,
    x: 0.5,
    smile: false,
    thumb: false,
    victory: false,
    thumbDown: false,
    tilt: false,
    waveFrom: -Infinity,
    handRaised: false,
    extras: 0,
    // Pointer target in camera space, recomputed from the screen pointer.
    hand: null as Landmark | null,
    fist: false,
  }
  const face = (): Visitor => {
    const width = faceWidthAt(state.distance)
    const y = 0.4
    const roll = state.tilt ? 18 : 0
    const landmarks = Array.from({ length: 264 }, () => ({ x: state.x, y }))
    const halfEyes = width * 0.32
    const aspect = 4 / 3
    landmarks[33] = { x: state.x - halfEyes, y: y - Math.tan(radians(roll)) * halfEyes * aspect }
    landmarks[263] = { x: state.x + halfEyes, y: y + Math.tan(radians(roll)) * halfEyes * aspect }
    const smile = state.smile ? 0.86 : 0.04
    return {
      x: state.x,
      y,
      width,
      height: width * 1.6,
      frameAspectRatio: aspect,
      landmarks,
      signals: { mouthSmileLeft: smile, mouthSmileRight: smile, jawOpen: 0.02 },
    }
  }
  return {
    state,
    press(key: SimulatorKey, at: number) {
      if (key === 'visitor') {
        state.present = !state.present
        if (state.present) state.distance = 2.8
      } else if (key === 'closer') state.distance = clamp(state.distance - 0.3, 0.6, 4)
      else if (key === 'farther') state.distance = clamp(state.distance + 0.3, 0.6, 4)
      else if (key === 'left') state.x = clamp(state.x - 0.08, 0.15, 0.85)
      else if (key === 'right') state.x = clamp(state.x + 0.08, 0.15, 0.85)
      else if (key === 'wave') state.waveFrom = at
      else if (key === 'smile') state.smile = !state.smile
      else if (key === 'thumb') state.thumb = !state.thumb
      else if (key === 'victory') state.victory = !state.victory
      else if (key === 'thumbDown') state.thumbDown = !state.thumbDown
      else if (key === 'tilt') state.tilt = !state.tilt
      else if (key === 'hand') state.handRaised = !state.handRaised
      else if (key === 'addVisitor') state.extras = Math.min(extraSpots.length, state.extras + 1)
      else if (key === 'removeVisitor') state.extras = Math.max(0, state.extras - 1)
      // Any main visitor action implies that person is standing in front of the screen.
      if (key !== 'visitor' && key !== 'addVisitor' && key !== 'removeVisitor') state.present = true
    },
    /** Moves the synthetic hand so that hand navigation projects it onto `point`. */
    point(point: Landmark | null, mirror: boolean, viewport: { width: number; height: number }) {
      state.hand = point && state.present ? unprojectHand(point, face(), mirror, viewport) : null
    },
    observe(at: number): StandObservation {
      // Other people sway a little, so their characters visibly follow them.
      const extras = extraSpots.slice(0, state.extras).map((spot, index) => {
        const width = faceWidthAt(spot.distance)
        const smile = state.smile ? 0.8 : 0.05
        return {
          x: spot.x + Math.sin(at / 1700 + index * 2) * 0.05,
          y: 0.42,
          width,
          height: width * 1.6,
          frameAspectRatio: 4 / 3,
          signals: { mouthSmileLeft: smile, mouthSmileRight: smile },
        }
      })
      if (!state.present)
        return { timestamp: at, faces: extras, hands: [], frameWidth: 960, frameHeight: 720 }
      const visitor = face()
      const hands: ObservedHand[] = []
      const waving = at - state.waveFrom < 1800
      if (waving) {
        // A raised open palm beside the face, swinging about 2.5 times a second.
        const swing = Math.sin(((at - state.waveFrom) / 1000) * Math.PI * 5)
        hands.push({
          x: visitor.x + visitor.width * 1.3 + swing * Math.max(0.04, visitor.width * 0.45),
          y: visitor.y,
          side: 'Right',
          open: true,
          gesture: 'Open_Palm',
          confidence: 0.92,
        })
      } else if (state.handRaised && state.hand) {
        hands.push({
          ...state.hand,
          side: 'Right',
          open: !state.fist,
          gesture: state.fist ? 'Closed_Fist' : 'Open_Palm',
          confidence: 0.92,
        })
      }
      // Held hand signs at chest height, beside the visitor.
      const signs: [boolean, string, number][] = [
        [state.thumb, 'Thumb_Up', -1.1],
        [state.victory, 'Victory', 1.1],
        [state.thumbDown, 'Thumb_Down', -1.4],
      ]
      for (const [active, gesture, offset] of signs) {
        if (!active) continue
        hands.push({
          x: visitor.x + visitor.width * offset,
          y: visitor.y + visitor.height * 0.9,
          side: offset < 0 ? 'Left' : 'Right',
          open: false,
          gesture,
          confidence: 0.9,
        })
      }
      return {
        timestamp: at,
        faces: [visitor, ...extras],
        hands,
        frameWidth: 960,
        frameHeight: 720,
      }
    },
  }
}

/** Replaces the camera session with keyboard and pointer input (`/stand?simulate`). */
export function startStandSimulation(
  root: HTMLElement,
  observe: (observation: StandObservation) => void,
  status: (status: CameraStatus) => void,
  mirror: () => boolean,
  onState: (state: ReturnType<typeof createStandSimulator>['state']) => void
) {
  const simulator = createStandSimulator()
  let pointer: Landmark | null = null
  let lastObservation = 0
  let frame = 0
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight })
  const handActive = () => simulator.state.handRaised && simulator.state.present
  const keydown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target instanceof HTMLInputElement) return
    const key = simulatorKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (!key || event.repeat) return
    event.preventDefault()
    simulator.press(key, performance.now())
    onState({ ...simulator.state })
  }
  const move = (event: PointerEvent) => {
    pointer = { x: event.clientX, y: event.clientY }
  }
  const down = (event: PointerEvent) => {
    if (!handActive() || event.button !== 0) return
    // The synthetic fist replaces the mouse click while the hand is raised.
    event.preventDefault()
    simulator.state.fist = true
  }
  const up = () => {
    simulator.state.fist = false
  }
  const click = (event: MouseEvent) => {
    if (!handActive() || (event.target as Element | null)?.closest('.stand-toolbar, .stand-panel'))
      return
    event.preventDefault()
    event.stopPropagation()
  }
  const tick = (at: number) => {
    frame = requestAnimationFrame(tick)
    if (document.hidden || at - lastObservation < 66) return
    lastObservation = at
    simulator.point(pointer, mirror(), viewport())
    observe(simulator.observe(at))
  }
  window.addEventListener('keydown', keydown)
  root.addEventListener('pointermove', move)
  root.addEventListener('pointerdown', down, true)
  window.addEventListener('pointerup', up)
  root.addEventListener('click', click, true)
  status('loading')
  const ready = setTimeout(() => {
    status('running')
    onState({ ...simulator.state })
    frame = requestAnimationFrame(tick)
  }, 400)
  return () => {
    clearTimeout(ready)
    cancelAnimationFrame(frame)
    window.removeEventListener('keydown', keydown)
    root.removeEventListener('pointermove', move)
    root.removeEventListener('pointerdown', down, true)
    window.removeEventListener('pointerup', up)
    root.removeEventListener('click', click, true)
  }
}
