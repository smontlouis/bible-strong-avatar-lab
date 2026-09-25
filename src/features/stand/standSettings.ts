export const STAND_SETTINGS_KEY = 'avatar-stand-settings'
export const defaultStandSettings = {
  cameraId: '',
  mirror: true,
  proximity: 2.2,
  invitations: true,
  resources: true,
  landmarks: true,
}
export type StandSettings = typeof defaultStandSettings

export function readStandSettings(): StandSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STAND_SETTINGS_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return { ...defaultStandSettings }
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
    }
  } catch {
    return { ...defaultStandSettings }
  }
}

export function saveStandSettings(settings: StandSettings) {
  try {
    localStorage.setItem(STAND_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // The stand remains usable when storage is unavailable or full.
  }
}
