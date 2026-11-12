export const STAND_SETTINGS_KEY = 'avatar-stand-settings'
export type StandSettings = {
  cameraId: string
  mirror: boolean
  proximity: number
  invitations: boolean
  resources: boolean
  landmarks: boolean
  // Other characters join for additional visitors. An empty list means "the first ones".
  companions: boolean
  companionIds: string[]
  // Set once the camera has run from the start button: `/stand` then starts by itself.
  configured: boolean
}
export const defaultStandSettings: StandSettings = {
  cameraId: '',
  mirror: true,
  proximity: 2.2,
  invitations: true,
  resources: true,
  landmarks: true,
  companions: true,
  companionIds: [],
  configured: false,
}

export function readStandSettings(): StandSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STAND_SETTINGS_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return { ...defaultStandSettings, companionIds: [] }
    const stored = value as Record<string, unknown>
    return {
      cameraId: typeof stored.cameraId === 'string' ? stored.cameraId : '',
      mirror: typeof stored.mirror === 'boolean' ? stored.mirror : true,
      proximity:
        typeof stored.proximity === 'number' && Number.isFinite(stored.proximity)
          ? Math.min(3, Math.max(1, stored.proximity))
          : 2.2,
      invitations: typeof stored.invitations === 'boolean' ? stored.invitations : true,
      resources: typeof stored.resources === 'boolean' ? stored.resources : true,
      landmarks: typeof stored.landmarks === 'boolean' ? stored.landmarks : true,
      companions: typeof stored.companions === 'boolean' ? stored.companions : true,
      companionIds: Array.isArray(stored.companionIds)
        ? stored.companionIds.filter((id): id is string => typeof id === 'string').slice(0, 3)
        : [],
      configured: stored.configured === true,
    }
  } catch {
    return { ...defaultStandSettings, companionIds: [] }
  }
}

export function saveStandSettings(settings: StandSettings) {
  try {
    localStorage.setItem(STAND_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // The stand remains usable when storage is unavailable or full.
  }
}
