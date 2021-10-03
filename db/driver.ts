import { ClientBase, QueryResult } from 'pg'

// subjects

export function add_subject(client: ClientBase, subject_id: string, first_name: string, last_name: string, email: string, secret: string) {
  return client.query(
    'insert into subjects (subject_id, first_name, last_name, email, secret) values ($1, $2, $3, $4, $5)',
    [subject_id, first_name, last_name, email, secret]
  )
}

export function get_subject_by_subject_id(client: ClientBase, subject_id: string) {
  return client.query('select * from subjects where subject_id = $1', [subject_id])
}

export function get_subjects(client: ClientBase) {
  return client.query('select * from subjects')
}

function set_subject_field<T = string>(client: ClientBase, field: string, subject_id: string, value: T) {
  return client.query(
    `update subjects set ${ field } = $1 where subject_id = $2`,
    [value, subject_id]
  )
}

function check_subject_field<T>(client: ClientBase, subject_id: string, field: string): Promise<QueryResult<T>> {
  return client.query<T>(`select ${ field } from subjects where subject_id = $1`, [subject_id])
}

type SingleResult<ResultField extends string, T> = {
  [k in ResultField]: T
}

export function set_test_group(client: ClientBase, subject_id: string, test_group: number) {
  return set_subject_field<number>(client, 'test_group', subject_id, test_group)
}

type IDGroupPair = [string, number]

export function set_treatment_limit(client: ClientBase, subject_id: string, treatment_limit: number) {
  return set_subject_field<number>(client, 'treatment_limit', subject_id, treatment_limit)
}

export function set_identified(client: ClientBase, subject_id: string) {
  return set_subject_field<boolean>(client, 'identified', subject_id, true)
}

function set_fields_on_subjects<T extends any[]>(client: ClientBase, fields: string[], updates: [string, ...T][], options?: ExpandOptions ) {
  const field_setters = fields.map(f => `${ f } = t.${ f }`).join(', ')
  const table = expand_args(updates.length, fields.length + 1, options)

  return client.query(
    `update subjects as s set ${ field_setters } from (values ${ table }) as t(subject_id, ${ fields.join(', ') }) where s.subject_id = t.subject_id`,
    updates.flat()
  )
}

export function set_groups_and_limits(client: ClientBase, updates: [string, number, number][]) {
  return set_fields_on_subjects<[number, number]>(client, ['test_group', 'treatment_limit'], updates, { types: [null, 'int', 'int'] })
}

export function check_id(client: ClientBase, subject_id: string) {
  return check_subject_field<SingleResult<'subject_id', string>>(client, subject_id, 'subject_id')
}

export function check_test_group(client: ClientBase, subject_id: string) {
  return check_subject_field<SingleResult<'test_group', number>>(client, subject_id, 'test_group')
}

export function check_treatment_limit(client: ClientBase, subject_id: string) {
  return check_subject_field<SingleResult<'treatment_limit', number>>(client, subject_id, 'treatment_limit')
}

export function check_secret(client: ClientBase, subject_id: string) {
  return check_subject_field<SingleResult<'secret', string>>(client, subject_id, 'secret')
}

// reports

export type DBReport = [string, string, string, number, number]

export function get_reports(client: ClientBase) {
  return client.query('select * from reports')
}

export function add_reports(client: ClientBase, app_reports: DBReport[]) {
  return client.query(
    `insert into reports (subject_id, application_name, period, day, usage_seconds) values ${ expand_args(app_reports.length, 5) } on conflict do nothing`,
    app_reports.flat()
  )
}

type ExpandOptions = {
  types?: (string | null)[],
  start_index?: number
}

function expand_args(rows: number, columns: number, options?: ExpandOptions): string {
  const params = []

  const { types, start_index } = { types: [], start_index: 1, ...options }

  for (let i = 0; i < rows; i++) {
    const tokens = []

    for (let j = 0; j < columns; j++) {
      const base = `$${ i * columns + j + start_index }`
      tokens.push(
        types[j] == null
          ? base
          : `${ base }::${ types[j] }`
      )
    }

    params.push(`(${ tokens.join(',') })`)
  }

  return params.join(',')
}

