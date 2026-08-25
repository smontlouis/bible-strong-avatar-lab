import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createAvatarDefinition } from '../avatarDefinition'
import { resolveAvatarBehavior } from '../avatars'
import defaultStudioDocument from '../../studio/defaultStudioDocument.json'
import type { StudioDocument } from '../../studio/studioDocument'

it('keeps the consumer fixture synchronized with the bundled Strobi Studio document', async () => {
  const document = defaultStudioDocument as unknown as StudioDocument
  const avatar = document.library.avatars.find(candidate => candidate.id === 'strobi')
  if (!avatar) throw new Error('Bundled Strobi avatar not found')
  const behavior = resolveAvatarBehavior(avatar, {
    expressions: document.expressions,
    sequences: document.sequences,
  })
  const result = createAvatarDefinition({ avatar, behavior })
  if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'))
  const fixture = await readFile(
    resolve('examples/react-vite-consumer/src/strobi.avatar.json'),
    'utf8'
  )
  expect(JSON.parse(fixture)).toEqual(result.value)
})
