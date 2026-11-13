export type SnapshotPaletteStyle = 'solid' | 'linear' | 'radial'

export type SnapshotPalette = {
  colorFrom: string
  colorTo: string
}

type OklchColor = {
  lightness: number
  chroma: number
  hue: number
}

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

const relativeLuminance = (hex: string) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.red) + 0.7152 * channel(rgb.green) + 0.0722 * channel(rgb.blue)
}

export const snapshotPaletteContrast = (first: string, second: string) => {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lightest = Math.max(firstLuminance, secondLuminance)
  const darkest = Math.min(firstLuminance, secondLuminance)
  return (lightest + 0.05) / (darkest + 0.05)
}

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(Math.max(value, minimum), maximum)

const linearToSrgb = (value: number) => {
  const normalized = clamp(value)
  return normalized <= 0.0031308 ? normalized * 12.92 : 1.055 * normalized ** (1 / 2.4) - 0.055
}

const channelToHex = (value: number) =>
  Math.round(clamp(value) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()

const oklchToHex = ({ lightness, chroma, hue }: OklchColor) => {
  const radians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(radians)
  const b = chroma * Math.sin(radians)
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3
  const red = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const green = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const blue = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

const samePalette = (first: SnapshotPalette, second: SnapshotPalette) =>
  first.colorFrom.toLowerCase() === second.colorFrom.toLowerCase() &&
  first.colorTo.toLowerCase() === second.colorTo.toLowerCase()

const paletteContrast = (palette: SnapshotPalette, foreground: string) =>
  Math.min(
    snapshotPaletteContrast(palette.colorFrom, foreground),
    snapshotPaletteContrast(palette.colorTo, foreground)
  )

const hueForAttempt = (random: () => number, attempt: number) =>
  (random() * 360 + attempt * 137.508) % 360

const generatePalette = (
  style: SnapshotPaletteStyle,
  darkBackground: boolean,
  random: () => number,
  attempt: number
): SnapshotPalette => {
  const hue = hueForAttempt(random, attempt)
  const chroma = 0.065 + random() * 0.055

  if (style === 'solid') {
    const lightness = darkBackground ? 0.3 + random() * 0.14 : 0.78 + random() * 0.13
    const color = oklchToHex({ lightness, chroma, hue })
    return { colorFrom: color, colorTo: color }
  }

  const hueShift = 18 + random() * 38
  const secondHue = (hue + (random() > 0.5 ? hueShift : -hueShift) + 360) % 360
  if (style === 'radial') {
    const centerLightness = darkBackground ? 0.36 : 0.94
    const edgeLightness = darkBackground ? 0.12 : 0.7
    return {
      colorFrom: oklchToHex({ lightness: centerLightness, chroma: chroma * 0.82, hue }),
      colorTo: oklchToHex({
        lightness: edgeLightness,
        chroma: chroma * (darkBackground ? 0.42 : 0.85),
        hue: secondHue,
      }),
    }
  }

  const startLightness = darkBackground ? 0.38 : 0.92
  const endLightness = darkBackground ? 0.2 : 0.74
  return {
    colorFrom: oklchToHex({ lightness: startLightness, chroma, hue }),
    colorTo: oklchToHex({ lightness: endLightness, chroma: chroma * 0.9, hue: secondHue }),
  }
}

export const randomSnapshotPalette = (
  style: SnapshotPaletteStyle,
  foreground: string,
  current: SnapshotPalette,
  random = Math.random
) => {
  const darkContrast = snapshotPaletteContrast(foreground, '#15191F')
  const lightContrast = snapshotPaletteContrast(foreground, '#F2E8D4')
  const darkBackground =
    darkContrast >= 3 && lightContrast >= 3 ? random() >= 0.5 : darkContrast >= lightContrast
  let bestPalette: SnapshotPalette | null = null
  let bestContrast = 0

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const palette = generatePalette(style, darkBackground, random, attempt)
    if (samePalette(palette, current)) continue
    const contrast = paletteContrast(palette, foreground)
    if (contrast >= 3) return palette
    if (contrast > bestContrast) {
      bestPalette = palette
      bestContrast = contrast
    }
  }

  return bestPalette ?? generatePalette(style, darkBackground, random, 25)
}
