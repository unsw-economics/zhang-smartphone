import { ClientBase } from 'pg'

export function add_subject(client: ClientBase, subject_id: string, test_group: number, first_name: string, last_name: string, email: string) {
  return client.query(
    'insert into subjects (subject_id, test_group, first_name, last_name, email) values ($1, $2, $3, $4, $5)',
    [subject_id, test_group, first_name, last_name, email]
  )
}

export function get_subject_by_subject_id(client: ClientBase, subject_id: string) {
  return client.query('select * from subjects where subject_id = $1', [subject_id])
}

export function get_subjects(client: ClientBase) {
  return client.query('select * from subjects')
}

export function check_id(client: ClientBase, subject_id: string) {
  return client.query('select subject_id from subjects where subject_id = $1', [subject_id])
}
