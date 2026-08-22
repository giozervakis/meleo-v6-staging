/**
 * MELEO — end-to-end smoke test του API.
 * Χρήση:  node scripts/smoke-test.mjs [http://localhost:8787]
 * Τρέχει ολόκληρη τη ροή (εγγραφή → συνδρομή → προφίλ → verification →
 * έγκριση admin → αναζήτηση → κράτηση → προσφορά → ολοκλήρωση → αξιολόγηση)
 * και ελέγχει ότι τα κρίσιμα κενά ασφαλείας είναι κλειστά.
 */
const BASE = process.argv[2] || 'http://localhost:8787'
let pass = 0, fail = 0
const results = []

function check(name, ok, extra = '') {
  if (ok) { pass++; results.push(`  ✓ ${name}`) }
  else { fail++; results.push(`  ✗ ${name} ${extra}`) }
}

async function call(method, path, { token, body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  let data = null
  try { data = await r.json() } catch { data = null }
  return { status: r.status, data }
}

const uniq = Date.now().toString(36)

async function run() {
  // --- Εγγραφή ---
  const badPass = await call('POST', '/api/auth/register', { body: { name: 'Test Weak', email: `weak_${uniq}@t.gr`, phone: '6900000001', password: 'short', acceptedTerms: true } })
  check('Κωδικός < 8 χαρακτήρες απορρίπτεται', badPass.status === 400)

  const noTerms = await call('POST', '/api/auth/register', { body: { name: 'Test Terms', email: `terms_${uniq}@t.gr`, phone: '6900000002', password: 'password123' } })
  check('Εγγραφή χωρίς αποδοχή όρων απορρίπτεται', noTerms.status === 400)

  const pro = await call('POST', '/api/auth/register', { body: { name: 'Τεστ Επαγγελματίας', email: `pro_${uniq}@t.gr`, phone: '6900000003', password: 'password123', role: 'professional', acceptedTerms: true } })
  check('Εγγραφή επαγγελματία', pro.status === 200 && !!pro.data?.token, JSON.stringify(pro.data))
  const proToken = pro.data?.token

  const patient = await call('POST', '/api/auth/register', { body: { name: 'Τεστ Ασθενής', email: `pat_${uniq}@t.gr`, phone: '6900000004', password: 'password123', role: 'patient', acceptedTerms: true } })
  check('Εγγραφή συνοδού/ασθενή', patient.status === 200 && !!patient.data?.token)
  const patToken = patient.data?.token

  // --- Κρίσιμο: mass assignment ---
  const hack = await call('PUT', '/api/professional/profile', {
    token: proToken,
    body: { title: 'Hacker', specialty: 'Νοσηλευτική', city: 'Ηράκλειο', verified: true, featured: true, subscriptionStatus: 'active', subscriptionPlan: 'premium', rating: 5, reviews: 999 }
  })
  const hacked = hack.data
  check('Ο επαγγελματίας ΔΕΝ μπορεί να αυτο-πιστοποιηθεί (verified)', hacked?.verified === false, JSON.stringify(hacked?.verified))
  check('Ο επαγγελματίας ΔΕΝ μπορεί να παρακάμψει την πληρωμή', hacked?.subscriptionStatus !== 'active', String(hacked?.subscriptionStatus))
  check('Ο επαγγελματίας ΔΕΝ μπορεί να αλλάξει rating/reviews', hacked?.rating === 0 && hacked?.reviews === 0)
  check('Ο επαγγελματίας ΔΕΝ μπορεί να βάλει σήμανση featured', hacked?.featured === false)

  // --- Verification πριν τη συνδρομή ---
  const earlyVerify = await call('POST', '/api/professional/verification', { token: proToken, body: { licenseNumber: 'X1' } })
  check('Verification χωρίς ενεργή συνδρομή → 402', earlyVerify.status === 402)

  // --- Checkout ---
  const badPlan = await call('POST', '/api/professional/subscription/checkout', { token: proToken, body: { plan: 'free' } })
  check('Μη έγκυρο πακέτο απορρίπτεται', badPlan.status === 400)

  const checkout = await call('POST', '/api/professional/subscription/checkout', { token: proToken, body: { plan: 'premium' } })
  check('Checkout συνδρομής', checkout.status === 200, JSON.stringify(checkout.data))
  check('Το checkout επιστρέφει mode (stripe/demo)', ['stripe', 'demo'].includes(checkout.data?.mode), String(checkout.data?.mode))
  if (checkout.data?.mode === 'stripe') check('Το Stripe επιστρέφει URL πληρωμής', typeof checkout.data.url === 'string' && checkout.data.url.startsWith('https://'))

  const sub = await call('GET', '/api/professional/subscription', { token: proToken })
  check('Η συνδρομή είναι ενεργή μετά το checkout', sub.data?.status === 'active', JSON.stringify(sub.data))
  check('Το πακέτο είναι PREMIUM · 14,99€', sub.data?.plan === 'premium' && sub.data?.price === 14.99)

  // --- Προφίλ ---
  const profile = await call('PUT', '/api/professional/profile', {
    token: proToken,
    body: { title: 'Νοσηλευτής', specialty: 'Νοσηλευτική', city: 'Ηράκλειο', pricingMode: 'from', price: 28, years: 5, bio: 'Τεστ', services: ['Χορήγηση αγωγής', 'Περιποίηση τραύματος'], availability: ['10:00', '18:00'] }
  })
  check('Αποθήκευση επαγγελματικού προφίλ', profile.status === 200 && profile.data?.city === 'Ηράκλειο')
  check('Άκυρη ειδικότητα δεν περνάει', (await call('PUT', '/api/professional/profile', { token: proToken, body: { specialty: '<script>x</script>' } })).data?.specialty === '')

  // Επαναφορά σωστής ειδικότητας
  await call('PUT', '/api/professional/profile', { token: proToken, body: { specialty: 'Νοσηλευτική' } })

  // --- Δεν εμφανίζεται δημόσια πριν την έγκριση ---
  const beforeApproval = await call('GET', '/api/professionals')
  const proId = profile.data?.id
  check('Μη εγκεκριμένος επαγγελματίας ΔΕΝ εμφανίζεται στην αναζήτηση', !(beforeApproval.data || []).some(p => p.id === proId))

  // --- Verification ---
  const verify = await call('POST', '/api/professional/verification', { token: proToken, body: { licenseNumber: 'ΜΗΤΡ-12345', notes: 'τεστ' } })
  check('Υποβολή αιτήματος verification', verify.status === 200 && verify.data?.status === 'pending', JSON.stringify(verify.data))

  // --- Admin ---
  const admin = await call('POST', '/api/auth/login', { body: { email: 'admin@meleo.gr', password: 'admin123' } })
  check('Σύνδεση admin', admin.status === 200)
  const adminToken = admin.data?.token

  const nonAdmin = await call('GET', '/api/admin/stats', { token: patToken })
  check('Μη-admin δεν βλέπει admin stats', nonAdmin.status === 403)

  const decision = await call('PATCH', `/api/admin/verifications/${verify.data?.id}`, { token: adminToken, body: { status: 'approved' } })
  check('Έγκριση verification από admin', decision.status === 200 && decision.data?.status === 'approved')

  const afterApproval = await call('GET', '/api/professionals')
  check('Ο εγκεκριμένος επαγγελματίας εμφανίζεται στην αναζήτηση', (afterApproval.data || []).some(p => p.id === proId))
  const publicRecord = (afterApproval.data || []).find(p => p.id === proId)
  check('Τα δεδομένα χρέωσης δεν εκτίθενται δημόσια', publicRecord && publicRecord.stripeSubscriptionId === undefined && publicRecord.billingMode === undefined)

  // --- Κράτηση ---
  const badDate = await call('POST', '/api/bookings', { token: patToken, body: { professionalId: proId, service: 'Χορήγηση αγωγής', date: 'αύριο', time: '10:00', address: 'Οδός 1' } })
  check('Μη έγκυρη ημερομηνία απορρίπτεται', badDate.status === 400)

  const fakeService = await call('POST', '/api/bookings', { token: patToken, body: { professionalId: proId, service: 'Ανύπαρκτη υπηρεσία', date: '2026-12-01', time: '10:00', address: 'Οδός 1' } })
  check('Υπηρεσία που δεν προσφέρεται απορρίπτεται', fakeService.status === 400)

  const booking = await call('POST', '/api/bookings', { token: patToken, body: { professionalId: proId, service: 'Χορήγηση αγωγής', date: '2026-12-01', time: '10:00', address: 'Οδός 1, Ηράκλειο', notes: 'τεστ' } })
  check('Δημιουργία κράτησης', booking.status === 200 && booking.data?.status === 'pending', JSON.stringify(booking.data))
  const bId = booking.data?.id

  const proBooks = await call('POST', '/api/bookings', { token: proToken, body: { professionalId: proId, service: 'Χορήγηση αγωγής', date: '2026-12-01', time: '10:00', address: 'x' } })
  check('Ο επαγγελματίας δεν μπορεί να κάνει κράτηση', proBooks.status === 403)

  // --- Μη επιτρεπτή μετάβαση κατάστασης ---
  const illegal = await call('PATCH', `/api/bookings/${bId}/status`, { token: proToken, body: { status: 'completed' } })
  check('pending → completed απορρίπτεται (παράκαμψη ροής)', illegal.status === 400, JSON.stringify(illegal.data))

  const nonsense = await call('PATCH', `/api/bookings/${bId}/status`, { token: proToken, body: { status: 'ΟΤΙΔΗΠΟΤΕ' } })
  check('Αυθαίρετη κατάσταση απορρίπτεται', nonsense.status === 400)

  // --- Προσφορά κόστους ---
  const quote = await call('POST', `/api/bookings/${bId}/quote`, { token: proToken, body: { amount: 42.5, message: 'περιλαμβάνει υλικά' } })
  check('Αποστολή πρότασης κόστους', quote.status === 200 && quote.data?.status === 'quoted')

  const foreignQuote = await call('POST', `/api/bookings/${bId}/quote-decision`, { token: proToken, body: { decision: 'accept' } })
  check('Ο επαγγελματίας δεν αποδέχεται μόνος του την προσφορά', foreignQuote.status === 403)

  const accept = await call('POST', `/api/bookings/${bId}/quote-decision`, { token: patToken, body: { decision: 'accept' } })
  check('Αποδοχή προσφοράς από τον χρήστη', accept.status === 200 && accept.data?.status === 'accepted' && accept.data?.agreedPrice === 42.5)

  const complete = await call('PATCH', `/api/bookings/${bId}/status`, { token: proToken, body: { status: 'completed' } })
  check('accepted → completed επιτρέπεται', complete.status === 200 && complete.data?.status === 'completed')

  const review = await call('POST', `/api/bookings/${bId}/review`, { token: patToken, body: { rating: 5, comment: 'Άριστος' } })
  check('Αξιολόγηση μετά την ολοκλήρωση', review.status === 200)
  const dupe = await call('POST', `/api/bookings/${bId}/review`, { token: patToken, body: { rating: 1 } })
  check('Διπλή αξιολόγηση απορρίπτεται', dupe.status === 409)

  // --- Έσοδα: μόνο συνδρομές ---
  const stats = await call('GET', '/api/admin/stats', { token: adminToken })
  const rev = stats.data?.revenue || {}
  check('Τα έσοδα πλατφόρμας = MRR συνδρομών', rev.platformMonthlyRevenue === rev.subscriptionMrr, JSON.stringify(rev))
  check('Δεν υπάρχει πεδίο προμήθειας ανά κράτηση (bookingFees)', rev.bookingFees === undefined)
  check('Το GMV αναφέρεται χωριστά ως όγκος αγοράς', typeof rev.marketplaceGmv === 'number')
  const adminBookings = await call('GET', '/api/admin/bookings', { token: adminToken })
  check('Οι κρατήσεις δεν έχουν platformFee', !(adminBookings.data || []).some(b => 'platformFee' in b))

  // --- GDPR ---
  const exp = await call('GET', '/api/me/export', { token: patToken })
  check('Εξαγωγή προσωπικών δεδομένων (GDPR)', exp.status === 200 && !!exp.data?.account)

  const delNoPass = await call('DELETE', '/api/me', { token: patToken, body: {} })
  check('Διαγραφή λογαριασμού απαιτεί κωδικό', delNoPass.status === 401)

  // --- Συνεδρίες ---
  const logout = await call('POST', '/api/auth/logout', { token: patToken })
  check('Αποσύνδεση', logout.status === 200)
  const afterLogout = await call('GET', '/api/me', { token: patToken })
  check('Το token ακυρώνεται μετά την αποσύνδεση', afterLogout.status === 401)

  // --- Ακύρωση συνδρομής ---
  const cancel = await call('POST', '/api/professional/subscription/cancel', { token: proToken })
  check('Ακύρωση συνδρομής', cancel.status === 200)

  // --- 404 ---
  const nf = await call('GET', '/api/δεν-υπάρχει')
  check('Ανύπαρκτο endpoint → JSON 404', nf.status === 404 && !!nf.data?.error)

  console.log(`\nMELEO smoke test → ${BASE}\n`)
  console.log(results.join('\n'))
  console.log(`\n${pass} επιτυχή · ${fail} αποτυχίες\n`)
  process.exit(fail ? 1 : 0)
}

run().catch(err => { console.error('Σφάλμα εκτέλεσης:', err); process.exit(1) })
