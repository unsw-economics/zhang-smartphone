import { ClientBase, QueryResult } from "pg";

// subjects

export function add_subject(
  client: ClientBase,
  subject_id: string,
  email: string,
  secret: string
) {
  return client.query(
    "insert into subjects (subject_id, email, secret, test_group) values ($1, $2, $3, 0)",
    [subject_id, email, secret]
  );
}

export function update_subject_id(
  client: ClientBase,
  subject_id: string,
  email: string
) {
  return client.query("update subjects set subject_id = $1 where email = $2", [
    subject_id,
    email,
  ]);
}

export function get_subject_by_subject_id(
  client: ClientBase,
  subject_id: string
) {
  return client.query("select * from subjects where subject_id = $1", [
    subject_id,
  ]);
}

export function get_subject_by_email(client: ClientBase, email: string) {
  return client.query("SELECT * FROM subjects WHERE LOWER(email) = LOWER($1)", [
    email,
  ]);
}

export function get_subjects(client: ClientBase, group?: string) {
  if (group) {
    return client.query("select * from subjects_view where study_group = $1", [
      group,
    ]);
  }

  return client.query("select * from subjects_view");
}

function set_subject_field<T = string>(
  client: ClientBase,
  field: string,
  subject_id: string,
  value: T
) {
  return client.query(
    `update subjects set ${field} = $1 where subject_id = $2`,
    [value, subject_id]
  );
}

function check_subject_fields<T extends Record<string, string>>(
  client: ClientBase,
  subject_id: string,
  fields: string[]
): Promise<QueryResult<T>> {
  return client.query<T>(
    `select ${fields.join(", ")} from subjects where subject_id = $1`,
    [subject_id]
  );
}

export function set_test_group(
  client: ClientBase,
  subject_id: string,
  test_group: number
) {
  return set_subject_field<number>(
    client,
    "test_group",
    subject_id,
    test_group
  );
}

type IDGroupPair = [string, number];

export function set_treatment_limit(
  client: ClientBase,
  subject_id: string,
  treatment_limit: number
) {
  return set_subject_field<number>(
    client,
    "treatment_limit",
    subject_id,
    treatment_limit
  );
}

export function set_identified(client: ClientBase, subject_id: string) {
  return set_subject_field<boolean>(client, "identified", subject_id, true);
}

function set_fields_on_subjects<T extends any[]>(
  client: ClientBase,
  fields: string[],
  updates: [string, ...T][],
  options?: ExpandOptions
) {
  const field_setters = fields.map((f) => `${f} = t.${f}`).join(", ");
  const table = expand_args(updates.length, fields.length + 1, options);

  return client.query(
    `update subjects as s set ${field_setters} from (values ${table}) as t(subject_id, ${fields.join(
      ", "
    )}) where s.subject_id = t.subject_id`,
    updates.flat()
  );
}

export function set_test_params(
  client: ClientBase,
  updates: [string, number, number | null, number][]
) {
  return set_fields_on_subjects<[number, number | null, number]>(
    client,
    ["test_group", "treatment_intensity", "treatment_limit"],
    updates,
    { types: [null, "int", "int", "int"] }
  );
}

export function check_id(client: ClientBase, subject_id: string) {
  return check_subject_fields<{ subject_id: string }>(client, subject_id, [
    "subject_id",
  ]);
}

export function check_secret(client: ClientBase, subject_id: string) {
  return check_subject_fields<{ secret: string }>(client, subject_id, [
    "secret",
  ]);
}

export async function email_exists(
  client: ClientBase,
  email: string
): Promise<boolean> {
  return (
    (
      await client.query<{ count: number }>(
        `select count(*) from subjects where email = '${email}'`
      )
    ).rows[0].count > 0
  );
}

// reports

export type DBReport = [string, string, string, number, number];

export function get_reports(client: ClientBase) {
  return client.query("select * from reports");
}

export function add_reports(client: ClientBase, app_reports: DBReport[]) {
  return client.query(
    `insert into reports (subject_id, application_name, period, day, usage) values ${expand_args(
      app_reports.length,
      5
    )} on conflict do nothing`,
    app_reports.flat()
  );
}

export async function get_study_dates(
  client: ClientBase,
  subject_id: string
): Promise<{
  baseline_date: string;
  treatment_date: string;
  endline_date: string;
  over_date: string;
}> {
  return (
    (
      await client.query(
        `select baseline_date::text, treatment_date::text, endline_date::text, over_date::text from subjects s join study_dates d on s.study_group = d.period_name where s.subject_id = $1`,
        [subject_id]
      )
    ).rows[0] || {
      baseline_date: null,
      treatment_date: null,
      endline_date: null,
      over_date: null,
    }
  );
}

type ExpandOptions = {
  types?: (string | null)[];
  start_index?: number;
};

function expand_args(
  rows: number,
  columns: number,
  options?: ExpandOptions
): string {
  const params = [];

  const { types, start_index } = { types: [], start_index: 1, ...options };

  for (let i = 0; i < rows; i++) {
    const tokens = [];

    for (let j = 0; j < columns; j++) {
      const base = `$${i * columns + j + start_index}`;
      tokens.push(types[j] == null ? base : `${base}::${types[j]}`);
    }

    params.push(`(${tokens.join(",")})`);
  }

  return params.join(",");
}

// crash reports

export function add_crash_report(
  client: ClientBase,
  subject_id: string | null,
  report: string
) {
  return client.query(
    "insert into crash_reports (subject_id, report) values ($1, $2)",
    [subject_id, report]
  );
}

interface usageHash {
  [key: string]: number;
}

export function add_usage(
  client: ClientBase,
  subject_id: string,
  usage: usageHash
) {
  const usage_array = Object.keys(usage).map((key) => [
    subject_id,
    key,
    usage[key],
  ]);

  return client.query(
    `insert into usage_backup (subject_id, date_reported, usage) values ${expand_args(
      Object.keys(usage).length,
      3
    )}`,
    usage_array.flat()
  );
}

export function get_all_study_dates(client: ClientBase) {
  return client.query("select * from study_dates");
}

export function get_all_usage(client: ClientBase, group?: string) {
  if (group) {
    return client.query(`select * from usage_view where study_group = $1`, [
      group,
    ]);
  }

  return client.query("select * from usage_view");
}

export function get_usage_summary(
  client: ClientBase,
  group?: string,
  start_date?: string,
  end_date?: string
) {
  if (group && start_date && end_date) {
    return client.query(
      "select * from calculate_usage($1, $2) where study_group=$3",
      [start_date, end_date, group]
    );
  }

  if (group) {
    return client.query("select * from summary_view where study_group = $1", [
      group,
    ]);
  }
  return client.query("select * from summary_view");
}
