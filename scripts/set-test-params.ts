import get_client from '../db/connect'
import { parse } from 'csv-parse'
import fs from 'fs'
import path from 'path'

const csv = process.argv[2]

async function main() {
  const client_promise = get_client({ ssl: true })

  const ifile = path.resolve(csv)
  const parser = parse({ from: 2 })

  fs.createReadStream(ifile, 'utf8').pipe(parser)

  const updates = []

  for await (const record of parser) {
    updates.push([
      `'${ record[0] }'`,
      Number(record[1]) * 2,
      record[2] === 'control' ? 0
        : record[2] === 'treatment2_information' ? 1
        : 2
    ])
  }

  const values = updates.map(u => `(${u.join(',')})`).join(',')

  console.log(values)

  const client = await client_promise

  const query = `
    update subjects s set
      test_group = x.test_group,
      treatment_intensity = x.treatment_intensity
      from (values ${ values }) x(subject_id, treatment_intensity, test_group)
      where s.subject_id = x.subject_id
  `

  console.log('executing:', query)

  await client.query(query)

  process.exit()
}

main()

export {}
