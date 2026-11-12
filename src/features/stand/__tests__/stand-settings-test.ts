// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultStandSettings,
  readStandSettings,
  saveStandSettings,
  STAND_SETTINGS_KEY,
} from '../standSettings'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('stand settings persistence', () => {
  it('restores all preferences including the selected camera', () => {
    const settings = {
      cameraId: 'usb-camera',
      mirror: false,
      proximity: 1.5,
      invitations: false,
      resources: false,
      landmarks: false,
      companions: false,
      companionIds: ['freddy', 'nova'],
      configured: true,
    }
    saveStandSettings(settings)
    expect(readStandSettings()).toEqual(settings)
  })
  it('keeps at most three chosen companions and ignores invalid ids', () => {
    localStorage.setItem(
      STAND_SETTINGS_KEY,
      JSON.stringify({ companionIds: ['a', 4, 'b', 'c', 'd'], companions: 'yes' })
    )
    expect(readStandSettings()).toMatchObject({ companions: true, companionIds: ['a', 'b', 'c'] })
  })
  it('defaults when storage is missing or invalid', () => {
    expect(readStandSettings()).toEqual(defaultStandSettings)
    for (const value of ['{broken', 'null', '42', '"text"']) {
      localStorage.setItem(STAND_SETTINGS_KEY, value)
      expect(readStandSettings()).toEqual(defaultStandSettings)
    }
  })
  it('validates fields independently and clamps distance', () => {
    localStorage.setItem(
      STAND_SETTINGS_KEY,
      JSON.stringify({ cameraId: 42, mirror: false, resources: 'false', proximity: 99 })
    )
    expect(readStandSettings()).toEqual({ ...defaultStandSettings, mirror: false, proximity: 3 })
  })
  it('keeps working when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(readStandSettings()).toEqual(defaultStandSettings)
    expect(() => saveStandSettings(defaultStandSettings)).not.toThrow()
  })
})
