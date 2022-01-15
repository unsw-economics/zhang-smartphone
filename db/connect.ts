import { Client, ClientBase } from 'pg'

interface Global {
  pg_client?: ClientBase
}

const g = global as Global

const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env

export default async function(options: Record<any, unknown> = {}): Promise<ClientBase> {
  if (g.pg_client != null) return g.pg_client

  const client = new Client({
    user: DB_USER,
    host: DB_HOST,
    password: DB_PASS,
    database: DB_NAME,
    ...options
  })

  g.pg_client = client

  await client.connect()

  return client
}

