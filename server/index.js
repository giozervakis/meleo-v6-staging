import { config } from './config.js'

// MELEO v6.0: PostgreSQL relational backend όταν υπάρχει DATABASE_URL.
// Χωρίς DATABASE_URL χρησιμοποιείται το legacy dev backend ώστε το demo να
// συνεχίζει να τρέχει με `npm run dev` χωρίς Docker.
if (config.databaseUrl) {
  await import('./relational/app.js')
} else {
  if (config.isProd) throw new Error('DATABASE_URL is required in production')
  console.warn('[MELEO v6.0] DATABASE_URL δεν ορίστηκε — εκκινεί το local demo backend. Για το relational backend χρησιμοποίησε npm run dev:stack.')
  await import('./legacy-app.js')
}
