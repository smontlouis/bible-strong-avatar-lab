import { Menu as MenuPrimitive } from '@base-ui/react/menu'

import { cn } from '../../lib/utils'

function Menu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

function MenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger {...props} />
}

function MenuContent({ className, ...props }: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner className="z-50" sideOffset={6}>
        <MenuPrimitive.Popup
          className={cn(
            'min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl outline-none',
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted',
        className
      )}
      {...props}
    />
  )
}

export { Menu, MenuContent, MenuItem, MenuTrigger }
