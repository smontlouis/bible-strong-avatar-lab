import { Editor } from '@/features/editor/Editor'
import { StudioLanguageProvider } from '@/i18n'

export default function App() {
  return (
    <StudioLanguageProvider>
      <Editor />
    </StudioLanguageProvider>
  )
}
