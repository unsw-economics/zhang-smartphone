import { NextApiResponse } from 'next'

export function bad_request(res: NextApiResponse, tag: string, message: string) {
  res.statusCode = 400
  res.json({ tag, message })
}

export function forbidden(res: NextApiResponse) {
  res.statusCode = 403
  res.end()
}

export function not_found(res: NextApiResponse) {
  res.statusCode = 404
  res.end()
}

