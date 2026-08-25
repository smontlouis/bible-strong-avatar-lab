import { createAvatar } from '@bible-strong/avatar-web'

import { davebotHeaderVariants, HEADER_MODES, type HeaderMode } from './davebot-header'
import {
  createGazeTracker,
  GAZE_DEFAULTS,
  GAZE_LIMITS,
  GAZE_PRESETS,
  loadGazeSettings,
  saveGazeSettings,
  type GazeSettings,
} from './davebotGaze'
import './davebot-gaze.css'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stage = document.querySelector<HTMLElement>('#stage')
const scales = document.querySelector<HTMLElement>('#scales')
const controls = document.querySelector<HTMLElement>('#controls')
const presetRow = document.querySelector<HTMLElement>('#presets')
const deflectionBar = document.querySelector<HTMLElement>('#deflection-bar')
const deflectionValue = document.querySelector<HTMLElement>('#deflection-value')
const output = document.querySelector<HTMLElement>('#settings-json')
const copyButton = document.querySelector<HTMLButtonElement>('#copy')
const resetButton = document.querySelector<HTMLButtonElement>('#reset')

if (
  !stage ||
  !scales ||
  !controls ||
  !presetRow ||
  !deflectionBar ||
  !deflectionValue ||
  !output ||
  !copyButton ||
  !resetButton
) {
  throw new Error('Davebot gaze lab shell is incomplete.')
}

let settings = loadGazeSettings()
const gaze = createGazeTracker(settings)

const mount = (host: HTMLElement, mode: HeaderMode): void => {
  const variant = davebotHeaderVariants.find(candidate => candidate.mode === mode)
  if (!variant) throw new Error(`Davebot variant for ${mode} mode was not found.`)

  const controller = createAvatar(host, {
    definition: variant.definition,
    defaultAnimation: reduceMotion ? undefined : 'idle',
    autoplay: !reduceMotion,
    size: '100%',
    ariaLabel: `Davebot in ${mode} mode`,
    onError: error => console.error(`[davebot-gaze/${mode}]`, error),
  })

  if (reduceMotion) controller.setExpression('neutral')
  if (!gaze.track(host)) throw new Error(`Davebot eye paths for ${mode} mode were not found.`)
}

// Two sizes matter. The large stage makes the feel judgeable; the chip row
// shows the same settings at the size Davebot actually ships at, where the
// 300-unit viewBox compresses into roughly 46 screen px.
for (const mode of Object.keys(HEADER_MODES) as HeaderMode[]) {
  const tile = document.createElement('figure')
  tile.className = 'tile'
  tile.dataset.mode = mode

  const host = document.createElement('div')
  host.className = 'tile-avatar'
  tile.append(host)

  const caption = document.createElement('figcaption')
  caption.textContent = `${mode} mode`
  tile.append(caption)

  stage.append(tile)
  mount(host, mode)

  const chip = document.createElement('div')
  chip.className = 'chip'
  chip.dataset.mode = mode

  const chipHost = document.createElement('div')
  chipHost.className = 'chip-avatar'
  chip.append(chipHost)

  const chipLabel = document.createElement('span')
  chipLabel.textContent = `${mode} at header size`
  chip.append(chipLabel)

  scales.append(chip)
  mount(chipHost, mode)
}

type Field = {
  key: keyof GazeSettings
  label: string
  unit: string
  hint: string
}

const FIELDS: Field[] = [
  {
    key: 'travel',
    label: 'Travel',
    unit: 'units',
    hint: 'Furthest the pupils move. The head silhouette starts clipping them past 48.',
  },
  {
    key: 'depth',
    label: 'Depth',
    unit: 'px',
    hint: 'How far away Davebot feels. Lower values lock on to a near cursor much harder.',
  },
  {
    key: 'smoothing',
    label: 'Smoothing',
    unit: '',
    hint: 'Zero pins the eyes to the cursor. Raise it to let them trail behind.',
  },
  {
    key: 'convergence',
    label: 'Convergence',
    unit: '',
    hint: 'How far the eyes cross inward when the cursor is close to him.',
  },
  {
    key: 'lean',
    label: 'Lean',
    unit: 'px',
    hint: 'Whole-body shift toward the cursor. A little sells the look; a lot reads as sliding.',
  },
]

// Show exactly as many decimals as the step can express, so a 0.5 step reads
// "3.0" rather than a falsely precise "3.00".
const format = (key: keyof GazeSettings, value: number): string => {
  const step = GAZE_LIMITS[key].step
  if (step >= 1) return String(Math.round(value))
  return value.toFixed(step < 0.1 ? 2 : 1)
}

type Control = {
  field: Field
  input: HTMLInputElement
  readout: HTMLElement
}

const buildControl = (field: Field): Control => {
  const limit = GAZE_LIMITS[field.key]

  const row = document.createElement('div')
  row.className = 'field'

  const label = document.createElement('label')
  label.className = 'field-head'
  label.htmlFor = `gaze-${field.key}`

  const name = document.createElement('span')
  name.textContent = field.label

  // A range input already announces its own value, so this readout is visual
  // only and must not become a second announced label.
  const readout = document.createElement('span')
  readout.className = 'field-value'
  readout.setAttribute('aria-hidden', 'true')

  label.append(name, readout)

  const input = document.createElement('input')
  input.type = 'range'
  input.id = `gaze-${field.key}`
  input.min = String(limit.min)
  input.max = String(limit.max)
  input.step = String(limit.step)
  input.value = String(settings[field.key])
  input.setAttribute('aria-describedby', `hint-${field.key}`)

  const hint = document.createElement('p')
  hint.className = 'field-hint'
  hint.id = `hint-${field.key}`
  hint.textContent = field.hint

  row.append(label, input, hint)
  controls.append(row)

  return { field, input, readout }
}

const controlList: Control[] = FIELDS.map(buildControl)

const syncReadouts = (): void => {
  for (const control of controlList) {
    const value = format(control.field.key, settings[control.field.key])
    control.readout.textContent = control.field.unit ? `${value} ${control.field.unit}` : value
  }

  output.textContent = JSON.stringify(settings, null, 2)

  const active = Object.entries(GAZE_PRESETS).find(([, preset]) =>
    controlList.every(control => preset[control.field.key] === settings[control.field.key])
  )
  for (const button of presetRow.querySelectorAll<HTMLButtonElement>('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.preset === active?.[0]))
  }
}

// The deflection meter mirrors the tracker's own settling loop: it runs while
// the value is still changing and then stops, so an idle page costs no frames.
let deflectionFrame: number | null = null
let lastDeflection = -1

const paintDeflection = (): void => {
  deflectionFrame = null
  const value = gaze.getDeflection()
  const percent = Math.round(value * 100)
  deflectionBar.style.setProperty('--fill', `${Math.min(percent, 100)}%`)
  deflectionValue.textContent = `${percent}%`

  if (Math.abs(value - lastDeflection) > 0.001) {
    lastDeflection = value
    deflectionFrame = requestAnimationFrame(paintDeflection)
  }
}

const requestDeflection = (): void => {
  lastDeflection = -1
  if (deflectionFrame === null) deflectionFrame = requestAnimationFrame(paintDeflection)
}

const apply = (next: GazeSettings, syncInputs: boolean): void => {
  gaze.setSettings(next)
  // Read back the engine's clamped values so the panel can never display a
  // number the tracker is not actually using.
  settings = gaze.getSettings()
  saveGazeSettings(settings)

  if (syncInputs) {
    for (const control of controlList) {
      control.input.value = String(settings[control.field.key])
    }
  }

  syncReadouts()
  requestDeflection()
}

for (const control of controlList) {
  control.input.addEventListener('input', () => {
    apply({ ...settings, [control.field.key]: Number(control.input.value) }, false)
  })
}

for (const [label, preset] of Object.entries(GAZE_PRESETS)) {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.preset = label
  button.textContent = label
  button.addEventListener('click', () => apply(preset, true))
  presetRow.append(button)
}

resetButton.addEventListener('click', () => apply(GAZE_DEFAULTS, true))

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2))
    copyButton.textContent = 'Copied'
  } catch {
    // Clipboard access is denied outside a secure context. The JSON is already
    // on screen, so selecting it is a working fallback rather than a dead end.
    const range = document.createRange()
    range.selectNodeContents(output)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    copyButton.textContent = 'Selected'
  }
  window.setTimeout(() => {
    copyButton.textContent = 'Copy JSON'
  }, 1400)
})

window.addEventListener('pointermove', requestDeflection, { passive: true })

syncReadouts()
requestDeflection()
