// MELEO — αποστολή transactional emails.
// Χρησιμοποιεί το Resend HTTP API (χωρίς επιπλέον dependency).
// Αν δεν έχει ρυθμιστεί API key, τα emails καταγράφονται στο log αντί να σταλούν.
import { config } from './config.js'
import { escapeHtml } from './security.js'
import { enqueue } from './jobs.js'
import { log } from './logger.js'

const layout = (title, bodyHtml) => `<!doctype html>
<html lang="el"><body style="margin:0;background:#f7f5ef;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f2535">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" style="max-width:560px;background:#fffdf9;border:1px solid #d9e2e5;border-radius:20px;padding:32px">
      <tr><td style="font-family:Georgia,serif;font-size:22px;padding-bottom:8px">MELEO</td></tr>
      <tr><td style="font-family:Georgia,serif;font-size:26px;padding-bottom:16px">${title}</td></tr>
      <tr><td style="font-size:15px;line-height:1.7;color:#445a66">${bodyHtml}</td></tr>
      <tr><td style="padding-top:24px;font-size:12px;color:#7a878e;border-top:1px solid #e4e9eb">
        Η MELEO είναι πλατφόρμα εύρεσης επαγγελματιών φροντίδας και δεν παρέχει υπηρεσίες επείγουσας ιατρικής βοήθειας.
        Σε επείγουσα ανάγκη κάλεσε ${config.emergencyNumber}.<br><br>
        Ερωτήσεις: ${config.mail.supportEmail}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

export async function deliverEmail({ to, subject, html }) {
  if (!config.mailEnabled) {
    log.info('mail.disabled',{to,subject})
    return { delivered: false, reason: 'mail_not_configured' }
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.mail.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mail.from, to: [String(to)], subject: String(subject).replace(/[\r\n]/g,''), html })
    })
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text().catch(() => '')}`)
    return { delivered: true }
  } catch (err) {
    log.error('mail.delivery_failed',{to,subject,error:err.message})
    return { delivered: false, reason: err.message }
  }
}

async function deliver(message){
  if (!config.databaseUrl) return deliverEmail(message)
  try {
    const jobId=await enqueue('email',message,{maxAttempts:5})
    log.info('mail.queued',{jobId,to:message.to,subject:message.subject})
    return {delivered:false,queued:true,jobId}
  } catch(err) {
    log.error('mail.queue_failed',{error:err.message,to:message.to})
    // Queue failure must not silently lose transactional mail.
    return deliverEmail(message)
  }
}

export const mail = {
  verifyEmail: (to, name, link) => deliver({
    to,
    subject: 'Επιβεβαίωση email — MELEO',
    html: layout(`Καλώς ήρθες, ${escapeHtml(name)}`, `<p>Επιβεβαίωσε το email σου για να ενεργοποιηθεί πλήρως ο λογαριασμός σου.</p>
      <p><a href="${escapeHtml(link)}" style="background:#0f2535;color:#fff;padding:13px 20px;border-radius:12px;text-decoration:none;display:inline-block">Επιβεβαίωση email</a></p>
      <p style="font-size:13px;color:#7a878e">Ο σύνδεσμος ισχύει για 48 ώρες. Αν δεν έκανες εσύ την εγγραφή, αγνόησε το μήνυμα.</p>`)
  }),
  resetPassword: (to, name, link) => deliver({
    to,
    subject: 'Επαναφορά κωδικού — MELEO',
    html: layout('Επαναφορά κωδικού', `<p>Γεια σου ${escapeHtml(name)}, ζητήθηκε επαναφορά κωδικού για τον λογαριασμό σου.</p>
      <p><a href="${escapeHtml(link)}" style="background:#0f2535;color:#fff;padding:13px 20px;border-radius:12px;text-decoration:none;display:inline-block">Ορισμός νέου κωδικού</a></p>
      <p style="font-size:13px;color:#7a878e">Ο σύνδεσμος ισχύει για 1 ώρα και χρησιμοποιείται μία φορά. Αν δεν το ζήτησες εσύ, δεν χρειάζεται καμία ενέργεια.</p>`)
  }),
  subscriptionActive: (to, name, plan, price) => deliver({
    to,
    subject: `Η συνδρομή ${plan} ενεργοποιήθηκε — MELEO`,
    html: layout('Η συνδρομή σου είναι ενεργή', `<p>Γεια σου ${escapeHtml(name)}, η συνδρομή <b>${escapeHtml(plan)}</b> (${escapeHtml(price)}€/μήνα) ενεργοποιήθηκε.</p>
      <p>Επόμενο βήμα: ολοκλήρωσε το επαγγελματικό προφίλ και υπέβαλε τα στοιχεία επαλήθευσης. Το προφίλ σου γίνεται δημόσια ορατό μόνο μετά την έγκριση.</p>
      <p style="font-size:13px;color:#7a878e">Η απόδειξη/τιμολόγιο αποστέλλεται από τον πάροχο πληρωμών. Μπορείς να ακυρώσεις οποτεδήποτε από τη διαχείριση συνδρομής.</p>`)
  }),
  subscriptionDowngradeScheduled: (to, name, currentPlan, nextPlan, effectiveDate) => deliver({
    to,
    subject: `Η αλλαγή σε ${nextPlan} προγραμματίστηκε — MELEO`,
    html: layout('Η αλλαγή πακέτου προγραμματίστηκε', `<p>Γεια σου ${escapeHtml(name)}, η αλλαγή από <b>${escapeHtml(currentPlan)}</b> σε <b>${escapeHtml(nextPlan)}</b> έχει προγραμματιστεί.</p>
      <p>Μέχρι και <b>${escapeHtml(effectiveDate)}</b> διατηρείς όλα τα προνόμια του ${escapeHtml(currentPlan)} που έχεις ήδη πληρώσει.</p>
      <p>Από την επόμενη ανανέωση θα ισχύει το ${escapeHtml(nextPlan)}. Μπορείς να ακυρώσεις την προγραμματισμένη αλλαγή από τη διαχείριση συνδρομής πριν τεθεί σε ισχύ.</p>`)
  }),
  subscriptionDowngradeCancelled: (to, name, currentPlan) => deliver({
    to,
    subject: 'Η προγραμματισμένη αλλαγή πακέτου ακυρώθηκε — MELEO',
    html: layout('Η αλλαγή πακέτου ακυρώθηκε', `<p>Γεια σου ${escapeHtml(name)}, η προγραμματισμένη αλλαγή πακέτου ακυρώθηκε.</p>
      <p>Η συνδρομή σου παραμένει <b>${escapeHtml(currentPlan)}</b> και θα συνεχίσει να ανανεώνεται κανονικά.</p>`)
  }),
  paymentFailed: (to, name) => deliver({
    to,
    subject: 'Αποτυχία πληρωμής συνδρομής — MELEO',
    html: layout('Η πληρωμή δεν ολοκληρώθηκε', `<p>Γεια σου ${escapeHtml(name)}, η τελευταία χρέωση της συνδρομής σου απέτυχε.</p>
      <p>Ενημέρωσε τον τρόπο πληρωμής από τη «Διαχείριση συνδρομής» στο dashboard, ώστε το προφίλ σου να παραμείνει ενεργό.</p>`)
  }),
  verificationDecision: (to, name, approved, reason = '') => deliver({
    to,
    subject: approved ? 'Ο επαγγελματικός σας λογαριασμός MELEO ενεργοποιήθηκε' : 'Χρειάζεται ενέργεια για τον επαγγελματικό σας λογαριασμό MELEO',
    html: approved
      ? layout('Ο επαγγελματικός σας λογαριασμός ενεργοποιήθηκε', `<p>Καλησπέρα ${escapeHtml(name)},</p><p>ο επαγγελματικός σας λογαριασμός στο MELEO έχει επιβεβαιωθεί και ενεργοποιηθεί.</p><p>Συνδεθείτε στην πλατφόρμα και από το μενού προφίλ επιλέξτε <b>Professional Dashboard</b> για να διαχειριστείτε το επαγγελματικό σας προφίλ, τα αιτήματα, τη διαθεσιμότητα, τη συνδρομή και τα στατιστικά σας.</p>`)
      : layout('Χρειάζεται ενέργεια', `<p>Καλησπέρα ${escapeHtml(name)},</p><p>ο έλεγχος του επαγγελματικού σας λογαριασμού δεν ολοκληρώθηκε.</p><p><b>Λόγος απόρριψης:</b> ${escapeHtml(reason||'Δεν δόθηκε αιτιολογία.')}</p><p>Συνδεθείτε στο MELEO, διορθώστε ή συμπληρώστε τα απαιτούμενα στοιχεία και υποβάλετε ξανά το αίτημα για έλεγχο.</p>`)
  }),
  newBooking: (to, name, service, date, time) => deliver({
    to,
    subject: 'Νέο αίτημα επίσκεψης — MELEO',
    html: layout('Νέο αίτημα', `<p>Γεια σου ${escapeHtml(name)}, έχεις νέο αίτημα: <b>${escapeHtml(service)}</b> · ${escapeHtml(date)} ${escapeHtml(time)}.</p>
      <p>Μπες στο dashboard για να απαντήσεις, να ζητήσεις διευκρινίσεις ή να προτείνεις τελικό κόστος.</p>`)
  }),
  bookingCancelled: (to, name, service, date, time) => deliver({
    to,
    subject: 'Ακύρωση κράτησης — MELEO',
    html: layout('Η κράτηση ακυρώθηκε', `<p>Γεια σου ${escapeHtml(name)}, η κράτηση για <b>${escapeHtml(service)}</b> στις ${escapeHtml(date)} ${escapeHtml(time)} ακυρώθηκε.</p>
      <p>Μπορείς να δεις την ενημερωμένη κατάσταση από το dashboard σου.</p>`)
  }),
  bookingCompleted: (to, name, service) => deliver({
    to,
    subject: 'Η επίσκεψη ολοκληρώθηκε — αξιολόγησε την εμπειρία σου',
    html: layout('Η επίσκεψη ολοκληρώθηκε', `<p>Γεια σου ${escapeHtml(name)}, η επίσκεψη για <b>${escapeHtml(service)}</b> σημειώθηκε ως ολοκληρωμένη.</p>
      <p>Η αξιολόγησή σου βοηθά άλλους χρήστες να επιλέξουν με μεγαλύτερη εμπιστοσύνη και βοηθά τη MELEO να διατηρεί ποιοτικά επαγγελματικά προφίλ.</p>
      <p>Μπες στο dashboard σου για να αφήσεις την αξιολόγησή σου.</p>`)
  }),
  accountDeleted: (to, name) => deliver({
    to,
    subject: 'Ο λογαριασμός σας στη MELEO διαγράφηκε',
    html: layout('Η διαγραφή ολοκληρώθηκε', `<p>Γεια σου ${escapeHtml(name)}, η διαγραφή του λογαριασμού σου στη MELEO ολοκληρώθηκε.</p>
      <p>Τα στοιχεία που προβλέπεται να αφαιρεθούν ή να ανωνυμοποιηθούν έχουν υποβληθεί στη διαδικασία διαγραφής σύμφωνα με τη λειτουργία του λογαριασμού.</p>
      <p style="font-size:13px;color:#7a878e">Αν δεν πραγματοποίησες εσύ αυτή την ενέργεια, επικοινώνησε άμεσα με την υποστήριξη.</p>`)
  })
}
