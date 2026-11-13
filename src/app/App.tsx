import { ClipExplorer } from '@/features/clips/ClipExplorer'
import { StudioView } from '@/features/studio/components/StudioView'
import { useStudioController } from '@/features/studio/useStudioController'
import { StudioLanguageProvider } from '@/i18n'

function StudioApp() {
  const controller = useStudioController()
  return <StudioView {...controller} />
}

// The new engine is reached at `?clips` while the editor is rebuilt around it.
const showsClips = new URLSearchParams(window.location.search).has('clips')

export default function App() {
  if (showsClips) return <ClipExplorer />
  return (
    <StudioLanguageProvider>
      <StudioApp />
    </StudioLanguageProvider>
  )
}
