import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useRef } from 'react'

import { cn } from '../../lib/utils'

export type ComboboxSection = { value: string; items: string[] }

/**
 * A choice among many, in sections: closed, one line with what it is and what it is set to;
 * open, a search field over a list that scrolls through its sections.
 */
export function SectionCombobox({
  label,
  value,
  sections,
  detail,
  placeholder,
  empty,
  onPick,
  className,
}: {
  label: string
  value: string | null
  sections: ComboboxSection[]
  /** What is shown on the right of a choice: a duration, a count. */
  detail?: (item: string) => string | undefined
  placeholder: string
  empty: string
  onPick: (item: string) => void
  className?: string
}) {
  const search = useRef<HTMLInputElement>(null)
  return (
    <Combobox.Root<string>
      items={sections}
      value={value}
      onOpenChange={open => {
        // Opened, the search takes the keys at once, whatever opened it.
        if (open) requestAnimationFrame(() => search.current?.focus())
      }}
      onValueChange={next => {
        if (typeof next === 'string') onPick(next)
      }}
    >
      <Combobox.Trigger
        aria-label={label}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 data-[popup-open]:bg-muted',
          className
        )}
      >
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-secondary-foreground">
          <span className="truncate">
            {value ?? '—'}
            {value && detail?.(value) ? (
              <span className="font-normal text-muted-foreground"> · {detail(value)}</span>
            ) : null}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="z-50" align="end" sideOffset={6}>
          <Combobox.Popup
            aria-label={label}
            className="flex max-h-[min(26rem,var(--available-height))] w-[var(--anchor-width)] min-w-64 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg outline-none"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <Combobox.Input
                ref={search}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Combobox.Empty className="px-3 py-4 text-xs text-muted-foreground empty:hidden">
              {empty}
            </Combobox.Empty>
            <Combobox.List className="flex-1 overflow-y-auto overscroll-contain p-1 empty:hidden">
              {(section: ComboboxSection) => (
                <Combobox.Group key={section.value} items={section.items} className="pb-1">
                  <Combobox.GroupLabel className="eyebrow sticky top-0 z-10 bg-popover px-2 pt-2 pb-1">
                    {section.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: string) => (
                      <Combobox.Item
                        key={item}
                        value={item}
                        className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted data-[selected]:font-semibold data-[selected]:text-secondary-foreground"
                      >
                        <span className="grid size-3.5 shrink-0 place-items-center">
                          <Combobox.ItemIndicator>
                            <Check className="size-3.5" />
                          </Combobox.ItemIndicator>
                        </span>
                        <span className="flex-1 truncate">{item}</span>
                        {detail?.(item) && (
                          <span
                            aria-hidden="true"
                            className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums"
                          >
                            {detail(item)}
                          </span>
                        )}
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
