import { ClientBase } from 'pg'
import { NextApiRequest, NextApiResponse } from 'next'
import get_client from '../../db/connect'
import { add_subject, get_subject_by_subject_id, set_secret, get_subjects, check_id, check_secret, get_reports, add_reports, DBReport } from '../../db/driver'
import { generate_id } from '../../src/subject'
import { nanoid } from 'nanoid'

const admin_token = require('../../admin-token.json').token

type RawReport = {
  application_id: string
  foreground_time: number
  visible_time: number
}

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

function bad_request(res: NextApiResponse, code: string, message: string) {
  res.statusCode = 400
  res.json({ code, message })
}

function forbidden(res: NextApiResponse) {
  res.statusCode = 403
  res.end()
}

function not_found(res: NextApiResponse) {
  res.statusCode = 404
  res.end()
}

export default async function handle(req: NextApiRequest, res: NextApiResponse) {

  const { endpoint } = req.query
  const { auth_token } = req.headers
  const { method } = req
  const client = await get_client()

  try {
    if (endpoint === 'initial-auth') {
      if (method !== 'POST') return bad_request(res, 'wrong-method', 'This endpoint accepts POST requests only.')

      const { first_name, subject_id } = req.body

      if (first_name == null) return bad_request(res, 'missing-field', 'Missing first name.')
      if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')

      const result = await get_subject_by_subject_id(client, subject_id)

      if (result.rows.length === 0 || result.rows[0].first_name !== first_name) return bad_request(res, 'subject-not-found', 'Subject with that ID and first name combination does not exist.')

      if (result.rows[0].secret !== null) return bad_request(res, 'subject-already-inducted', 'Subject with that ID has already been inducted.')

      const secret = nanoid()

      await set_secret(client, subject_id as string, secret)

      res.json({ data: { auth_token: secret } })
    } else if (endpoint === 'add-subject') {
      if (method !== 'POST') return bad_request(res, 'wrong-method', 'This endpoint accepts POST requests only.')

      if (auth_token !== admin_token) return forbidden(res)

      const { first_name, last_name, email } = req.body

      const errors = []

      if (first_name == null) errors.push('Missing first name.')
      if (last_name == null) errors.push('Missing last name.')
      if (email == null) errors.push('Missing email.')

      if (errors.length !== 0) return bad_request(res, 'missing-field', errors.join('\n'))

      const subject_id = await generate_new_id(client)

      await add_subject(client, subject_id, first_name, last_name, email)

      res.json({ subject_id })
    } else if (endpoint === 'get-subject') {
      if (method !== 'GET') return bad_request(res, 'wrong-method', 'This endpoint accepts GET requests only.')

      const { subject_id } = req.query as Record<string, string>

      if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')

      const result = await get_subject_by_subject_id(client, subject_id)

      if (auth_token === admin_token) {
        if (result.rows.length !== 0) {
          res.json({ data: result.rows[0] })
        } else {
          res.json({ data: {} })
        }
      } else {
        if (result.rows.length !== 0 && auth_token === result.rows[0].secret) {
          res.json({ data: result.rows[0] })
        } else {
          return forbidden(res)
        }
      }
    } else if (endpoint === 'get-all-subjects') {
      if (method !== 'GET') return bad_request(res, 'wrong-method', 'This endpoint accepts GET requests only.')

      if (auth_token !== admin_token) return forbidden(res)

      const result = await get_subjects(client)

      res.json({ data: result.rows })
    } else if (endpoint === 'submit-report') {
      if (method !== 'POST') return bad_request(res, 'wrong-method', 'This endpoint accepts POST requests only.')

      const { subject_id, date, reports } = req.body

      if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')
      if (date == null) return bad_request(res, 'missing-field', 'Missing date.')

      if (auth_token !== admin_token) {
        const result = await check_secret(client, subject_id)

        if (result.rows.length === 0 || auth_token !== result.rows[0].secret) return forbidden(res)
      }

      const raw_reports = reports as RawReport[]

      const db_reports: DBReport[] = raw_reports.map(
        r => [subject_id, r.application_id, date, r.foreground_time, r.visible_time]
      )

      await add_reports(client, db_reports)

      res.json({ data: {} })
    } else if (endpoint === 'get-all-reports') {
      if (method !== 'GET') return bad_request(res, 'wrong-method', 'This endpoint accepts GET requests only.')

      if (auth_token !== admin_token) return forbidden(res)

      const result = await get_reports(client)

      res.json({ data: result.rows })
    } else {
      return not_found(res)
    }
  } catch (err) {
    res.statusCode = 500
    res.json({ message: JSON.stringify(err) })
  }
}
