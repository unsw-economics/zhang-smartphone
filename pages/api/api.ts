import { ClientBase } from 'pg'
import { NextApiRequest, NextApiResponse } from 'next'
import get_client from '../../db/connect'
import { add_subject, get_subject_by_subject_id, get_subjects, check_id } from '../../db/driver'
import { generate_id } from '../../src/subject'

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

export default async function handle(req: NextApiRequest, res: NextApiResponse) {

  const q = req.query

  try {
    switch (q.method) {
      case 'add-subject':
        return await handle_method(
          res,
          () => {
            const errors = []

            if (q.first_name == null) errors.push('Missing first name.')
            if (q.last_name == null) errors.push('Missing last name.')
            if (q.email == null) errors.push('Missing email.')

            return errors
          },
          async () => {
            const client = await get_client()

            const subject_id = await generate_new_id(client)

            await add_subject(client, subject_id, 0, q.first_name as string, q.last_name as string, q.email as string)

            res.json({ subject_id })
          }
        )
      case 'get-subject':
        return await handle_method(
          res,
          () => {
            const errors = []

            if (q.subject_id == null) errors.push('Missing subject id.')

            return errors
          },
          async () => {
            const client = await get_client()

            const result = await get_subject_by_subject_id(client, q.subject_id as string)

            if (result.rows.length !== 0) {
              res.json({ data: result.rows[0] })
            } else {
              res.json({ data: {} })
            }
          }
        )
      case 'get-all-subjects':
        return await handle_method(
          res,
          () => [],
          async () => {
            const client = await get_client()

            const result = await get_subjects(client)

            res.json({ data: result.rows })
          }
        )
      default:
        res.statusCode = 400
        res.json({ message: 'Unrecognized method.' })
        return
    }
  } catch (err) {
    res.statusCode = 500
    res.json({ message: JSON.stringify(err) })
  }
}
