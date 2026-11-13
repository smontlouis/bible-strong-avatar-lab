import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStudioLanguage } from '@/i18n'

import { bounded, type NumericProps } from '@/features/editor/utils'
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useStudioLanguage()
  const translatedLabel = t(label)
  return (
    <Field className="color-field">
      <FieldTitle>{translatedLabel}</FieldTitle>
      <span className="color-control">
        <Input
          aria-label={`${translatedLabel} · ${t('sélecteur')}`}
          className="color-swatch"
          type="color"
          value={value}
          onChange={event => onChange(event.currentTarget.value)}
        />
        <Input
          aria-label={`${translatedLabel} · ${t('hexadécimal')}`}
          className="color-value"
          key={value}
          defaultValue={value.toUpperCase()}
          spellCheck={false}
          onChange={event => {
            const next = event.currentTarget.value.toUpperCase()
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next.toLowerCase())
          }}
          onBlur={event => {
            if (!/^#[0-9A-F]{6}$/.test(event.currentTarget.value.toUpperCase())) {
              event.currentTarget.value = value.toUpperCase()
            }
          }}
        />
      </span>
    </Field>
  )
}

export function AmbientMotionField<Motion extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Motion
  options: { value: Motion; label: string }[]
  onChange: (value: Motion) => void
}) {
  const { t } = useStudioLanguage()
  return (
    <Field className="ambient-motion-field" orientation="horizontal">
      <FieldTitle>{t(label)}</FieldTitle>
      <Select
        value={value}
        items={options.map(option => ({ value: option.value, label: t(option.label) }))}
        onValueChange={next => next && onChange(next as Motion)}
      >
        <SelectTrigger aria-label={t(label)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function NumericField({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  onChange,
  onActiveChange,
}: NumericProps) {
  const { t } = useStudioLanguage()
  const translatedLabel = t(label)
  const dragRef = useRef<{ x: number; value: number } | null>(null)
  const editingRef = useRef(false)
  const [draftValue, setDraftValue] = useState(() =>
    String(Number(value.toFixed(step < 0.1 ? 2 : 1)))
  )

  useEffect(() => {
    if (!editingRef.current) {
      setDraftValue(String(Number(value.toFixed(step < 0.1 ? 2 : 1))))
    }
  }, [step, value])

  const commitDraftValue = (rawValue: string) => {
    const parsedValue = Number(rawValue.replace(',', '.'))
    const nextValue =
      Number.isFinite(parsedValue) && rawValue.trim() !== ''
        ? bounded(parsedValue, min, max)
        : value

    setDraftValue(String(Number(nextValue.toFixed(step < 0.1 ? 2 : 1))))
    onChange(nextValue)
  }

  const startScrub = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onActiveChange?.(true)
    dragRef.current = { x: event.clientX, value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const scrub = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const speed = event.shiftKey ? 10 : event.altKey ? 0.1 : 1
    const next = dragRef.current.value + (event.clientX - dragRef.current.x) * step * speed
    onChange(bounded(next, min, max))
  }

  const stopScrub = () => {
    dragRef.current = null
    onActiveChange?.(false)
  }

  return (
    <Field className="numeric-field" orientation="horizontal">
      <Button
        className="scrub-label"
        variant="ghost"
        size="sm"
        type="button"
        title={t('Glisser horizontalement pour modifier')}
        onPointerDown={startScrub}
        onPointerMove={scrub}
        onPointerUp={stopScrub}
        onPointerCancel={stopScrub}
      >
        <span>{translatedLabel}</span>
        <span className="scrub-icon" aria-hidden="true">
          ↔
        </span>
      </Button>
      <label className="number-shell">
        <Input
          type="number"
          aria-label={translatedLabel}
          min={min}
          max={max}
          step={step}
          value={draftValue}
          onFocus={() => {
            editingRef.current = true
            onActiveChange?.(true)
          }}
          onBlur={event => {
            editingRef.current = false
            commitDraftValue(event.currentTarget.value)
            onActiveChange?.(false)
          }}
          onChange={event => setDraftValue(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span>{unit}</span>
      </label>
    </Field>
  )
}

export function LinkButton({
  linked,
  onClick,
  label,
}: {
  linked: boolean
  onClick: () => void
  label: string
}) {
  const { t } = useStudioLanguage()
  return (
    <Button
      type="button"
      className="link-button"
      variant="outline"
      size="icon-sm"
      aria-pressed={linked}
      aria-label={t(label)}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
      </svg>
    </Button>
  )
}
