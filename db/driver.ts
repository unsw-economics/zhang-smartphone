import { ClientBase } from 'pg'

export function add_subject(client: ClientBase, subject_id: string, first_name: string, last_name: string, email: string, secret: string) {
  return client.query(
    'insert into subjects (subject_id, first_name, last_name, email, secret) values ($1, $2, $3, $4, $5)',
    [subject_id, first_name, last_name, email, secret]
  )
}

export function set_test_group(client: ClientBase, subject_id: string, test_group: string) {
  return client.query(
    'update subjects set test_group = $1 where subject_id = $2',
    [test_group, subject_id]
  )
}

export function get_subject_by_subject_id(client: ClientBase, subject_id: string) {
  return client.query('select * from subjects where subject_id = $1', [subject_id])
}

export function get_subjects(client: ClientBase) {
  return client.query('select * from subjects')
}

export function check_subject_field(client: ClientBase, subject_id: string, field: string) {
  return client.query(`select ${ field } from subjects where subject_id = $1`, [subject_id])
}

export function check_id(client: ClientBase, subject_id: string) {
  return check_subject_field(client, subject_id, 'subject_id')
}

export function check_test_group(client: ClientBase, subject_id: string) {
  return check_subject_field(client, subject_id, 'test_group')
}

export function check_secret(client: ClientBase, subject_id: string) {
  return check_subject_field(client, subject_id, 'secret')
}

export type DBReport = [string, string, string, number, number]

export function get_reports(client: ClientBase) {
  return client.query('select * from reports')
}

export function add_reports(client: ClientBase, app_reports: DBReport[]) {
  return client.query(
    `insert into reports (subject_id, application_id, period, day, usage_seconds) values ${ expand_args(app_reports.length, 5) } on conflict do nothing`,
    app_reports.flat()
  )
}

function expand_args(rows: number, columns: number, start_index = 1): string {
  const params = []

  for (let i = 0; i < rows; i++) {
    const tokens = []

    for (let j = 0; j < columns; j++) {
      tokens.push(`$${ i * columns + j + start_index }`)
    }

    params.push(`(${ tokens.join(',') })`)
  }

  return params.join(',')
}

