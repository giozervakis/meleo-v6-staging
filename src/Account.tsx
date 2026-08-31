import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Account settings + legal documents.
 *
 * Legal documents below remain draft text and must be reviewed by counsel
 * before public launch.
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
  const {t}=useTranslation()
  const checks = getPasswordChecks(password)

  const items = [
    ['length',t('auth.password.length')],
    ['uppercase',t('auth.password.uppercase')],
    ['lowercase',t('auth.password.lowercase')],
    ['number',t('auth.password.number')],
    ['special',t('auth.password.special')]
  ] as const

  return (
    <div className="password-checklist">
      <strong>{t('accountSettings.password.checklistTitle')}</strong>

      {items.map(([key,label])=>(
        <div
          key={key}
          className={checks[key] ? 'password-rule ok' : 'password-rule'}
        >
          <span>{checks[key] ? '\u2713' : '\u25cb'}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

function PasswordStrength({password}:{password:string}) {
  const {t}=useTranslation()
  const checks = getPasswordChecks(password)
  const score = Object.values(checks).filter(Boolean).length

  const label =
    score <= 1 ? t('auth.password.veryWeak') :
    score === 2 ? t('auth.password.weak') :
    score === 3 ? t('auth.password.medium') :
    score === 4 ? t('auth.password.strong') :
    t('auth.password.veryStrong')

  return (
    <div className="password-strength">
      <div className="password-strength-head">
        <span>{t('auth.password.strength')}</span>
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
  const {t}=useTranslation()
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
    setPasswordError(t('accountSettings.password.currentRequired'))
    return
  }

  const checks = getPasswordChecks(pw.next)

  if (!Object.values(checks).every(Boolean)) {
    setPasswordError(t('auth.password.policy'))
    return
  }

  if (pw.next !== pw.confirm) {
    setPasswordError(t('accountSettings.password.mismatch'))
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

    setToast(t('accountSettings.password.changed'))
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
      setToast(t('accountSettings.data.downloaded'))
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

    setToast(t('accountSettings.delete.deleted'))
    logout()
  } catch (err: any) {
    setDeleteError(err.message)
  } finally {
    setBusy('')
  }
}

  return <section className="page"><div className="container narrow">
    <div className="eyebrow">{t('accountSettings.kicker')}</div>
    <h1>{t('accountSettings.title')}</h1>

    <div className="content-card">
      <h3>{t('accountSettings.details.title')}</h3>
      <div className="account-rows">
        <div><span>{t('accountSettings.details.name')}</span><b>{user.name}</b></div>
        <div><span>Email</span><b>{user.email} {user.emailVerified ? <em className="ok-tag">{t('accountSettings.details.verified')}</em> : <em className="warn-tag">{t('accountSettings.details.unverified')}</em>}</b></div>
        <div><span>{t('accountSettings.details.phone')}</span><b>{user.phone || '\u2014'}</b></div>
        <div><span>{t('accountSettings.details.accountType')}</span><b>{user.role === 'professional' ? t('accountSettings.details.professional') : t('accountSettings.details.patient')}</b></div>
      </div>
    </div>

    <div className="content-card">
      <div className="profile-identity-setting">

        <div className="profile-identity-setting-copy">
          <b>{t('accountSettings.identity.title')}</b>

          <span>
            {t('accountSettings.identity.help')}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={()=>onEditIdentity?.()}
        >
          {t('accountSettings.identity.change')}
        </button>

      </div>
    </div>

<div className="content-card">
  <h3>{t('accountSettings.password.title')}</h3>

  <form onSubmit={changePassword}>

    <label>
      {t('accountSettings.password.current')}
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
        {showCurrent ? t('auth.password.hide') : t('auth.password.show')}
      </button>
    </label>

    <label>
      {t('auth.password.newPassword')}
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
        {showNext ? t('auth.password.hide') : t('auth.password.show')}
      </button>
    </label>

    <PasswordStrength password={pw.next}/>
    <PasswordChecklist password={pw.next}/>

    <label>
      {t('auth.password.confirmPassword')}
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
        {showConfirm ? t('auth.password.hide') : t('auth.password.show')}
      </button>
    </label>

    {pw.confirm && pw.next !== pw.confirm && (
      <small className="field-hint">
        {t('accountSettings.password.mismatch')}
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
      {busy === 'pw' ? t('accountSettings.password.saving') : t('accountSettings.password.change')}
    </button>

  </form>
</div>

    <div className="content-card">
      <h3>{t('accountSettings.data.title')}</h3>
      <p>{t('accountSettings.data.gdpr')}</p>
      <button className="btn btn-outline" disabled={busy === 'export'} onClick={exportData}>{busy === 'export' ? t('accountSettings.data.preparing') : t('accountSettings.data.download')}</button>
      <p className="muted small-note">{t('accountSettings.data.contact')} {cfg?.legal?.dpoEmail}</p>
    </div>

    <div className="content-card danger-zone">
      <h3>{t('accountSettings.delete.title')}</h3>
      <p>{t('accountSettings.delete.warning')}</p>
      {!confirmDelete
        ? <button className="text-btn danger" onClick={() => setConfirmDelete(true)}>{t('accountSettings.delete.start')}</button>
        : <>
          <label>{t('accountSettings.delete.confirmPassword')}<input type="password" value={delPassword} onChange={e => setDelPassword(e.target.value)} /></label>
          {deleteError && (
  <div className="error">
    {deleteError}
  </div>
)}
          <div className="danger-actions">
            <button className="btn btn-dark" onClick={() => { setConfirmDelete(false); setDelPassword(''); setDeleteError('') }}>{t('accountSettings.delete.cancel')}</button>
            <button className="text-btn danger" disabled={busy === 'delete' || !delPassword} onClick={deleteAccount}>{busy === 'delete' ? t('accountSettings.delete.deleting') : t('accountSettings.delete.final')}</button>
          </div>
        </>}
    </div>
  </div></section>
}

export function Legal({ doc, cfg, setView }: any) {
  const {t}=useTranslation()
  const provider = cfg?.legal?.company || t('legalUi.placeholders.provider')
  const vat = cfg?.legal?.vatNumber || t('legalUi.placeholders.vat')
  const address = cfg?.legal?.address || t('legalUi.placeholders.address')
  const support = cfg?.legal?.supportEmail
  const dpo = cfg?.legal?.dpoEmail
  const missing = !cfg?.legal?.company || !cfg?.legal?.vatNumber

  return <section className="page legal-page"><div className="container narrow">
    <button className="back" onClick={() => setView('home')}>← {t('legalUi.back')}</button>
    {missing && <div className="notice"><b>{t('legalUi.pending')}</b> {t('legalUi.draftWarning')} {t('legalUi.providerRequired')}</div>}

    {doc === 'terms' && <>
      <div className="eyebrow">{t('legalUi.kicker')}</div><h1>{t('legalUi.termsTitle')}</h1>
      <p className="muted">{t('legalUi.version')} {cfg?.termsVersion}</p>
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
      <div className="eyebrow">{t('legalUi.kicker')}</div><h1>{t('legalUi.privacyTitle')}</h1>
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
      <div className="eyebrow">{t('legalUi.kicker')}</div><h1>{t('legalUi.cookiesTitle')}</h1>
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
