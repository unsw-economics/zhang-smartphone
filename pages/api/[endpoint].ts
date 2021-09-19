import { NextApiRequest, NextApiResponse } from 'next'
import get_client from '../../db/connect'
import endpoints, { EndpointExtra } from '../../src/endpoints'
import { not_found } from '../../src/response'

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const endpoint = req.query.endpoint as string

  const extra: EndpointExtra = {
    method: req.method!,
    auth_token: req.headers.auth_token as (string | undefined),
    client: await get_client()
  }

  try {
    if (endpoints.hasOwnProperty(endpoint)) return await endpoints[endpoint](req, res, extra)
    return not_found(res)
  } catch (err) {
    res.statusCode = 500
    res.json({ message: JSON.stringify(err) })
  }
}

