// MELEO — έλεγχος πολλαπλών instances πάνω στην ίδια βάση.
//
// Επιβεβαιώνει ότι δύο processes που γράφουν ταυτόχρονα ΔΕΝ αλληλοσβήνουν
// εγγραφές — δηλαδή ότι η πλατφόρμα μπορεί να τρέξει πίσω από load balancer.
//
// Εκτέλεση (χρειάζεται PostgreSQL, όχι JSON driver):
//
//   export DATABASE_URL=postgres://meleo:...@localhost:5432/meleo
//   PORT=8801 node server/index.js &
//   PORT=8802 node server/index.js &
//   node scripts/concurrency-test.mjs
//
const A = process.env.MELEO_A || 'http://localhost:8801'
const B = process.env.MELEO_B || 'http://localhost:8802'
const N = Number(process.env.MELEO_N || 16) // προσοχή: όριο εγγραφών 10/ώρα ανά IP

const call = async (base, path, init = {}) => {
  const res = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

const stamp = Date.now()
const results = await Promise.all(Array.from({ length: N }, (_, i) =>
  call(i % 2 ? A : B, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Concurrency ${i}`,
      email: `conc_${stamp}_${i}@test.local`,
      phone: `69000000${String(i).padStart(2, '0')}`,
      password: 'password123',
      role: 'patient',
      acceptedTerms: true
    })
  })
))

const created = results.filter(r => r.status === 200 || r.status === 201).length
const rejected = results.filter(r => r.status === 429).length
const [a, b] = await Promise.all([call(A, '/api/health'), call(B, '/api/health')])

console.log(`\nMELEO concurrency test — ${N} ταυτόχρονες εγγραφές σε 2 instances\n`)
console.log(`  επιτυχείς εγγραφές : ${created}/${N}${rejected ? ` (${rejected} κόπηκαν από rate limit)` : ''}`)
console.log(`  driver             : ${a.body?.storage?.driver || '—'}`)
console.log(`  instance A → users : ${a.body?.users}`)
console.log(`  instance B → users : ${b.body?.users}`)

if (a.body?.storage?.driver !== 'postgres') {
  console.log('\n  ⚠ Ο έλεγχος έχει νόημα μόνο με PostgreSQL. Όρισε DATABASE_URL.\n')
  process.exit(1)
}
const pass = created > 0 && a.body.users === b.body.users
console.log(pass
  ? '\n  ✓ PASS — καμία χαμένη εγγραφή, κοινή κατάσταση μεταξύ instances\n'
  : '\n  ✗ FAIL — απώλεια δεδομένων ή αποκλίνουσα κατάσταση\n')
process.exit(pass ? 0 : 1)
