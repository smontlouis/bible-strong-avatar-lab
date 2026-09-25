import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStudioLanguage } from '@/i18n'
import type { CameraStatus } from './standCamera'

export function StandCameraSelect({
  value,
  status,
  onChange,
}: {
  value: string
  status: CameraStatus | 'idle'
  onChange: (id: string) => void
}) {
  const { t } = useStudioLanguage()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    const media = navigator.mediaDevices
    if (!media?.enumerateDevices) return
    let disposed = false
    let revision = 0
    const refresh = async () => {
      const request = ++revision
      try {
        const list = await media.enumerateDevices()
        if (!disposed && request === revision)
          setDevices(list.filter(device => device.kind === 'videoinput' && device.deviceId))
      } catch {
        // Camera permissions and startup errors are reported by the camera session.
      }
    }
    void refresh()
    media.addEventListener('devicechange', refresh)
    return () => {
      disposed = true
      media.removeEventListener('devicechange', refresh)
    }
  }, [status])
  const options = [
    { value: '', label: t('Caméra par défaut') },
    ...devices.map((device, index) => ({
      value: device.deviceId,
      label: device.label || `${t('Caméra')} ${index + 1}`,
    })),
  ]
  if (value && !devices.some(device => device.deviceId === value))
    options.push({ value, label: t('Caméra déconnectée') })
  return (
    <div className="stand-camera-select">
      <label id="stand-camera-label">{t('Caméra')}</label>
      <Select
        items={options}
        value={value}
        onValueChange={id => {
          if (id !== null) onChange(id)
        }}
      >
        <SelectTrigger aria-labelledby="stand-camera-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent positionerClassName="z-[110]">
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="stand-note">
        {t(
          'Après autorisation, choisissez la caméra à utiliser. Le suivi redémarre automatiquement.'
        )}
      </p>
    </div>
  )
}
