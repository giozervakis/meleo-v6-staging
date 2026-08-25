import React, { useState } from 'react'

/**
 * Ρυθμίσεις λογαριασμού + νομικά κείμενα.
 *
 * ΠΡΟΣΟΧΗ (νομικό): τα κείμενα Όρων / Απορρήτου / Cookies είναι δομημένα
 * σχέδια εργασίας, ΟΧΙ εγκεκριμένα νομικά κείμενα. Πρέπει να ελεγχθούν από
 * δικηγόρο πριν τη δημόσια λειτουργία — ειδικά τα σημεία για ευθύνη,
 * ρόλο της πλατφόρμας, δεδομένα υγείας και συνδρομές.
 */
function getPasswordChecks(password: string) {
  const value = String(password || '')

  return {
    length: value.length >= 8,
    uppercase: /[A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ]/u.test(value),
    lowercase: /[a-zα-ωάέήίόύώϊϋΐΰ]/u.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏΪΫάέήίόύώϊϋΐΰ0-9\s]/u.test(value)
  }
}

function isStrongPassword(password: string) {
  return Object.values(getPasswordChecks(password)).every(Boolean)
}

function PasswordChecklist({password}:{password:string}) {
  const checks = getPasswordChecks(password)

  const items = [
    ['length','Τουλάχιστον 8 χαρακτήρες'],
    ['uppercase','Ένα κεφαλαίο γράμμα'],
    ['lowercase','Ένα πεζό γράμμα'],
    ['number','Έναν αριθμό'],
    ['special','Έναν ειδικό χαρακτήρα']
  ] as const

  return (
    <div className="password-checklist">
      <strong>Ο νέος κωδικός πρέπει να περιλαμβάνει:</strong>

      {items.map(([key,label])=>(
        <div
          key={key}
          className={checks[key] ? 'password-rule ok' : 'password-rule'}
        >
          <span>{checks[key] ? '✓' : '○'}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

function PasswordStrength({password}:{password:string}) {
  const checks = getPasswordChecks(password)
  const score = Object.values(checks).filter(Boolean).length

  const label =
    score <= 1 ? 'Πολύ αδύναμος' :
    score === 2 ? 'Αδύναμος' :
    score === 3 ? 'Μέτριος' :
    score === 4 ? 'Ισχυρός' :
    'Πολύ ισχυρός'

  return (
    <div className="password-strength">
      <div className="password-strength-head">
        <span>Ισχύς κωδικού</span>
        <strong>{label}</strong>
      </div>

      <div className="password-strength-bar">
        <span style={{width:`${(score/5)*100}%`}}/>
      </div>
    </div>
  )
}
type ApiFn = (path: string, options?: any, token?: string) => Promise<any>

export function AccountSettings({
  user,
  token,
  logout,
  setToast,
  cfg,
  api,
  onEditIdentity
}: any & {
  api: ApiFn
  onEditIdentity?: () => void
}) {
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [delPassword, setDelPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCurrent,setShowCurrent]=useState(false)
  const [showNext,setShowNext]=useState(false)
  const [showConfirm,setShowConfirm]=useState(false)

async function changePassword(e: React.FormEvent) {
  e.preventDefault()
  setPasswordError('')

  if (!pw.current) {
    setPasswordError('Συμπλήρωσε τον τρέχοντα κωδικό.')
    return
  }

  const checks = getPasswordChecks(pw.next)

  if (!Object.values(checks).every(Boolean)) {
    setPasswordError(
      'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες και να περιλαμβάνει κεφαλαίο γράμμα, πεζό γράμμα, αριθμό και ειδικό χαρακτήρα.'
    )
    return
  }

  if (pw.next !== pw.confirm) {
    setPasswordError('Οι νέοι κωδικοί δεν ταιριάζουν.')
    return
  }

  setBusy('pw')

  try {
    await api(
      '/me/change-password',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: pw.current,
          newPassword: pw.next
        })
      },
      token
    )

    setPw({
      current: '',
      next: '',
      confirm: ''
    })

    setToast('Ο κωδικός άλλαξε επιτυχώς. Συνδέσου ξανά με τον νέο κωδικό.')
    logout()
  } catch (err: any) {
    setPasswordError(err.message)
  } finally {
    setBusy('')
  }
}

async function exportData() {
    setBusy('export')
    try {
      const data = await api('/me/export', {}, token)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'meleo-data-export.json'; a.click()
      URL.revokeObjectURL(url)
      setToast('Τα δεδομένα σου κατέβηκαν.')
    } catch (err: any) { setToast(err.message) } finally { setBusy('') }
  }

 async function deleteAccount() {
  setDeleteError('')
  setBusy('delete')

  try {
    await api(
      '/me',
      {
        method: 'DELETE',
        body: JSON.stringify({
          password: delPassword
        })
      },
      token
    )

    setToast('Ο λογαριασμός σου διαγράφηκε.')
    logout()
  } catch (err: any) {
    setDeleteError(err.message)
  } finally {
    setBusy('')
  }
}

  return <section className="page"><div className="container narrow">
    <div className="eyebrow">ΡΥΘΜΙΣΕΙΣ</div>
    <h1>Ο λογαριασμός μου</h1>

    <div className="content-card">
      <h3>Στοιχεία</h3>
      <div className="account-rows">
        <div><span>Ονοματεπώνυμο</span><b>{user.name}</b></div>
        <div><span>Email</span><b>{user.email} {user.emailVerified ? <em className="ok-tag">επιβεβαιωμένο</em> : <em className="warn-tag">μη επιβεβαιωμένο</em>}</b></div>
        <div><span>Τηλέφωνο</span><b>{user.phone || '—'}</b></div>
        <div><span>Τύπος λογαριασμού</span><b>{user.role === 'professional' ? 'Επαγγελματίας' : 'Συνοδός / Ασθενής'}</b></div>
      </div>
    </div>

    <div className="content-card">
      <div className="profile-identity-setting">

        <div className="profile-identity-setting-copy">
          <b>Εικόνα προφίλ</b>

          <span>
            Πρόσθεσε προσωπική φωτογραφία ή επίλεξε ένα MELEO avatar.
            Η επιλογή είναι προαιρετική.
          </span>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={()=>onEditIdentity?.()}
        >
          Αλλαγή εικόνας
        </button>

      </div>
    </div>
	
<div className="content-card">
  <h3>Αλλαγή κωδικού</h3>

  <form onSubmit={changePassword}>

    <label>
      Τρέχων κωδικός
      <input
        type={showCurrent ? 'text' : 'password'}
        required
        value={pw.current}
        onChange={e=>setPw({...pw,current:e.target.value})}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={()=>setShowCurrent(v=>!v)}
      >
        {showCurrent ? 'Απόκρυψη' : 'Εμφάνιση'}
      </button>
    </label>

    <label>
      Νέος κωδικός
      <input
        type={showNext ? 'text' : 'password'}
        minLength={8}
        required
        value={pw.next}
        onChange={e=>setPw({...pw,next:e.target.value})}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={()=>setShowNext(v=>!v)}
      >
        {showNext ? 'Απόκρυψη' : 'Εμφάνιση'}
      </button>
    </label>

    <PasswordStrength password={pw.next}/>
    <PasswordChecklist password={pw.next}/>

    <label>
      Επιβεβαίωση
      <input
        type={showConfirm ? 'text' : 'password'}
        minLength={8}
        required
        value={pw.confirm}
        onChange={e=>setPw({...pw,confirm:e.target.value})}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={()=>setShowConfirm(v=>!v)}
      >
        {showConfirm ? 'Απόκρυψη' : 'Εμφάνιση'}
      </button>
    </label>

    {pw.confirm && pw.next !== pw.confirm && (
      <small className="field-hint">
        Οι νέοι κωδικοί δεν ταιριάζουν.
      </small>
    )}

    {passwordError && (
  <div className="error">
    {passwordError}
  </div>
)}

    <button
      className="btn btn-dark"
      disabled={
        busy === 'pw' ||
        !isStrongPassword(pw.next) ||
        pw.next !== pw.confirm
      }
    >
      {busy === 'pw' ? 'Αποθήκευση…' : 'Αλλαγή κωδικού'}
    </button>

  </form>
</div>

    <div className="content-card">
      <h3>Τα δεδομένα μου</h3>
      <p>Σύμφωνα με τον GDPR έχεις δικαίωμα πρόσβασης, φορητότητας και διαγραφής των δεδομένων σου.</p>
      <button className="btn btn-outline" disabled={busy === 'export'} onClick={exportData}>{busy === 'export' ? 'Προετοιμασία…' : 'Λήψη των δεδομένων μου (JSON)'}</button>
      <p className="muted small-note">Για οποιοδήποτε αίτημα σχετικά με τα προσωπικά δεδομένα: {cfg?.legal?.dpoEmail}</p>
    </div>

    <div className="content-card danger-zone">
      <h3>Διαγραφή λογαριασμού</h3>
      <p>Η διαγραφή είναι οριστική. Τυχόν ενεργή συνδρομή ακυρώνεται αμέσως. Το ιστορικό κρατήσεων διατηρείται σε ανωνυμοποιημένη μορφή, επειδή αφορά και τον αντισυμβαλλόμενο και υπάρχουν λογιστικές υποχρεώσεις.</p>
      {!confirmDelete
        ? <button className="text-btn danger" onClick={() => setConfirmDelete(true)}>Θέλω να διαγράψω τον λογαριασμό μου</button>
        : <>
          <label>Επιβεβαίωσε τον κωδικό σου<input type="password" value={delPassword} onChange={e => setDelPassword(e.target.value)} /></label>
          {deleteError && (
  <div className="error">
    {deleteError}
  </div>
)}
          <div className="danger-actions">
            <button className="btn btn-dark" onClick={() => { setConfirmDelete(false); setDelPassword(''); setDeleteError('') }}>Άκυρο</button>
            <button className="text-btn danger" disabled={busy === 'delete' || !delPassword} onClick={deleteAccount}>{busy === 'delete' ? 'Διαγραφή…' : 'Οριστική διαγραφή'}</button>
          </div>
        </>}
    </div>
  </div></section>
}

const DRAFT_WARNING = 'Σχέδιο κειμένου: πρέπει να ελεγχθεί και να εγκριθεί από δικηγόρο πριν τη δημόσια λειτουργία της πλατφόρμας.'

export function Legal({ doc, cfg, setView }: any) {
  const provider = cfg?.legal?.company || '[ΕΠΩΝΥΜΙΑ ΦΟΡΕΑ ΕΚΜΕΤΑΛΛΕΥΣΗΣ]'
  const vat = cfg?.legal?.vatNumber || '[ΑΦΜ]'
  const address = cfg?.legal?.address || '[ΕΔΡΑ]'
  const support = cfg?.legal?.supportEmail
  const dpo = cfg?.legal?.dpoEmail
  const missing = !cfg?.legal?.company || !cfg?.legal?.vatNumber

  return <section className="page legal-page"><div className="container narrow">
    <button className="back" onClick={() => setView('home')}>← Πίσω</button>
    {missing && <div className="notice"><b>Εκκρεμεί:</b> {DRAFT_WARNING} Συμπλήρωσε επίσης τα στοιχεία του παρόχου (LEGAL_COMPANY_NAME, LEGAL_VAT_NUMBER, LEGAL_ADDRESS) — είναι υποχρεωτικά κατά τη νομοθεσία ηλεκτρονικού εμπορίου.</div>}

    {doc === 'terms' && <>
      <div className="eyebrow">ΝΟΜΙΚΑ</div><h1>Όροι Χρήσης</h1>
      <p className="muted">Έκδοση {cfg?.termsVersion}</p>
      <div className="content-card legal-body">
        <h3>1. Ποιοι είμαστε και τι κάνουμε</h3>
        <p>Η πλατφόρμα MELEO λειτουργεί από τον/την {provider}, ΑΦΜ {vat}, έδρα {address}. Η MELEO είναι <b>πλατφόρμα διαμεσολάβησης</b>: συνδέει χρήστες που αναζητούν υπηρεσίες φροντίδας με ανεξάρτητους επαγγελματίες. Η MELEO <b>δεν παρέχει</b> ιατρικές, νοσηλευτικές ή θεραπευτικές υπηρεσίες, δεν απασχολεί τους επαγγελματίες και δεν αποτελεί υπηρεσία επείγουσας βοήθειας.</p>
        <h3>2. Σχέση χρήστη και επαγγελματία</h3>
        <p>Η σύμβαση παροχής υπηρεσίας συνάπτεται απευθείας μεταξύ του χρήστη και του επαγγελματία. Το κόστος της επίσκεψης συμφωνείται μεταξύ τους και εξοφλείται απευθείας. Η MELEO δεν εισπράττει, δεν διαχειρίζεται και δεν λαμβάνει προμήθεια από τα ποσά αυτά.</p>
        <h3>3. Ευθύνη</h3>
        <p>Ο επαγγελματίας ευθύνεται αποκλειστικά για τη νομιμότητα της άσκησης του επαγγέλματός του, την ποιότητα και ασφάλεια των υπηρεσιών του, την τήρηση του επαγγελματικού απορρήτου και τη διατήρηση ασφαλιστικής κάλυψης επαγγελματικής ευθύνης. Η MELEO ευθύνεται μόνο για τη λειτουργία της πλατφόρμας.</p>
        <h3>4. Επαλήθευση (MELEO Verified)</h3>
        <p>Η MELEO ελέγχει στοιχεία ταυτότητας και επαγγελματικής ιδιότητας πριν δημοσιεύσει ένα προφίλ. Ο έλεγχος βασίζεται στα στοιχεία που δηλώνει ο επαγγελματίας και δεν αποτελεί εγγύηση ποιότητας ή αποτελέσματος. Η σήμανση «Προτεινόμενος» είναι <b>εμπορική προβολή</b> του πακέτου PREMIUM και δεν σχετίζεται με ποιότητα ή επαλήθευση.</p>
        <h3>5. Συνδρομές επαγγελματιών</h3>
        <p>Οι επαγγελματικοί λογαριασμοί λειτουργούν με μηνιαία συνδρομή (BASIC ή PREMIUM) με αυτόματη ανανέωση. Η πληρωμή γίνεται με κάρτα ή Google Pay μέσω αδειοδοτημένου παρόχου πληρωμών. Ακύρωση οποτεδήποτε, με ισχύ στο τέλος της τρέχουσας περιόδου χρέωσης· δεν προβλέπεται επιστροφή για τη χρησιμοποιημένη περίοδο. Σε αποτυχία πληρωμής ακολουθεί περίοδος χάριτος και εν συνεχεία απενεργοποίηση της δημόσιας προβολής. Ως προς το δικαίωμα υπαναχώρησης 14 ημερών, η υπηρεσία ενεργοποιείται άμεσα κατόπιν ρητής συναίνεσης του επαγγελματία.</p>
        <h3>6. Υποχρεώσεις χρηστών</h3>
        <p>Οι χρήστες δηλώνουν αληθή στοιχεία, δεν καταχωρούν περισσότερα δεδομένα υγείας από όσα είναι απολύτως αναγκαία για την υπηρεσία και δεν χρησιμοποιούν την πλατφόρμα για παράνομες ενέργειες. Η MELEO μπορεί να αναστείλει λογαριασμούς σε περίπτωση παράβασης.</p>
        <h3>7. Ακυρώσεις επισκέψεων</h3>
        <p>Ακύρωση αιτήματος είναι δυνατή πριν την επιβεβαίωση. Μετά την επιβεβαίωση ισχύει η πολιτική που έχει συμφωνηθεί με τον επαγγελματία. [ΠΡΟΣ ΣΥΜΠΛΗΡΩΣΗ: προθεσμίες και τυχόν χρεώσεις μη εμφάνισης.]</p>
        <h3>8. Επείγοντα</h3>
        <p>Σε επείγουσα ιατρική ανάγκη καλέστε άμεσα το {cfg?.emergencyNumber || '112'}. Η MELEO δεν υποκαθιστά τις υπηρεσίες επείγουσας βοήθειας.</p>
        <h3>9. Εφαρμοστέο δίκαιο</h3>
        <p>Εφαρμόζεται το ελληνικό δίκαιο και το δίκαιο της ΕΕ. Για καταναλωτικές διαφορές διατηρείται η δυνατότητα εξωδικαστικής επίλυσης. Επικοινωνία: {support}.</p>
      </div>
    </>}

    {doc === 'privacy' && <>
      <div className="eyebrow">ΝΟΜΙΚΑ</div><h1>Πολιτική Απορρήτου</h1>
      <div className="content-card legal-body">
        <h3>Υπεύθυνος επεξεργασίας</h3>
        <p>{provider}, ΑΦΜ {vat}, {address}. Επικοινωνία για θέματα προσωπικών δεδομένων: {dpo}.</p>
        <h3>Ποια δεδομένα συλλέγουμε</h3>
        <p>Στοιχεία λογαριασμού (όνομα, email, τηλέφωνο), στοιχεία επαγγελματικού προφίλ και επαλήθευσης, δεδομένα κρατήσεων (υπηρεσία, ημερομηνία, διεύθυνση επίσκεψης, σημειώσεις), επικοινωνία εντός αιτήματος, τεχνικά δεδομένα λειτουργίας και ασφάλειας.</p>
        <h3>Δεδομένα υγείας</h3>
        <p>Οι σημειώσεις ενός αιτήματος μπορεί να περιλαμβάνουν πληροφορίες σχετικές με την υγεία. Πρόκειται για <b>ειδική κατηγορία δεδομένων</b> (άρθρο 9 ΓΚΠΔ) και υποβάλλονται σε επεξεργασία βάσει της ρητής συγκατάθεσής του χρήστη, αποκλειστικά για την εκτέλεση της υπηρεσίας. Ζητάμε να καταχωρείτε <b>μόνο</b> ό,τι είναι απαραίτητο. Πρόσβαση έχουν ο επιλεγμένος επαγγελματίας και, όπου απαιτείται, εξουσιοδοτημένο προσωπικό υποστήριξης.</p>
        <h3>Νομικές βάσεις</h3>
        <p>Εκτέλεση σύμβασης (λογαριασμός, κρατήσεις, συνδρομές), ρητή συγκατάθεση (δεδομένα υγείας), έννομο συμφέρον (ασφάλεια, πρόληψη κατάχρησης), νομική υποχρέωση (φορολογικά/λογιστικά αρχεία).</p>
        <h3>Αποδέκτες & εκτελούντες</h3>
        <p>Πάροχος πληρωμών (χρεώσεις συνδρομών — η MELEO δεν αποθηκεύει στοιχεία κάρτας), πάροχος αποστολής email, πάροχος φιλοξενίας/υποδομής, υπηρεσία γεωκωδικοποίησης για την αναζήτηση περιοχής. Με κάθε εκτελούντα υπογράφεται σύμβαση κατά το άρθρο 28 ΓΚΠΔ. [ΠΡΟΣ ΣΥΜΠΛΗΡΩΣΗ: ονομαστικός κατάλογος και τυχόν διεθνείς μεταφορές.]</p>
        <h3>Χρόνος διατήρησης</h3>
        <p>Δεδομένα λογαριασμού για όσο διαρκεί ο λογαριασμός· παραστατικά και λογιστικά αρχεία για το κατά νόμο διάστημα· σημειώσεις κρατήσεων για περιορισμένο διάστημα μετά την ολοκλήρωση. [ΠΡΟΣ ΣΥΜΠΛΗΡΩΣΗ: συγκεκριμένες προθεσμίες.]</p>
        <h3>Τα δικαιώματά σου</h3>
        <p>Πρόσβαση, διόρθωση, διαγραφή, περιορισμός, εναντίωση, φορητότητα και ανάκληση συγκατάθεσης. Μπορείς να κατεβάσεις τα δεδομένα σου και να διαγράψεις τον λογαριασμό σου από τις Ρυθμίσεις. Δικαίωμα καταγγελίας στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.</p>
        <h3>Ασφάλεια</h3>
        <p>Κρυπτογράφηση κωδικών, HTTPS, έλεγχοι πρόσβασης ανά ρόλο, καταγραφή ενεργειών διαχείρισης, περιορισμός συχνότητας αιτημάτων και τηρούμενα αντίγραφα ασφαλείας.</p>
      </div>
    </>}

    {doc === 'cookies' && <>
      <div className="eyebrow">ΝΟΜΙΚΑ</div><h1>Cookies & τοπική αποθήκευση</h1>
      <div className="content-card legal-body">
        <h3>Τι χρησιμοποιούμε</h3>
        <p>Η MELEO χρησιμοποιεί <b>μόνο απολύτως αναγκαία</b> τοπική αποθήκευση: ένα token συνεδρίας στον browser σου, ώστε να παραμένεις συνδεδεμένος. Δεν χρησιμοποιούμε cookies διαφήμισης ή παρακολούθησης και δεν μοιραζόμαστε δεδομένα με διαφημιστικά δίκτυα.</p>
        <h3>Τοποθεσία</h3>
        <p>Η πρόσβαση στην τοποθεσία σου ζητείται μόνο όταν πατήσεις «Κοντά μου» και χρησιμοποιείται αποκλειστικά για την τρέχουσα αναζήτηση.</p>
        <h3>Αν προσθέσετε analytics</h3>
        <p>Οποιοδήποτε εργαλείο στατιστικών ή marketing απαιτεί <b>προηγούμενη συγκατάθεση</b> με banner συγκατάθεσης πριν την τοποθέτηση των cookies. Μέχρι τότε, δεν εμφανίζεται banner επειδή δεν χρησιμοποιούνται μη αναγκαία cookies.</p>
      </div>
    </>}
  </div></section>
}
