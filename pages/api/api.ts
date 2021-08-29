import { ClientBase } from 'pg'
import { NextApiRequest, NextApiResponse } from 'next'
import get_client from '../../db/connect'
import { add_subject, get_subject_by_subject_id, get_subjects, check_id } from '../../db/driver'
import { generate_id } from '../../src/subject'
import { nanoid } from 'nanoid'

const admin_token = require('../../admin-token.json').token

async function generate_new_id(client: ClientBase) {
  let id = generate_id()
  let ready = false

  while (!ready) {
    const result = await check_id(client, id)

    if (result.rows.length === 0) {
      ready = true
    } else {
      id = generate_id()
    }
  }

  return id
}

async function handle_method(res: NextApiResponse, validate: () => string[], run: () => void): Promise<void> {
  const errors = validate()

  if (errors.length !== 0) {
    res.statusCode = 400
    res.json({ message: errors.join('\n') })
    return
  }

  await run()
}

function bad_request(res: NextApiResponse, code: string, message: string) {
  res.statusCode = 400
  res.json({ code, message })
}

function forbidden(res: NextApiResponse) {
  res.statusCode = 403
  res.end()
}

export default async function handle(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'GET' && req.method !== 'POST') {
    return bad_request(res, 'http-unsupported', `HTTP method '${ req.method }' unsupported.`)
  }

  const q = req.method === 'GET' ? req.query : JSON.parse(req.body)

  try {
    if (q.method === 'initial-auth') {
      if (q.first_name == null) return bad_request(res, 'missing-field', 'Missing first name.')
      if (q.subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')

      const client = await get_client()

      const result = await check_id(client, q.subject_id as string)

      if (result.rows.length === 0 || result.rows[0].first_name !== q.first_name as string) return bad_request(res, 'subject-not-found', 'Subject with that ID and first name combination does not exist.')

      const secret = nanoid()

      // update secret in database

      res.json({ data: { secret } })
    } else if (q.method === 'add-subject') {
      if (q.admin_token !== admin_token) return forbidden(res)

      const errors = []

      if (q.first_name == null) errors.push('Missing first name.')
      if (q.last_name == null) errors.push('Missing last name.')
      if (q.email == null) errors.push('Missing email.')

      if (errors.length !== 0) return bad_request(res, 'missing-field', errors.join('\n'))

      const client = await get_client()

      const subject_id = await generate_new_id(client)

      await add_subject(client, subject_id, 0, q.first_name as string, q.last_name as string, q.email as string)

      res.json({ subject_id })
    } else if (q.method === 'get-subject') {
      if (q.subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')

      const client = await get_client()

      const result = await get_subject_by_subject_id(client, q.subject_id as string)

      if (q.admin_token === admin_token) {
        if (result.rows.length !== 0) {
          res.json({ data: result.rows[0] })
        } else {
          res.json({ data: {} })
        }
      } else {
        if (result.rows.length !== 0 && result.rows[0].secret === q.secret as string) {
          res.json({ data: result.rows[0] })
        } else {
          return forbidden(res)
        }
      }
    } else if (q.method === 'get-all-subjects') {
      if (q.admin_token !== admin_token) return forbidden(res)

      const client = await get_client()

      const result = await get_subjects(client)

      res.json({ data: result.rows })
    } else {
      return bad_request(res, 'unsupported-method', 'Unsupported method.')
    }
  } catch (err) {
    res.statusCode = 500
    res.json({ message: JSON.stringify(err) })
  }
}
