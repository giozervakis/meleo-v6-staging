import i18n from '../i18n'

const en:Record<string,string>={
  'Ιατροί':'Doctors',
  'Ιατρική επίσκεψη κατ’ οίκον':'Home medical visit',
  'Παθολογική εκτίμηση':'Medical assessment',
  'Γενική ιατρική εξέταση':'General medical examination',
  'Παρακολούθηση χρόνιας πάθησης':'Chronic condition follow-up',
  'Μετεγχειρητική ιατρική παρακολούθηση':'Post-operative medical follow-up',
  'Έκδοση ιατρικής γνωμάτευσης':'Medical opinion / certificate',

  'Νοσηλευτική':'Nursing',
  'Απλή νοσηλευτική επίσκεψη':'Nursing visit',
  'Χορήγηση αγωγής':'Medication administration',
  'Περιποίηση τραύματος':'Wound care',
  'Φροντίδα καθετήρα':'Catheter care',
  'Μετεγχειρητική φροντίδα':'Post-operative care',
  'Μέτρηση ζωτικών σημείων':'Vital signs measurement',

  'Φυσικοθεραπεία':'Physiotherapy',
  'Κατ’ οίκον φυσικοθεραπεία':'Home physiotherapy',
  'Μετεγχειρητική αποκατάσταση':'Post-operative rehabilitation',
  'Κινησιοθεραπεία':'Kinesiotherapy',
  'Νευρολογική αποκατάσταση':'Neurological rehabilitation',
  'Αναπνευστική φυσικοθεραπεία':'Respiratory physiotherapy',

  'Διαιτολογία / Διατροφή':'Dietetics / Nutrition',
  'Διατροφική αξιολόγηση':'Nutrition assessment',
  'Κλινική διατροφή':'Clinical nutrition',
  'Διαχείριση βάρους':'Weight management',
  'Διατροφική υποστήριξη ηλικιωμένων':'Nutrition support for older adults',

  'Εργοθεραπεία':'Occupational therapy',
  'Εργοθεραπευτική αξιολόγηση':'Occupational therapy assessment',
  'Λειτουργική αποκατάσταση':'Functional rehabilitation',
  'Εκπαίδευση καθημερινών δραστηριοτήτων':'Daily living skills training',

  'Λογοθεραπεία':'Speech therapy',
  'Λογοθεραπευτική αξιολόγηση':'Speech therapy assessment',
  'Λογοθεραπευτική συνεδρία':'Speech therapy session',
  'Υποστήριξη κατάποσης':'Swallowing support',

  'Μαιευτική φροντίδα':'Midwifery care',
  'Μαιευτική υποστήριξη':'Midwifery support',
  'Υποστήριξη λοχείας':'Postpartum support',
  'Συμβουλευτική θηλασμού':'Breastfeeding counselling',

  'Ψυχολογία':'Psychology',
  'Ψυχολογική συνεδρία':'Psychology session',
  'Συμβουλευτική φροντιστή':'Caregiver counselling',
  'Υποστήριξη οικογένειας':'Family support',

  'Φροντίδα ηλικιωμένων':'Elder care',
  'Βασική φροντίδα ηλικιωμένου':'Basic elder care',
  'Υποστήριξη καθημερινότητας':'Daily living support',
  'Συνοδεία και επίβλεψη':'Companionship and supervision',

  'Αποκατάσταση':'Rehabilitation',
  'Αξιολόγηση αποκατάστασης':'Rehabilitation assessment',
  'Κατ’ οίκον πρόγραμμα αποκατάστασης':'Home rehabilitation programme',
  'Λειτουργική επανένταξη':'Functional reintegration',

  'Ιατρός':'Doctor',
  'Γιατρός':'Doctor',
  'Νοσηλευτής':'Nurse',
  'Νοσηλεύτρια':'Nurse',
  'Φυσικοθεραπευτής':'Physiotherapist',
  'Φυσικοθεραπεύτρια':'Physiotherapist',
  'Διαιτολόγος':'Dietitian',
  'Διατροφολόγος':'Nutritionist',
  'Εργοθεραπευτής':'Occupational therapist',
  'Εργοθεραπεύτρια':'Occupational therapist',
  'Λογοθεραπευτής':'Speech therapist',
  'Λογοθεραπεύτρια':'Speech therapist',
  'Μαία':'Midwife',
  'Ψυχολόγος':'Psychologist',
  'Φροντιστής ηλικιωμένων':'Elder caregiver',
  'Φροντίστρια ηλικιωμένων':'Elder caregiver'
}

const availabilityEn:Record<string,string>={
  'Διαθέσιμος σήμερα':'Available today',
  'Διαθέσιμη σήμερα':'Available today',
  'Διαθέσιμοι σήμερα':'Available today',
  'Άμεσα διαθέσιμος':'Available now',
  'Άμεσα διαθέσιμη':'Available now',
  'Διαθέσιμος':'Available',
  'Διαθέσιμη':'Available',
  'Μη διαθέσιμος':'Unavailable',
  'Μη διαθέσιμη':'Unavailable',
  'Όχι':'Unavailable'
}

export function catalogLabel(value:string,language:string){
  const text=String(value||'')
  return language==='en'
    ? en[text]||text
    : text
}

export function availabilityLabel(value:string,language:string){
  const text=String(value||'').trim()
  if(language!=='en')return text
  return availabilityEn[text]||(
    text ? 'Availability updated' : ''
  )
}

export function localizedPriceLabel(
  professional:any,
  language:string
){
  const mode=
    (professional?.pricingMode||'from')==='contact'
      ? 'contact'
      : 'from'

  return i18n.t(
    'catalogPricing.label.'+mode,
    {
      lng:language,
      price:professional?.price
    }
  )
}

export function localizedPriceNote(
  professional:any,
  language:string
){
  const mode=
    (professional?.pricingMode||'from')==='contact'
      ? 'contact'
      : 'from'

  return i18n.t(
    'catalogPricing.note.'+mode,
    {
      lng:language
    }
  )
}
