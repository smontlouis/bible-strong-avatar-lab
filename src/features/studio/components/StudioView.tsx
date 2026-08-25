import { StudioDialogs } from '@/features/studio/components/StudioDialogs'
import { StudioInspector } from '@/features/studio/components/StudioInspector'
import type { StudioController } from '@/features/studio/useStudioController'

export function StudioView(controller: StudioController) {
  return (
    <div className="studio-root" lang={controller.language}>
      <div className="studio studio-catalog-only">
        <StudioInspector controller={controller} />
      </div>
      <StudioDialogs controller={controller} />
    </div>
  )
}
