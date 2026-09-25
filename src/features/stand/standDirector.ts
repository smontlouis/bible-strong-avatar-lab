import type { HandRotation } from './standHandNavigation'
import { clamp, type Expression } from '@/features/avatar/geometry'
import { createStandEncounter, visitorSignals } from './standEncounter'
import {
  estimateVisitorPosition,
  solveStandGaze,
  type GazeCalibration,
  type FaceProjection,
} from './standGaze'

export type Landmark = { x: number; y: number }
export type LandmarkConnection = { start: number; end: number }
export type Visitor = FaceProjection & {
  height: number
  landmarks?: Landmark[]
  signals?: Record<string, number>
}
export type ObservedHand = {
  x: number
  y: number
  side: string
  open: boolean
  landmarks?: Landmark[]
  gesture?: string
  confidence?: number
}
export type StandObservation = {
  timestamp: number
  faces: Visitor[]
  hands: ObservedHand[]
  frameWidth?: number
  frameHeight?: number
  inferenceMs?: number
  faceConnections?: LandmarkConnection[]
  handConnections?: LandmarkConnection[]
}
export type StandMood = 'idle' | 'wary' | 'curious' | 'greeting' | 'playful'
// Proximity is the approximate distance in metres where Strobi begins leaning in.
export type StandSettings = { mirror: boolean; proximity: number; reducedMotion: boolean }

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

// Track a physical oscillation, not alternating classifier labels or individual frames.
export function createWaveDetector() {
  let samples: { x: number; at: number }[] = []
  let side = ''
  return {
    reset() {
      samples = []
      side = ''
    },
    observe(hand: ObservedHand | undefined, at: number, amplitude: number) {
      if (!hand?.open) {
        samples = []
        return false
      }
      const last = samples.at(-1)
      if (
        side !== hand.side ||
        (last && (at - last.at > 250 || Math.abs(last.x - hand.x) > 0.25))
      ) {
        samples = []
      }
      side = hand.side
      samples.push({ x: hand.x, at })
      samples = samples.filter(sample => at - sample.at <= 1800)
      let anchor = samples[0].x
      let direction = 0
      let reversals = 0
      for (const sample of samples) {
        const delta = sample.x - anchor
        if (!direction && Math.abs(delta) >= amplitude) {
          direction = Math.sign(delta)
          anchor = sample.x
        } else if (direction && Math.sign(delta) === direction) {
          anchor = sample.x
        } else if (direction && Math.abs(delta) >= amplitude) {
          reversals++
          direction *= -1
          anchor = sample.x
        }
      }
      if (reversals >= 2 && at - samples[0].at >= 450) {
        samples = []
        return true
      }
      return false
    },
  }
}

// No identity recognition: continuity is based only on nearby face boxes.
export function createStandDirector() {
  let target: Visitor | null = null
  let seenAt = -Infinity
  let metAt = 0
  let lastObservation = -Infinity
  let gazeCalibration: GazeCalibration | undefined
  let visitorId = 0
  let rotation: HandRotation | null = null
  let handAt = -Infinity
  let navigating = false
  let touch = { strength: 0, x: 0, y: 0 }
  let petFriend = false
  const wave = createWaveDetector()
  const encounter = createStandEncounter()

  const encounterAt = (at: number, radius = 2.2) => {
    const present = target !== null && at - seenAt < 1400
    return encounter.sample(
      at,
      present,
      present && at - seenAt < 350,
      target ? estimateVisitorPosition(target).z : Infinity,
      radius
    )
  }

  return {
    setHandRotation(value: HandRotation | null) {
      rotation = value
    },
    handRotation() {
      return rotation
    },
    setHandInteraction(at: number, active: boolean, pet = { strength: 0, x: 0, y: 0 }) {
      handAt = at
      navigating = active
      touch = pet
      if (pet.strength > 0) petFriend = true
    },
    inspect(at: number, mirror: boolean) {
      const age = at - seenAt
      const visitor = target && age < 1400 ? target : null
      return {
        target: visitor,
        visitorId,
        visible: visitor !== null && age < 350,
        gaze: visitor ? solveStandGaze(visitor, mirror, gazeCalibration) : null,
        calibrated: gazeCalibration !== undefined,
        ...encounterAt(at),
        signals: visitor && age < 350 ? visitorSignals(visitor) : null,
      }
    },
    calibrateGaze(at: number) {
      if (!target || at - seenAt > 350) return false
      const { x, y } = estimateVisitorPosition(target)
      gazeCalibration = { x, y }
      return true
    },
    observe(observation: StandObservation) {
      const { timestamp: at, faces, hands } = observation
      if (at <= lastObservation) return
      lastObservation = at
      if (at - seenAt > 1400) {
        target = null
        wave.reset()
      }
      let next: Visitor | undefined
      if (target) {
        const previous = target
        next = faces
          .filter(
            face =>
              distance(face, previous) < Math.max(0.12, previous.width * 0.65) &&
              face.width / previous.width > 0.55 &&
              face.width / previous.width < 1.8
          )
          .sort((a, b) => distance(a, previous) - distance(b, previous))[0]
      } else {
        next = [...faces].sort((a, b) => b.width - a.width)[0]
        if (next) {
          metAt = at
          encounter.reset(at)
          visitorId++
          petFriend = false
          touch = { strength: 0, x: 0, y: 0 }
        }
      }
      if (!next) {
        wave.reset()
        return
      }
      target = next
      seenAt = at
      const visitor = next
      if (navigating && at - handAt < 350) {
        wave.reset()
        return
      }
      // A wave is raised beside the face; a thumbs-up can be at chest height.
      // Both must be closer to this visitor than to another visible face.
      const nearbyHands = hands
        .filter(
          candidate =>
            Math.abs(candidate.x - visitor.x) < Math.max(0.22, visitor.width * 2) &&
            candidate.y <
              visitor.y +
                (candidate.open ? visitor.height * 0.8 : Math.max(0.3, visitor.height * 1.5)) &&
            Math.abs(candidate.y - visitor.y) < Math.max(0.3, visitor.height * 1.5) &&
            faces.every(
              face => face === visitor || distance(candidate, visitor) <= distance(candidate, face)
            )
        )
        .sort((a, b) => distance(a, visitor) - distance(b, visitor))
      let waved = false
      if (encounterAt(at).greetingCooldownMs > 0) {
        wave.reset()
      } else {
        waved = wave.observe(
          nearbyHands.find(hand => hand.open),
          at,
          Math.max(0.025, visitor.width * 0.2)
        )
      }
      encounter.observe(visitor, nearbyHands, waved, at)
    },
    sample(at: number, base: Expression, settings: StandSettings) {
      const present = target !== null && at - seenAt < 1400
      const interaction = encounterAt(at, settings.proximity)
      const friendly = interaction.friendly || (present && petFriend)
      const navigation = navigating && at - handAt < 350
      const pet = present && at - handAt < 350 ? touch.strength : 0
      const greeting =
        !navigation && interaction.reaction === 'wave' && interaction.reactionElapsed < 1900
      const mood: StandMood = !present
        ? 'idle'
        : greeting
          ? 'greeting'
          : friendly
            ? 'playful'
            : at - metAt < 3000
              ? 'wary'
              : 'curious'
      const visitorDistance = present ? estimateVisitorPosition(target!).z : Infinity
      const near = clamp(
        (settings.proximity - visitorDistance) / Math.max(0.4, settings.proximity - 0.65),
        0,
        1
      )
      const gaze = present
        ? solveStandGaze(target!, settings.mirror, gazeCalibration)
        : {
            headX: -Math.sin(at / 3200) * 2,
            headY: Math.sin(at / 2400) * 6,
            eyeX: Math.sin(at / 2400) * 2,
            eyeY: Math.sin(at / 3200) * 0.7,
          }
      const suspicion = present && !friendly ? (mood === 'wary' ? 0.8 : 0.35) + near * 0.2 : 0
      const energy = settings.reducedMotion ? 0 : 1
      const greetingTime = greeting ? interaction.reactionElapsed : 0
      const hello = greeting ? Math.sin((greetingTime / 1900) * Math.PI) : 0
      const playfulTime = (at - metAt) % 8500
      const play =
        !navigation && mood === 'playful' && playfulTime < 1500
          ? Math.sin((playfulTime / 1500) * Math.PI)
          : 0
      const reply =
        !navigation && interaction.reaction
          ? Math.sin((interaction.reactionElapsed / 2200) * Math.PI)
          : 0
      const signals =
        present && at - seenAt < 350 ? visitorSignals(target!) : { smile: 0, jaw: 0, tilt: 0 }
      const smileReply = interaction.reaction === 'smile' ? reply : 0
      const approval = interaction.reaction === 'thumbs-up' ? reply : 0
      const arrival = present && at - metAt < 750 ? Math.sin(((at - metAt) / 750) * Math.PI) : 0
      const invitePhase = (at - metAt) % 9000
      const invite =
        !navigation && interaction.cue === 'wave' && invitePhase < 1200
          ? Math.sin((invitePhase / 1200) * Math.PI)
          : 0
      const demonstrateTilt =
        !navigation && interaction.cue === 'tilt' ? Math.sin(at / 1400) * 10 : 0
      const mimicTilt = friendly ? signals.tilt * (settings.mirror ? -0.5 : 0.5) : 0
      const bounce =
        hello * Math.abs(Math.sin(greetingTime / 130)) +
        play * 0.3 +
        approval * Math.abs(Math.sin(interaction.reactionElapsed / 230)) * 0.8
      const blinkPhase = at % 4300
      const blink = blinkPhase < 150 ? 1 - Math.sin((blinkPhase / 150) * Math.PI) * 0.94 : 1
      const idlePhase = at % 21000
      const sleepy =
        !present && idlePhase > 14000 ? Math.sin(((idlePhase - 14000) / 7000) * Math.PI) : 0
      const happyEyes = Math.max(smileReply * 0.7, friendly ? signals.smile * 0.4 : 0, pet * 0.85)
      const wink = approval > 0.7 ? 0.85 : 0
      const expression: Expression = {
        ...base,
        headX: base.headX + gaze.headX - pet * 4,
        headY: base.headY + gaze.headY,
        headZ:
          base.headZ +
          suspicion * 9 +
          (hello * Math.sin(greetingTime / 140) * 12 +
            play * 8 +
            invite * -8 +
            demonstrateTilt +
            mimicTilt +
            pet * touch.x * 10) *
            energy,
        positionXLeft: base.positionXLeft + gaze.eyeX,
        positionXRight: base.positionXRight + gaze.eyeX,
        positionYLeft: base.positionYLeft + gaze.eyeY,
        positionYRight: base.positionYRight + gaze.eyeY,
        heightLeft: clamp(
          base.heightLeft *
            (1 -
              suspicion * 0.4 +
              hello * 0.18 +
              arrival * 0.28 -
              happyEyes -
              sleepy * 0.82 -
              wink),
          3,
          100
        ),
        heightRight: clamp(
          base.heightRight *
            (1 - suspicion * 0.15 + hello * 0.18 + arrival * 0.28 - happyEyes - sleepy * 0.82),
          3,
          100
        ),
        leftAngle: base.leftAngle + suspicion * 13 - happyEyes * 18,
        rightAngle: base.rightAngle - suspicion * 5 + happyEyes * 18,
        mouthCurve: friendly ? 65 : base.mouthCurve,
      }
      return {
        mood,
        cue:
          pet > 0
            ? ('petted' as const)
            : petFriend && !interaction.friendly && present
              ? ('free-play' as const)
              : interaction.cue,
        expression,
        blink,
        x: pet * touch.x * 6 * energy,
        y:
          (Math.sin(at / 1200) * 2 + Math.sin(at / 3100) - bounce * 13 - arrival * 7 + sleepy * 8) *
          energy,
        scale: 1 + near * 0.14 + (hello * 0.04 - arrival * 0.035 + invite * 0.025) * energy,
      }
    },
  }
}
