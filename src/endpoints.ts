import { ClientBase, DatabaseError } from "pg";
import { NextApiRequest, NextApiResponse } from "next";
import {
  add_subject,
  update_subject_id,
  get_subject_by_subject_id,
  get_subjects,
  set_identified,
  check_id,
  check_secret,
  email_exists,
  set_test_params,
  get_reports,
  add_reports,
  add_crash_report,
  DBReport,
  get_study_dates,
  add_usage,
  get_all_study_dates,
  get_all_usage,
  get_usage_summary,
  get_subject_by_email,
} from "../db/driver";
import { generate_id } from "./subject";
import { bad_request, forbidden, ok } from "./response";
import { nanoid } from "nanoid";

export type EndpointExtra = {
  method: string;
  auth_token?: string;
  client: ClientBase;
};

export type Endpoint = (
  req: NextApiRequest,
  res: NextApiResponse,
  extra: EndpointExtra
) => Promise<void>;

export type EndpointCarrier = {
  [k: string]: Endpoint;
};

const admin_token = process.env.ADMIN_TOKEN;
const qualtrics_token = process.env.QUALTRICS_TOKEN;

type RawReport = {
  application_name: string;
  usage: number;
};

async function generate_new_id(client: ClientBase) {
  let id = generate_id();
  let ready = false;

  while (!ready) {
    const result = await check_id(client, id);

    if (result.rows.length === 0) {
      ready = true;
    } else {
      id = generate_id();
    }
  }

  return id;
}

function http_get(endpoint: Endpoint): Endpoint {
  return async function (req, res, extra) {
    if (extra.method === "OPTIONS") {
      return ok(res);
    }

    if (extra.method !== "GET")
      return bad_request(
        res,
        "wrong-method",
        "This endpoint accepts GET requests only."
      );

    return endpoint(req, res, extra);
  };
}

function http_post(endpoint: Endpoint): Endpoint {
  return async function (req, res, extra) {
    if (extra.method === "OPTIONS") {
      return ok(res);
    }

    if (extra.method !== "POST")
      return bad_request(
        res,
        "wrong-method",
        "This endpoint accepts POST requests only."
      );

    return endpoint(req, res, extra);
  };
}

function hashStringTo8Digit(input: string) {
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    hash += input.toLowerCase().charCodeAt(i);
    hash += hash << 10;
    hash ^= hash >> 6;
  }

  hash += hash << 3;
  hash ^= hash >> 11;
  hash += hash << 15;

  // Ensure the result lies in the range [0, 89999999].
  hash = Math.abs(hash % 90000000);

  // Adjust to ensure it's an 8-digit number without leading zeros: [10000000, 99999999].
  return hash + 10000000;
}

const endpoints: EndpointCarrier = {
  identify: http_post(async (req, res, { client }) => {
    // Due to time constraints, the subject Id is actually an email.
    // TODO: Refactor this to use an email variable
    const { subject_id: email } = req.body;

    if (
      email === null ||
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)
    )
      return bad_request(res, "missing-field", "Incorrect email format.");

    const existingSubject = await get_subject_by_email(client, email);
    if (existingSubject.rows.length > 0) {
      return res.json({
        data: {
          auth_token: existingSubject.rows[0].secret,
          subject_id: existingSubject.rows[0].subject_id,
        },
      });
    }

    // convert email to numbers
    let subject_id = hashStringTo8Digit(email).toString();

    let result = await get_subject_by_subject_id(client, subject_id);
    let secret = nanoid();

    if (result.rows.length === 0) {
      try {
        await add_subject(client, subject_id, email, secret);
        await set_identified(client, subject_id);

        return res.json({
          data: {
            auth_token: secret,
            subject_id,
          },
        });
      } catch (err) {
        result = await get_subject_by_email(client, email);
        if (!result.rows[0]) {
          return bad_request(res, "database-error", "Subject not found.");
        }
        subject_id = result.rows[0].subject_id;
      }
    }

    const subject = result.rows[0];

    if (!subject) {
      return bad_request(res, "database-error", "Subject not found.");
    }

    if (!subject?.identified) {
      await set_identified(client, subject_id);
      req.log.info(`subject ${subject_id} identified`);
    } else {
      req.log.info(`subject ${subject_id} identified again`);
      secret = subject.secret;
    }

    res.json({
      data: {
        auth_token: secret,
        subject_id,
      },
    });
  }),

  "get-test-params": http_get(async (req, res, { auth_token, client }) => {
    const { subject_id } = req.query as Record<string, string>;

    const result = await get_subject_by_subject_id(client, subject_id);

    if (
      auth_token === admin_token ||
      (result.rows.length !== 0 && auth_token === result.rows[0].secret)
    ) {
      const subject = result.rows[0];

      res.json({
        data: {
          test_group: subject.test_group,
          treatment_intensity: subject.treatment_intensity,
          treatment_limit: subject.treatment_limit,
        },
      });
    } else {
      return forbidden(res);
    }
  }),

  "set-test-params": http_post(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res);

    const updates = req.body;

    if (updates == null || updates.constructor !== Array)
      return bad_request(
        res,
        "incorrect-format",
        "Expecting array of [subject_id, test_group, treatment_limit] triples."
      );

    await set_test_params(client, updates);

    req.log.info(
      `update ${updates.map((p) => `(${p.join(", ")})`).join(", ")}`
    );

    res.json({});
  }),

  "add-subject": http_post(async (req, res, { auth_token, client }) => {
    if (auth_token !== qualtrics_token && auth_token !== admin_token)
      return forbidden(res);

    const { subject_id, email } = req.body;

    if (subject_id == null)
      return bad_request(res, "missing-field", "Missing subject ID.");
    if (email == null)
      return bad_request(res, "missing-field", "Missing email.");

    if (await email_exists(client, email)) {
      await update_subject_id(client, subject_id, email);
    } else {
      await add_subject(client, subject_id, email, nanoid());
    }

    res.json({
      data: { subject_id },
    });
  }),

  "get-subject": http_get(async (req, res, { auth_token, client }) => {
    const { subject_id } = req.query as Record<string, string>;

    if (subject_id == null)
      return bad_request(res, "missing-field", "Missing subject ID.");

    const result = await get_subject_by_subject_id(client, subject_id);

    if (auth_token === admin_token) {
      if (result.rows.length !== 0) {
        res.json({ data: result.rows[0] });
      } else {
        res.json({});
      }
    } else {
      if (result.rows.length !== 0 && auth_token === result.rows[0].secret) {
        res.json({ data: result.rows[0] });
      } else {
        return forbidden(res);
      }
    }
  }),

  "get-all-subjects": http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res);

    const { group } = req.query as Record<string, string | undefined>;

    const result = await get_subjects(client, group);

    res.json({ data: result.rows });
  }),

  "submit-report": http_post(async (req, res, { auth_token, client }) => {
    const { subject_id, period, day, reports } = req.body;

    if (subject_id == null)
      return bad_request(res, "missing-field", "Missing subject ID.");
    if (period == null)
      return bad_request(res, "missing-field", "Missing report period.");
    if (day == null)
      return bad_request(res, "missing-field", "Missing report day.");

    if (auth_token !== admin_token) {
      const result = await check_secret(client, subject_id);

      if (result.rows.length === 0 || auth_token !== result.rows[0].secret)
        return forbidden(res);
    }

    const raw_reports = reports as RawReport[];

    const db_reports: DBReport[] = raw_reports.map((r) => [
      subject_id,
      r.application_name,
      period,
      day,
      r.usage,
    ]);

    await add_reports(client, db_reports);

    // we use `on conflict do nothing`, so the query will succeed even if there are duplicates

    try {
      await add_reports(client, db_reports);
    } catch (err) {
      return bad_request(res, "database-error", (err as DatabaseError).message);

      throw err;
    }

    res.json({});
  }),

  "get-all-reports": http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res);

    const result = await get_reports(client);

    res.json({ data: result.rows });
  }),

  acra: http_post(async (req, res, { auth_token, client }) => {
    await add_crash_report(
      client,
      req.body.CUSTOM_DATA.SUBJECT_ID || null,
      JSON.stringify(req.body)
    );

    res.json({});
  }),

  "get-dates": http_get(async (req, res, { auth_token, client }) => {
    const { subject_id } = req.query as Record<string, string>;

    const studyDates = await get_study_dates(client, subject_id);

    res.json({ data: studyDates });
  }),

  "submit-usage": http_post(async (req, res, { auth_token, client }) => {
    const { subject_id, usage } = req.body;

    if (auth_token !== admin_token) {
      const result = await check_secret(client, subject_id);

      if (result.rows.length === 0 || auth_token !== result.rows[0].secret)
        return forbidden(res);
    }

    if (Object.keys(usage).length !== 0)
      await add_usage(client, subject_id, usage);

    res.json({});
  }),

  "get-all-dates": http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res);

    const result = await get_all_study_dates(client);

    res.json({ data: result.rows });
  }),

  "get-all-usage": http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res);

    const { group } = req.query as Record<string, string | undefined>;

    const result = await get_all_usage(client, group);

    res.json({ data: result.rows });
  }),

  "get-usage-summary": http_get(async (req, res, { auth_token, client }) => {
    if (auth_token !== admin_token) return forbidden(res);

    const { group, start_date, end_date } = req.query as Record<
      string,
      string | undefined
    >;

    const result = await get_usage_summary(client, group, start_date, end_date);

    res.json({ data: result.rows });
  }),
};

export default endpoints;
