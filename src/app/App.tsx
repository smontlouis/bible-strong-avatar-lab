import { Editor } from '@/features/editor/Editor'
import { StudioView } from '@/features/studio/components/StudioView'
import { useStudioController } from '@/features/studio/useStudioController'
import { StudioLanguageProvider } from '@/i18n'

function StudioApp() {
  const controller = useStudioController()
  return <StudioView {...controller} />
}

// The editor of the first version stays reachable at `?legacy` while the new one is reviewed.
const showsLegacy = new URLSearchParams(window.location.search).has('legacy')

export default function App() {
  if (!showsLegacy) {
    return (
      <StudioLanguageProvider>
        <Editor />
      </StudioLanguageProvider>
    )
  }
  return (
    <StudioLanguageProvider>
      <StudioApp />
    </StudioLanguageProvider>
  )
}
