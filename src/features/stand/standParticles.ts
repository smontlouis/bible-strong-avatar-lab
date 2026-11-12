export type ParticleKind =
  'heart' | 'star' | 'spark' | 'confetti' | 'ring' | 'dust' | 'zzz' | 'drop'
export type Particle = {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  rotation: number
  spin: number
  color: string
  // Pixels per second squared; negative values float upwards.
  gravity: number
}
export type StandBurst =
  | 'celebrate'
  | 'smile'
  | 'approve'
  | 'victory'
  | 'tilt'
  | 'sulk'
  | 'heart'
  | 'click'
  | 'zzz'
  | 'farewell'

type Emission = {
  kind: ParticleKind
  count: number
  speed: [number, number]
  // Emission cone: centre angle and total spread, in radians (0 = right, -π/2 = up).
  direction: number
  spread: number
  size: [number, number]
  life: [number, number]
  gravity: number
  colors: readonly string[]
}

const up = -Math.PI / 2
const festive = ['#b9f87a', '#ffd66b', '#91b5ff', '#ffacb9', '#c3a8ec', '#8fd0c2'] as const
const presets: Record<StandBurst, Emission[]> = {
  celebrate: [
    {
      kind: 'confetti',
      count: 42,
      speed: [420, 900],
      direction: up,
      spread: 2.1,
      size: [14, 24],
      life: [1500, 2300],
      gravity: 900,
      colors: festive,
    },
    {
      kind: 'spark',
      count: 12,
      speed: [160, 360],
      direction: up,
      spread: Math.PI * 2,
      size: [16, 26],
      life: [600, 900],
      gravity: 0,
      colors: ['#fffdf0', '#b9f87a'],
    },
  ],
  smile: [
    {
      kind: 'star',
      count: 16,
      speed: [180, 420],
      direction: up,
      spread: Math.PI * 1.4,
      size: [20, 34],
      life: [900, 1400],
      gravity: 260,
      colors: ['#ffd66b', '#fff1b8', '#b9f87a'],
    },
  ],
  approve: [
    {
      kind: 'star',
      count: 10,
      speed: [220, 460],
      direction: up,
      spread: Math.PI * 1.2,
      size: [22, 36],
      life: [900, 1300],
      gravity: 320,
      colors: ['#ffd66b', '#fffdf0'],
    },
    {
      kind: 'confetti',
      count: 22,
      speed: [300, 640],
      direction: up,
      spread: 1.7,
      size: [13, 20],
      life: [1300, 1900],
      gravity: 900,
      colors: festive,
    },
  ],
  tilt: [
    {
      kind: 'ring',
      count: 2,
      speed: [0, 0],
      direction: 0,
      spread: 0,
      size: [110, 170],
      life: [700, 900],
      gravity: 0,
      colors: ['#91b5ff'],
    },
    {
      kind: 'spark',
      count: 14,
      speed: [200, 380],
      direction: 0,
      spread: Math.PI * 2,
      size: [16, 24],
      life: [600, 900],
      gravity: 0,
      colors: ['#91b5ff', '#c3a8ec', '#fffdf0'],
    },
  ],
  heart: [
    {
      kind: 'heart',
      count: 1,
      speed: [40, 110],
      direction: up,
      spread: 1.1,
      size: [24, 38],
      life: [1100, 1600],
      gravity: -60,
      colors: ['#ffacb9', '#ff7f96', '#ffd1d9'],
    },
  ],
  click: [
    {
      kind: 'ring',
      count: 1,
      speed: [0, 0],
      direction: 0,
      spread: 0,
      size: [90, 90],
      life: [450, 450],
      gravity: 0,
      colors: ['#b9f87a'],
    },
    {
      kind: 'spark',
      count: 7,
      speed: [160, 260],
      direction: 0,
      spread: Math.PI * 2,
      size: [12, 18],
      life: [350, 500],
      gravity: 0,
      colors: ['#b9f87a', '#fffdf0'],
    },
  ],
  victory: [
    {
      kind: 'star',
      count: 18,
      speed: [260, 560],
      direction: up,
      spread: Math.PI * 1.3,
      size: [22, 38],
      life: [1000, 1500],
      gravity: 380,
      colors: ['#ffd66b', '#fffdf0', '#b9f87a'],
    },
    {
      kind: 'confetti',
      count: 26,
      speed: [360, 760],
      direction: up,
      spread: 1.9,
      size: [14, 22],
      life: [1400, 2000],
      gravity: 900,
      colors: festive,
    },
  ],
  // A few theatrical tears on each side; the forgiving heart follows separately.
  sulk: [
    {
      kind: 'drop',
      count: 5,
      speed: [60, 160],
      direction: Math.PI / 2,
      spread: 2.6,
      size: [16, 24],
      life: [900, 1300],
      gravity: 700,
      colors: ['#91b5ff', '#c7dcff'],
    },
  ],
  zzz: [
    {
      kind: 'zzz',
      count: 1,
      speed: [30, 45],
      direction: -1.2,
      spread: 0.3,
      size: [26, 40],
      life: [2200, 2600],
      gravity: -8,
      colors: ['#aebac9'],
    },
  ],
  farewell: [
    {
      kind: 'heart',
      count: 7,
      speed: [120, 280],
      direction: up,
      spread: 1.6,
      size: [24, 38],
      life: [1300, 1900],
      gravity: -30,
      colors: ['#ffacb9', '#ffd66b', '#b9f87a'],
    },
  ],
}

export const MAX_PARTICLES = 260
const DUST = 26

/** Screen-space particles for reactions and ambience. Rendering lives in StandEffects. */
export function createParticleField(random: () => number = Math.random) {
  let particles: Particle[] = []
  const between = ([min, max]: [number, number]) => min + (max - min) * random()
  const spawn = (particle: Particle) => {
    particles.push(particle)
    // Drop the oldest first so a burst is never refused.
    if (particles.length > MAX_PARTICLES) particles = particles.slice(-MAX_PARTICLES)
  }
  return {
    particles: () => particles as readonly Particle[],
    clear() {
      particles = []
    },
    burst(name: StandBurst, x: number, y: number, scale = 1) {
      for (const emission of presets[name]) {
        for (let index = 0; index < emission.count; index++) {
          const angle = emission.direction + (random() - 0.5) * emission.spread
          const speed = between(emission.speed) * scale
          spawn({
            kind: emission.kind,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: between(emission.life),
            size: between(emission.size) * scale,
            rotation: random() * Math.PI * 2,
            spin: (random() - 0.5) * 12,
            color: emission.colors[Math.floor(random() * emission.colors.length)],
            gravity: emission.gravity * scale,
          })
        }
      }
    },
    /** Keeps a few slow motes drifting upwards through the scene. */
    ambient(width: number, height: number) {
      const motes = particles.reduce(
        (count, particle) => count + (particle.kind === 'dust' ? 1 : 0),
        0
      )
      if (motes >= DUST || random() > 0.08) return
      spawn({
        kind: 'dust',
        x: random() * width,
        y: height * (0.35 + random() * 0.7),
        vx: (random() - 0.5) * 10,
        vy: -(8 + random() * 16),
        age: 0,
        life: 9000 + random() * 7000,
        size: 1.5 + random() * 3,
        rotation: 0,
        spin: 0,
        color: random() > 0.7 ? '#b9f87a' : '#91b5ff',
        gravity: 0,
      })
    },
    step(dt: number) {
      const seconds = Math.min(dt, 100) / 1000
      particles = particles.filter(particle => {
        particle.age += seconds * 1000
        if (particle.age >= particle.life) return false
        particle.vy += particle.gravity * seconds
        // Confetti flutters: air resistance makes it drift rather than fall.
        // Drag factors are per 60 Hz frame, scaled to the elapsed time.
        const frames = seconds * 60
        const drag = particle.kind === 'confetti' ? 0.985 : particle.kind === 'dust' ? 1 : 0.97
        particle.vx *= drag ** frames
        particle.vy *= (particle.kind === 'confetti' && particle.vy > 0 ? 0.95 : drag) ** frames
        particle.x += particle.vx * seconds
        particle.y += particle.vy * seconds
        particle.rotation += particle.spin * seconds
        return true
      })
    },
  }
}
