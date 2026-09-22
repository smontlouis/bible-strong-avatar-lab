import { lazy, Suspense, useEffect, useState } from 'react'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { StudioDialogs } from '@/features/studio/components/StudioDialogs'
import { StudioInspector } from '@/features/studio/components/StudioInspector'
import { StudioStage } from '@/features/studio/components/StudioStage'
import type { StudioController } from '@/features/studio/useStudioController'

const STACKED_LAYOUT_QUERY = '(max-width: 980px)'
const StandMode = lazy(() => import('@/features/stand/StandMode'))

export function StudioView(controller: StudioController) {
  const [standOpen, setStandOpen] = useState(false)
  const openStand = () => {
    if (controller.playbackStatus === 'playing') controller.pauseState()
    setStandOpen(true)
  }
  const [stackedLayout, setStackedLayout] = useState(
    () => window.matchMedia(STACKED_LAYOUT_QUERY).matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(STACKED_LAYOUT_QUERY)
    const updateStackedLayout = () => setStackedLayout(mediaQuery.matches)
    mediaQuery.addEventListener('change', updateStackedLayout)
    return () => mediaQuery.removeEventListener('change', updateStackedLayout)
  }, [])

  return (
    <div className="studio-root" lang={controller.language}>
      {standOpen ? (
        <Suspense fallback={<p role="status">{controller.t('Préparation…')}</p>}>
          <StandMode
            avatar={controller.activeAvatar}
            reducedMotion={Boolean(controller.reduceMotion)}
            onExit={() => setStandOpen(false)}
          />
        </Suspense>
      ) : stackedLayout ? (
        <ResizablePanelGroup
          className="studio studio-mobile-resizable"
          orientation="vertical"
          resizeTargetMinimumSize={{ coarse: 40, fine: 12 }}
        >
          <ResizablePanel
            id="preview"
            className="mobile-stage-panel"
            defaultSize="42%"
            minSize={180}
          >
            <StudioStage controller={controller} onOpenStand={openStand} />
          </ResizablePanel>
          <ResizableHandle
            className="studio-resize-handle"
            withHandle
            aria-label={controller.t('Redimensionner l’aperçu et l’éditeur')}
          />
          <ResizablePanel id="editor" className="mobile-inspector-panel" minSize={260}>
            <StudioInspector controller={controller} />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="studio">
          <StudioStage controller={controller} onOpenStand={openStand} />
          <StudioInspector controller={controller} />
        </div>
      )}
      {!standOpen && <StudioDialogs controller={controller} />}
    </div>
  )
}
