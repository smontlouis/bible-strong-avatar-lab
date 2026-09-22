import { directDialogueWithJev, jsonError } from '../server/jevDirector'

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 })
  }
  try {
    return Response.json(await directDialogueWithJev(await request.json()))
  } catch (error) {
    return Response.json(jsonError(error), { status: 400 })
  }
}
