import { ClientBase } from 'pg'
import { NextApiRequest, NextApiResponse } from 'next'
import { add_subject, get_subject_by_subject_id, set_secret, get_subjects, check_id, check_secret, get_reports, add_reports, DBReport } from '../db/driver'
import { generate_id } from './subject'
import { bad_request, forbidden } from './response'
import { nanoid } from 'nanoid'

export type EndpointExtra = {
  method: string
  auth_token?: string
  client: ClientBase
}

export type Endpoint = (req: NextApiRequest, res: NextApiResponse, extra: EndpointExtra) => Promise<void>

export type EndpointCarrier = {
  [k: string]: Endpoint
}

// const PG_ERROR_UNIQUE_VIOLATION = '23505'

const admin_token = process.env.ADMIN_TOKEN

type RawReport = {
  application_id: string
  usage_seconds: number
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

function http_get(endpoint: Endpoint): Endpoint {
  return async function(req, res, extra) {
    if (extra.method !== 'GET') return bad_request(
      res,
      'wrong-method',
      'This endpoint accepts GET requests only.'
    )

    return endpoint(req, res, extra)
  }
}

function http_post(endpoint: Endpoint): Endpoint {
  return async function(req, res, extra) {
    if (extra.method !== 'POST') return bad_request(
      res,
      'wrong-method',
      'This endpoint accepts POST requests only.'
    )

    return endpoint(req, res, extra)
  }
}

const endpoints: EndpointCarrier = {
  identify: http_post(async (req, res, { client }) => {
    const { email, subject_id } = req.body

    if (email == null) return bad_request(res, 'missing-field', 'Missing email.')
    if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')

    const result = await get_subject_by_subject_id(client, subject_id)

    if (result.rows.length === 0 || result.rows[0].email !== email) return bad_request(
      res,
      'subject-not-found',
      'Subject with that email and ID combination does not exist.'
    )

    const existing_secret = result.rows[0].secret

    if (existing_secret !== null) {
      res.json({ data: { auth_token: existing_secret } })
    } else {
      const secret = nanoid()

      await set_secret(client, subject_id as string, secret)

      res.json({ data: { auth_token: secret } })
    }
  }),

  ['get-test-group']: http_get(async (req, res, { auth_token, client }) => {
    const { subject_id } = req.query as Record<string, string>

    const result = await get_subject_by_subject_id(client, subject_id)

    if (
      auth_token === admin_token ||
      result.rows.length !== 0 && auth_token === result.rows[0].secret
    ) {
      res.json({ data: result.rows[0].test_group })
    } else {
      return forbidden(res)
    }
  }),

  ['add-subject']: http_post(async (req, res, { auth_token, client }) => {
      if (auth_token !== admin_token) return forbidden(res)

      const { first_name, last_name, email } = req.body

      const errors = []

      if (first_name == null) errors.push('Missing first name.')
      if (last_name == null) errors.push('Missing last name.')
      if (email == null) errors.push('Missing email.')

      if (errors.length !== 0) return bad_request(
        res,
        'missing-field',
        errors.join('\n')
      )

      const subject_id = await generate_new_id(client)

      await add_subject(client, subject_id, first_name, last_name, email)

      res.json({ subject_id })
  }),

  ['get-subject']: http_get(async (req, res, { auth_token, client }) => {
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
  }),

  ['get-all-subjects']: http_get(async (req, res, { auth_token, client }) => {
      if (auth_token !== admin_token) return forbidden(res)

      const result = await get_subjects(client)

      res.json({ data: result.rows })
  }),

  ['submit-report']: http_post(async (req, res, { auth_token, client }) => {
    const { subject_id, report_date, reports } = req.body

    if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')
    if (report_date == null) return bad_request(res, 'missing-field', 'Missing date.')

    if (auth_token !== admin_token) {
      const result = await check_secret(client, subject_id)

      if (result.rows.length === 0 || auth_token !== result.rows[0].secret) return forbidden(res)
    }

    const raw_reports = reports as RawReport[]

    const db_reports: DBReport[] = raw_reports.map(
      r => [subject_id, r.application_id, report_date, r.usage_seconds]
    )

    await add_reports(client, db_reports)

    /* we use `on conflict do nothing`, so the query will succeed even if there are duplicates

    try {
      await add_reports(client, db_reports)
    } catch (err) {
      if ((err as DatabaseError).code === PG_ERROR_UNIQUE_VIOLATION) {
        return bad_request(
          res,
          'report-exists',
          'A report already exists for one of the combinations of user, application ID, and date.'
        )
      }

      throw err
    }

    */

    res.json({ data: {} })
  }),

  ['get-all-reports']: http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res)

    const result = await get_reports(client)

    res.json({ data: result.rows })
  })
}

export default endpoints

