import type { PagesFunction } from '@cloudflare/workers-types'
import app from '../../src/app'

export const onRequest: PagesFunction = async (context) => {
  return app.fetch(context.request, context.env, context)
}
