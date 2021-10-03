import { ClientBase, DatabaseError } from 'pg'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  add_subject, get_subject_by_subject_id, get_subjects, set_identified, check_id, check_secret, set_groups_and_limits,
  get_reports, add_reports,
  DBReport
} from '../db/driver'
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

const admin_token = process.env.ADMIN_TOKEN

type RawReport = {
  application_name: string
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
    const { subject_id } = req.body

    if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')

    const result = await get_subject_by_subject_id(client, subject_id)

    if (result.rows.length === 0) return bad_request(
      res,
      'subject-not-found',
      'Subject with that ID does not exist.'
    )

    const subject = result.rows[0]

    if (!subject.identified) {
      await set_identified(client, subject_id)
      req.log.info(`subject ${ subject_id } identified`)
    } else {
      req.log.info(`subject ${ subject_id } identified again`)
    }

    res.json({
      data: {
        auth_token: subject.secret
      }
    })
  }),

  'get-group-and-limit': http_get(async (req, res, { auth_token, client }) => {
    const { subject_id } = req.query as Record<string, string>

    const result = await get_subject_by_subject_id(client, subject_id)

    if (
      auth_token === admin_token ||
      result.rows.length !== 0 && auth_token === result.rows[0].secret
    ) {
      const subject = result.rows[0]

      res.json({
        data: {
          test_group: subject.test_group,
          treatment_limit: subject.treatment_limit
        }
      })
    } else {
      return forbidden(res)
    }
  }),

  'set-groups-and-limits': http_post(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res)

    const updates = req.body

    if (updates == null || updates.constructor !== Array) return bad_request(res, 'incorrect-format', 'Expecting array of [subject_id, test_group, treatment_limit] triples.')

    await set_groups_and_limits(client, updates)

    req.log.info(`update ${ updates.map(p => `(${ p.join(', ') })`).join(', ') }`)

    res.json({})
  }),

  'add-subject': http_post(async (req, res, { auth_token, client }) => {
      if (auth_token !== admin_token) return forbidden(res)

      const { first_name, last_name, email } = req.body

      if (first_name == null) return bad_request(res, 'missing-field', 'Missing first name.')
      if (last_name == null) return bad_request(res, 'missing-field', 'Missing last name.')
      if (email == null) return bad_request(res, 'missing-field', 'Missing email.')

      const subject_id = await generate_new_id(client)

      await add_subject(client, subject_id, first_name, last_name, email, nanoid())

      res.json({
        data: { subject_id }
      })
  }),

  'get-subject': http_get(async (req, res, { auth_token, client }) => {
    const { subject_id } = req.query as Record<string, string>

    if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')

    const result = await get_subject_by_subject_id(client, subject_id)

    if (auth_token === admin_token) {
      if (result.rows.length !== 0) {
        res.json({ data: result.rows[0] })
      } else {
        res.json({})
      }
    } else {
      if (result.rows.length !== 0 && auth_token === result.rows[0].secret) {
        res.json({ data: result.rows[0] })
      } else {
        return forbidden(res)
      }
    }
  }),

  'get-all-subjects': http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res)

    const result = await get_subjects(client)

    res.json({ data: result.rows })
  }),

  'submit-report': http_post(async (req, res, { auth_token, client }) => {
    const { subject_id, period, day, reports } = req.body

    if (subject_id == null) return bad_request(res, 'missing-field', 'Missing subject ID.')
    if (period == null) return bad_request(res, 'missing-field', 'Missing report period.')
    if (day == null) return bad_request(res, 'missing-field', 'Missing report day.')

    if (auth_token !== admin_token) {
      const result = await check_secret(client, subject_id)

      if (result.rows.length === 0 || auth_token !== result.rows[0].secret) return forbidden(res)
    }

    const raw_reports = reports as RawReport[]

    const db_reports: DBReport[] = raw_reports.map(
      r => [subject_id, r.application_name, period, day, r.usage_seconds]
    )

    await add_reports(client, db_reports)

    // we use `on conflict do nothing`, so the query will succeed even if there are duplicates

    try {
      await add_reports(client, db_reports)
    } catch (err) {
      return bad_request(
        res,
        'database-error',
        (err as DatabaseError).message
      )

      throw err
    }

    res.json({})
  }),

  'get-all-reports': http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res)

    const result = await get_reports(client)

    res.json({ data: result.rows })
  })
}

export default endpoints

