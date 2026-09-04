export function createSmartLearningService({
  sql
}) {
  if (typeof sql !== 'function') {
    throw new TypeError('createSmartLearningService requires sql')
  }

  let smartLearningSchemaReady=false

  async function ensureSmartLearningSchema(){

    if(smartLearningSchemaReady)return

    await sql(`
      CREATE TABLE IF NOT EXISTS smart_request_learning (
        id text PRIMARY KEY,
        normalized_text text NOT NULL UNIQUE,
        sample_text text NOT NULL,
        occurrences integer NOT NULL DEFAULT 1,
        status text NOT NULL DEFAULT 'new',
        learned_specialty text,
        learned_service text,
        admin_note text,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz,
        reviewed_by text
      )
    `)

    await sql(`
      CREATE INDEX IF NOT EXISTS smart_request_learning_status_idx
      ON smart_request_learning(status)
    `)

    await sql(`
      CREATE INDEX IF NOT EXISTS smart_request_learning_occurrences_idx
      ON smart_request_learning(occurrences DESC)
    `)

    smartLearningSchemaReady=true
  }

  return Object.freeze({
    ensureSmartLearningSchema
  })
}
