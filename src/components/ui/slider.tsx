import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import type * as React from 'react'

import { cn } from '@/lib/utils'

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        'relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-5 w-full items-center">
        <SliderPrimitive.Track className="relative h-1 w-full overflow-hidden rounded-full bg-input">
          <SliderPrimitive.Indicator className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-3 rounded-full border-2 border-background bg-primary shadow-sm outline-none transition-[box-shadow,transform] focus-visible:ring-3 focus-visible:ring-ring/50 data-[dragging]:scale-110" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
