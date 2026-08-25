import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { api } from '../../lib/api'

import {
  serviceMap,
  specialtyOptions
} from '../../domain/catalog'

import type {
  Professional
} from '../../domain/types'


export function Home({pros,search,setSearch,loadPros,openPro,favorites,toggleFav,user,setView,SectionTitle,Step,MiniCard,ProCard}:any){
  return <>
    <section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="eyebrow"><span className="eyedot"/> ΦΡΟΝΤΙΔΑ ΜΕ ΕΜΠΙΣΤΟΣΥΝΗ</div><h1>Η σωστή φροντίδα,<br/><em>κοντά σου.</em></h1><p>Βρες επαληθευμένους επαγγελματίες υγείας, φροντίδας και ευεξίας, σύγκρινε επιλογές και κλείσε την υπηρεσία που χρειάζεσαι.</p><SearchBox search={search} setSearch={setSearch} onSearch={()=>{loadPros();setView('search')}}/><div className="trust-strip"><span>✓ Επαληθευμένα προφίλ</span><span>✓ Ευέλικτη ενημέρωση κόστους</span><span>✓ Ασφαλής κράτηση</span></div></div><div className="hero-card-wrap"><div className="floating-chip topchip"><span className="pulse-dot"/> Διαθέσιμοι σήμερα</div><div className="phone-card"><div className="phone-head"><span>9:41</span><span className="tiny-brand">MELEO Care</span></div><h3>Βρες φροντίδα κοντά σου</h3><div className="phone-search">⌖ <div><b>Κοντά σου</b><small>GPS ή αναζήτηση οποιασδήποτε περιοχής</small></div></div><div className="chips"><span className="chip active">Νοσηλευτική</span><span className="chip">Φυσικοθεραπεία</span><span className="chip">Διατροφή</span></div><div className="phone-list">{pros.slice(0,3).map((p:Professional)=><MiniCard key={p.id} p={p}/>)}</div></div><div className="floating-chip bottomchip"><b>0€</b><span>για τον συνοδό/ασθενή</span></div></div></div></section>
    <section className="care-modes"><div className="container"><div className="care-mode-grid"><button className="care-mode-card browse" onClick={()=>setView('search')}><span className="mode-kicker">BROWSE</span><i>⌕</i><h3>Ξέρω τι ψάχνω</h3><p>Ειδικότητα → προαιρετική υπηρεσία → τοποθεσία. Σύγκρινε επαγγελματίες και επίλεξε.</p><b>Αναζήτηση επαγγελματία →</b></button><button className="care-mode-card smart" onClick={()=>setView('smart')}><span className="mode-kicker">SMART REQUEST</span><i>✦</i><h3>Πες μας τι χρειάζεσαι</h3><p>Περιέγραψε την ανάγκη με απλά λόγια και η MELEO θα σε κατευθύνει στη σωστή κατηγορία.</p><b>Ξεκίνα Smart Request →</b></button><button className="care-mode-card now" onClick={()=>setView('now')}><span className="mode-kicker">MELEO NOW</span><i>⚡</i><h3>Το χρειάζομαι άμεσα</h3><p>Βρες διαθέσιμους επαγγελματίες που καλύπτουν την περιοχή σου σήμερα.</p><b>Βρες διαθέσιμο τώρα →</b></button></div></div></section>
    <section className="metric-band"><div className="container metrics"><div><strong>3 βήματα</strong><span>μέχρι την κράτηση</span></div><div><strong>Έλεγχος</strong><span>επαγγελματικής ιδιότητας πριν τη δημοσίευση</span></div><div><strong>24/7</strong><span>online αναζήτηση</span></div><div><strong>0€</strong><span>κόστος πλατφόρμας για τον συνοδό/ασθενή</span></div></div></section>
    <section className="section"><div className="container"><SectionTitle over="ΕΠΙΛΟΓΕΣ ΓΙΑ ΕΣΕΝΑ" title="Επαγγελματίες που ξεχωρίζουν" subtitle="Ανακάλυψε επαληθευμένους επαγγελματίες κοντά σου."/><div className="pro-grid">{pros.slice(0,3).map((p:Professional)=><ProCard key={p.id} p={p} open={()=>openPro(p)} favorite={favorites.includes(p.id)} toggle={()=>toggleFav(p.id)}/>)}</div><div className="center"><button className="btn btn-outline" onClick={()=>setView('search')}>Δες όλους τους επαγγελματίες →</button></div></div></section>
    <section className="section soft"><div className="container"><SectionTitle over="ΠΩΣ ΛΕΙΤΟΥΡΓΕΙ" title="Απλό, ανθρώπινο, ξεκάθαρο" subtitle="Από την ανάγκη στη φροντίδα χωρίς περιττή ταλαιπωρία."/><div className="steps"><Step n="01" icon="⌕" title="Αναζήτησε" text="Διάλεξε ειδικότητα, προαιρετικά υπηρεσία και βρες επαγγελματίες κοντά σου ή σε άλλη περιοχή."/><Step n="02" icon="◇" title="Σύγκρινε" text="Δες επαλήθευση, εμπειρία, αξιολογήσεις, διαθεσιμότητα και τιμή."/><Step n="03" icon="✓" title="Κλείσε" text="Στείλε το αίτημα και παρακολούθησε την κράτηση από το dashboard σου."/></div></div></section>
    <section className="section pro-cta"><div className="container cta-grid"><div><div className="eyebrow light">ΓΙΑ ΕΠΑΓΓΕΛΜΑΤΙΕΣ</div><h2>Η εμπειρία σου αξίζει<br/>να σε βρίσκει ο κόσμος.</h2><p>Δημιούργησε επαγγελματικό προφίλ, όρισε υπηρεσίες, τιμές και διαθεσιμότητα και δέξου νέα αιτήματα.</p><button className="btn btn-gold" onClick={()=>setView('become-pro')}>Γίνε Founding Professional</button></div><div className="cta-panel"><div className="cta-stat"><span>BASIC</span><b>9,99€</b><small>/ μήνα · PREMIUM 14,99€</small></div><div className="cta-line"><span>✓</span> Δικό σου επαγγελματικό προφίλ</div><div className="cta-line"><span>✓</span> Ειδοποιήσεις νέων αιτημάτων</div><div className="cta-line"><span>✓</span> Διαχείριση διαθεσιμότητας</div><div className="cta-line"><span>✓</span> Στατιστικά & ιστορικό</div></div></div></section>
  </>
}

export function SearchBox({search,setSearch,onSearch}:any){const services=search.specialty?serviceMap[search.specialty]||[]:[];const [geoBusy,setGeoBusy]=useState(false);const [geoError,setGeoError]=useState('');async function nearMe(){setGeoError('');if(!navigator.geolocation){setGeoError('Η συσκευή δεν υποστηρίζει υπηρεσίες τοποθεσίας.');return}setGeoBusy(true);navigator.geolocation.getCurrentPosition(async pos=>{const lat=String(pos.coords.latitude),lon=String(pos.coords.longitude);let label='Η τρέχουσα τοποθεσία μου';try{const r=await api(`/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);label=r.label||label}catch{}setSearch({...search,lat,lon,locationQuery:'',locationLabel:label});setGeoBusy(false)},()=>{setGeoError('Δεν δόθηκε πρόσβαση στην τοποθεσία. Μπορείς να πληκτρολογήσεις περιοχή χειροκίνητα.');setGeoBusy(false)},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}return <><div className="searchbox searchbox-three location-search"><div className="searchfield"><label>1 · Ειδικότητα</label><select value={search.specialty} onChange={e=>setSearch({...search,specialty:e.target.value,service:''})}><option value="">Επίλεξε ειδικότητα</option>{specialtyOptions.map(x=><option key={x}>{x}</option>)}</select></div><div className="divider"/><div className="searchfield"><label>2 · Υπηρεσία <span className="optional">προαιρετικά</span></label><select value={search.service} disabled={!search.specialty} onChange={e=>setSearch({...search,service:e.target.value})}><option value="">{search.specialty?'Όλες οι υπηρεσίες':'Πρώτα επίλεξε ειδικότητα'}</option>{services.map((x:string)=><option key={x}>{x}</option>)}</select></div><div className="divider"/><div className="searchfield location-field"><label>3 · Τοποθεσία</label><div className="location-entry"><input placeholder="Πόλη, περιοχή ή ΤΚ" value={search.locationQuery} onChange={e=>setSearch({...search,locationQuery:e.target.value,locationLabel:'',lat:'',lon:''})}/><button type="button" className="locate-btn" onClick={nearMe} title="Χρήση τρέχουσας τοποθεσίας">{geoBusy?'…':'⌖'}<span>Κοντά μου</span></button></div>{search.locationLabel&&<small className="location-ok">⌖ {search.locationLabel}</small>}</div><button className="search-btn" onClick={()=>onSearch(search)} disabled={!search.specialty}>⌕<span>Αναζήτηση</span></button></div>{geoError&&<div className="location-error">{geoError}</div>}</>}
export function SmartRequest({
  search,
  setSearch,
  loadPros,
  setView
}: any) {
  const [text, setText] = useState('')
  const [suggestion, setSuggestion] = useState<any>(null)

  /*
   * ------------------------------------------------------------
   * SMART REQUEST v2
   * ------------------------------------------------------------
   * Δεν κάνει διάγνωση.
   * Αναγνωρίζει ανάγκη / intent και προτείνει κατεύθυνση.
   */

  function normalize(value: string) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/ς/g, 'σ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  type SmartRule = {
    specialty: string
    phrases: Array<[string, number]>
  }

  const rules: SmartRule[] = [
    {
      specialty: 'Διαιτολογία / Διατροφή',
      phrases: [
        ['θελω να χασω κιλα', 15],
        ['να χασω κιλα', 15],
        ['χασω κιλα', 14],
        ['να αδυνατισω', 14],
        ['θελω να αδυνατισω', 15],
        ['απωλεια βαρους', 15],
        ['μειωση βαρους', 15],
        ['διαχειριση βαρους', 14],
        ['προγραμμα διατροφης', 15],
        ['διατροφικο προγραμμα', 15],
        ['διατροφικη αξιολογηση', 15],
        ['κλινικη διατροφη', 14],
        ['διαιτολογο', 16],
        ['διαιτολογος', 16],
        ['διατροφολογο', 16],
        ['διατροφολογος', 16],
        ['διατροφη', 10],
        ['διαιτα', 11],
        ['κιλα', 9],
        ['βαρος', 8],
        ['παχυν', 8],
        ['αδυνατ', 10],
        ['θερμιδ', 8],
        ['διατροφ', 10],
        ['φαγητ', 5]
      ]
    },

    {
      specialty: 'Νοσηλευτική',
      phrases: [
        ['αλλαγη καθετηρα', 16],
        ['φροντιδα καθετηρα', 16],
        ['περιποιηση τραυματος', 16],
        ['αλλαγη τραυματος', 14],
        ['χορηγηση αγωγης', 14],
        ['μετρηση ζωτικων', 14],
        ['μετρηση πιεσης', 12],
        ['νοσηλευτη στο σπιτι', 16],
        ['νοσηλευτρια στο σπιτι', 16],
        ['νοσηλευτη', 15],
        ['νοσηλευτρια', 15],
        ['αντιβιωση', 13],
        ['αντιβιοτικ', 12],
        ['καθετηρ', 13],
        ['τραυμα', 10],
        ['ενεση', 11],
        ['ενεσεις', 11],
        ['ορο', 10],
        ['νοσηλ', 12],
        ['πιεση', 5],
        ['ζωτικ', 8]
      ]
    },

    {
      specialty: 'Φυσικοθεραπεία',
      phrases: [
        ['μετα απο επεμβαση ισχιου', 16],
        ['μετα απο εγχειρηση ισχιου', 16],
        ['μετεγχειρητικη αποκατασταση', 16],
        ['δυσκολευομαι να περπατησω', 14],
        ['πονος στη μεση', 12],
        ['ποναει η μεση', 12],
        ['πονος στο γονατο', 12],
        ['ποναει το γονατο', 12],
        ['φυσικοθεραπευτη', 16],
        ['φυσικοθεραπευτρια', 16],
        ['φυσικοθεραπεια', 16],
        ['κινησιοθεραπεια', 15],
        ['ισχιο', 10],
        ['γονατο', 10],
        ['μεση', 7],
        ['κινησιο', 10],
        ['φυσιο', 12],
        ['αποκατασταση', 9],
        ['περπατη', 7]
      ]
    },

    {
      specialty: 'Ψυχολογία',
      phrases: [
        ['εχω πολυ αγχος', 15],
        ['εχω αγχος', 13],
        ['κριση αγχους', 15],
        ['ψυχολογικη υποστηριξη', 16],
        ['θελω να μιλησω με ψυχολογο', 16],
        ['ψυχολογο', 16],
        ['ψυχολογος', 16],
        ['στρες', 10],
        ['αγχος', 12],
        ['φοβια', 10],
        ['πενθος', 11],
        ['καταθλιψ', 11],
        ['ψυχολογ', 14],
        ['συμβουλευτικ', 8]
      ]
    },

    {
      specialty: 'Λογοθεραπεία',
      phrases: [
        ['δυσκολια στην ομιλια', 16],
        ['δυσκολευεται στην ομιλια', 16],
        ['καθυστερηση ομιλιας', 16],
        ['προβλημα στην ομιλια', 15],
        ['δυσκολια στην καταποση', 14],
        ['λογοθεραπευτη', 16],
        ['λογοθεραπευτρια', 16],
        ['λογοθεραπεια', 16],
        ['λογοθερ', 14],
        ['ομιλια', 10],
        ['αρθρωση', 11],
        ['καταποση', 10],
        ['λεξεις', 6]
      ]
    },

    {
      specialty: 'Εργοθεραπεία',
      phrases: [
        ['δυσκολια στις καθημερινες δραστηριοτητες', 16],
        ['καθημερινες δραστηριοτητες', 14],
        ['λειτουργικη αυτονομια', 15],
        ['εργοθεραπευτη', 16],
        ['εργοθεραπευτρια', 16],
        ['εργοθεραπεια', 16],
        ['εργοθερ', 14],
        ['λεπτη κινητικοτητα', 12],
        ['αυτοεξυπηρετηση', 12]
      ]
    },

    {
      specialty: 'Μαιευτική φροντίδα',
      phrases: [
        ['υποστηριξη θηλασμου', 16],
        ['δυσκολια στο θηλασμο', 16],
        ['μετα τον τοκετο', 14],
        ['φροντιδα λοχειας', 15],
        ['μαια στο σπιτι', 16],
        ['μαια', 13],
        ['θηλασ', 13],
        ['λοχεια', 13],
        ['λεχωνα', 11],
        ['τοκετο', 8]
      ]
    },

    {
      specialty: 'Φροντίδα ηλικιωμένων',
      phrases: [
        ['φροντιδα ηλικιωμενου', 16],
        ['φροντιδα ηλικιωμενης', 16],
        ['φροντιδα του πατερα μου', 13],
        ['φροντιδα της μητερας μου', 13],
        ['χρειαζεται συνοδεια', 13],
        ['χρειαζεται επιβλεψη', 13],
        ['βοηθεια στην καθημερινοτητα', 14],
        ['βοηθεια στο σπιτι', 10],
        ['ηλικιωμενο', 12],
        ['ηλικιωμενη', 12],
        ['ηλικιωμενων', 12],
        ['συνοδεια', 10],
        ['επιβλεψη', 9]
      ]
    },

    {
      specialty: 'Αποκατάσταση',
      phrases: [
        ['προγραμμα αποκαταστασης', 15],
        ['λειτουργικη επανενταξη', 15],
        ['αποκατασταση μετα απο νοσηλεια', 15],
        ['αποκατασταση μετα απο εγχειρηση', 15],
        ['αποκατασταση', 9],
        ['επανενταξη', 10]
      ]
    },

    {
      specialty: 'Ιατροί',
      phrases: [
        ['ιατρικη επισκεψη', 16],
        ['ιατρο στο σπιτι', 16],
        ['γιατρο στο σπιτι', 16],
        ['ιατρικη εξεταση', 15],
        ['ιατρικη εκτιμηση', 15],
        ['ιατρικη γνωματευση', 15],
        ['παθολογο', 14],
        ['γιατρο', 13],
        ['ιατρο', 13],
        ['εξεταση', 7],
        ['γνωματευση', 9]
      ]
    }
  ]

  const emergencyTerms = [
    'δεν αναπνεω',
    'δεν αναπνεει',
    'δυσκολια στην αναπνοη',
    'δυσκολευεται να αναπνευσει',
    'λιποθυμια',
    'λιποθυμησε',
    'χωρισ αισθησεισ',
    'δεν εχει αισθησεισ',
    'μεγαλη αιμορραγια',
    'αιμορραγει πολυ',
    'πονοσ στο στηθοσ',
    'εντονοσ πονοσ στο στηθοσ',
    'εγκεφαλικο',
    'σπασμοι',
    'ανακοπη',
    'αυτοκτονια',
    'αυτοκτονικεσ σκεψεισ'
  ].map(normalize)

  function scoreSpecialty(
    normalizedText: string,
    rule: SmartRule
  ) {
    let score = 0
    const matched: string[] = []

    for (const [phrase, weight] of rule.phrases) {
      const normalizedPhrase = normalize(phrase)

      if (
        normalizedPhrase &&
        normalizedText.includes(normalizedPhrase)
      ) {
        score += weight
        matched.push(phrase)
      }
    }

    /*
     * Bonus όταν ο χρήστης έχει δώσει περισσότερα από ένα
     * σχετικά clues για την ίδια ειδικότητα.
     */
    if (matched.length >= 2) {
      score += Math.min(10, (matched.length - 1) * 3)
    }

    return {
      specialty: rule.specialty,
      score,
      matched
    }
  }

  function findBestService(
    specialty: string,
    normalizedText: string
  ) {
    const services = serviceMap[specialty] || []

    let bestService = ''
    let bestScore = 0

    for (const service of services) {
      const serviceNormalized = normalize(service)

      const significantWords = serviceNormalized
        .split(' ')
        .filter(word => word.length >= 5)

      let score = 0

      for (const word of significantWords) {
        if (normalizedText.includes(word)) {
          score += 4
          continue
        }

        /*
         * Stem-like matching.
         * π.χ. "καθετήρα" ↔ "καθετήρ..."
         */
        const stem = word.slice(0, Math.min(7, word.length))

        if (
          stem.length >= 5 &&
          normalizedText.includes(stem)
        ) {
          score += 2
        }
      }

      if (serviceNormalized && normalizedText.includes(serviceNormalized)) {
        score += 12
      }

      if (score > bestScore) {
        bestScore = score
        bestService = service
      }
    }

    return bestScore >= 4
      ? bestService
      : ''
  }

  async function analyze() {
    const normalizedText = normalize(text)

    if (!normalizedText) {
      setSuggestion(null)
      return
    }

    /*
     * ----------------------------------------------------------
     * 1. EMERGENCY SAFETY GATE
     * ----------------------------------------------------------
     */
    const emergency =
      emergencyTerms.some(term =>
        normalizedText.includes(term)
      )

    if (emergency) {
      setSuggestion({
        emergency: true
      })
      return
    }

    /*
     * ----------------------------------------------------------
     * 2. SCORE ALL SPECIALTIES
     * ----------------------------------------------------------
     */
    const scored = rules
      .map(rule =>
        scoreSpecialty(normalizedText, rule)
      )
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)

    if (!scored.length) {
      /*
       * ----------------------------------------------------------
       * 2B. ADMIN-APPROVED LEARNING FALLBACK
       * ----------------------------------------------------------
       * Built-in rules always have priority.
       * Only administrator-approved learning is used.
       */
      try {
        const learnedResponse = await api(
          '/smart-request/learned-match',
          {
            method: 'POST',
            body: JSON.stringify({
              text
            })
          }
        )

        const learned = learnedResponse?.match

        if (
          learned?.specialty &&
          learned.score >= 60
        ) {
          setSuggestion({
            specialty: learned.specialty,
            service: learned.service || '',
            confidence:
              learned.score >= 80
                ? 'Υψηλή'
                : 'Μέτρια',
            score: learned.score,
            alternatives: [],
            matched: [],
            source: 'learned'
          })

          return
        }
      } catch (error) {
        console.warn(
          'Smart Request learned-match failed',
          error
        )
      }

      /*
       * Nothing recognized.
       * Store it for administrator review.
       */
      try {
        await api(
          '/smart-request/unmatched',
          {
            method: 'POST',
            body: JSON.stringify({
              text
            })
          }
        )
      } catch (error) {
        console.warn(
          'Smart Request unmatched logging failed',
          error
        )
      }

      setSuggestion({
        unmatched: true
      })

      return
    }

    const best = scored[0]
    const second = scored[1]

    /*
     * ----------------------------------------------------------
     * 3. CONFIDENCE
     * ----------------------------------------------------------
     */
    let confidence = 'Χαμηλή'

    if (best.score >= 18) {
      confidence = 'Υψηλή'
    } else if (best.score >= 10) {
      confidence = 'Μέτρια'
    }

    /*
     * Αν δύο ειδικότητες είναι πολύ κοντά,
     * δείχνουμε και εναλλακτικές επιλογές.
     */
    const alternatives = scored
      .slice(1, 3)
      .filter(item =>
        item.score >= 7 &&
        best.score - item.score <= 6
      )
      .map(item => ({
        specialty: item.specialty,
        score: item.score
      }))

    const service =
      findBestService(
        best.specialty,
        normalizedText
      )

    setSuggestion({
      specialty: best.specialty,
      service,
      confidence,
      score: best.score,
      alternatives,
      matched: best.matched
    })
  }

  async function continueSearch(
    overrideSpecialty?: string
  ) {
    const specialty =
      overrideSpecialty ||
      suggestion.specialty

    const service =
      overrideSpecialty
        ? ''
        : suggestion.service || ''

    const next = {
      ...search,
      specialty,
      service
    }

    setSearch(next)
    await loadPros(next)
    setView('search')
  }

  return (
    <section className="smart-page page">
      <div className="container smart-layout">

        <div className="smart-copy">
          <span className="mode-kicker">
            MELEO SMART REQUEST
          </span>

          <h1>
            Δεν χρειάζεται να ξέρεις
            <br />
            <em>πώς λέγεται η υπηρεσία.</em>
          </h1>

          <p>
            Περιέγραψε με απλά λόγια τι χρειάζεσαι.
            Η MELEO σε κατευθύνει σε κατάλληλη
            κατηγορία επαγγελματία — χωρίς να κάνει
            διάγνωση.
          </p>

          <div className="smart-examples">
            <button
              onClick={() =>
                setText(
                  'Η μητέρα μου έκανε επέμβαση ισχίου και χρειάζεται βοήθεια στην αποκατάσταση'
                )
              }
            >
              Μετά από επέμβαση ισχίου
            </button>

            <button
              onClick={() =>
                setText(
                  'Χρειάζομαι νοσηλευτή για αντιβίωση πρωί και βράδυ για μία εβδομάδα'
                )
              }
            >
              Αγωγή πρωί / βράδυ
            </button>

            <button
              onClick={() =>
                setText(
                  'Θέλω να χάσω κιλά και χρειάζομαι πρόγραμμα διατροφής'
                )
              }
            >
              Απώλεια βάρους
            </button>
          </div>
        </div>

        <div className="smart-card">
          <label>
            Τι χρειάζεσαι;
          </label>

          <textarea
            value={text}
            onChange={e => {
              setText(e.target.value)
              setSuggestion(null)
            }}
            placeholder="π.χ. Θέλω να χάσω κιλά και χρειάζομαι βοήθεια με τη διατροφή μου…"
          />

          <div className="smart-safety">
            ✦ Δεν χρησιμοποιείται για διάγνωση ή
            επείγον περιστατικό.
          </div>

          <button
            className="btn btn-dark wide"
            disabled={text.trim().length < 8}
            onClick={analyze}
          >
            Βρες τη σωστή κατεύθυνση
          </button>

          {suggestion?.emergency && (
            <div className="smart-result emergency-result">
              <span>
                ΕΠΕΙΓΟΥΣΑ ΕΝΔΕΙΞΗ
              </span>

              <h3>
                Η MELEO δεν είναι υπηρεσία επειγόντων.
              </h3>

              <p>
                Η περιγραφή περιέχει ένδειξη που μπορεί
                να απαιτεί άμεση βοήθεια. Μην περιμένεις
                απάντηση επαγγελματία μέσω marketplace.
              </p>

              <button
                className="btn btn-dark wide"
                onClick={() =>
                  window.location.href = 'tel:112'
                }
              >
                Κλήση 112
              </button>
            </div>
          )}

          {suggestion?.unmatched && (
            <div className="smart-result">
              <span>
                ΧΡΕΙΑΖΟΜΑΣΤΕ ΛΙΓΟ ΑΚΟΜΗ
              </span>

              <h3>
                Δεν μπορέσαμε να προσδιορίσουμε με
                ασφάλεια ειδικότητα.
              </h3>

              <p>
                Περιέγραψε λίγο πιο συγκεκριμένα την
                ανάγκη ή επίλεξε ειδικότητα χειροκίνητα.
                Απόφυγε να καταχωρείς περισσότερα
                προσωπικά ή ευαίσθητα δεδομένα από όσα
                χρειάζονται.
              </p>

              <button
                className="btn btn-outline wide"
                onClick={() => setView('search')}
              >
                Επιλογή ειδικότητας →
              </button>
            </div>
          )}

          {suggestion?.specialty && (
            <div className="smart-result">
              <span>
                ΠΡΟΤΕΙΝΟΜΕΝΗ ΚΑΤΕΥΘΥΝΣΗ
              </span>

              <h3>
                {suggestion.specialty}
              </h3>

              <p>
                {suggestion.service ||
                  'Δες όλους τους επαγγελματίες της ειδικότητας'}
              </p>

              <small>
                Βεβαιότητα αντιστοίχισης:{' '}
                {suggestion.confidence}
                {' · '}
                υποβοηθητική αντιστοίχιση, όχι διάγνωση
              </small>

              <button
                className="btn btn-gold wide"
                onClick={() => continueSearch()}
              >
                Δες επαγγελματίες →
              </button>

              {suggestion.alternatives?.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gap: 8
                  }}
                >
                  <small>
                    Ίσως να σε ενδιαφέρει επίσης:
                  </small>

                  {suggestion.alternatives.map(
                    (item: any) => (
                      <button
                        key={item.specialty}
                        className="btn btn-outline wide"
                        onClick={() =>
                          continueSearch(
                            item.specialty
                          )
                        }
                      >
                        {item.specialty} →
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function NowRequest({
  pros,
  search,
  setSearch,
  loadPros,
  openPro,
  setView,
  ProCard
}: any) {
  const [specialty, setSpecialty] =
    useState(search.specialty || 'Νοσηλευτική')

  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [accuracy, setAccuracy] = useState<number | null>(null)

  function getPosition(
    options: PositionOptions
  ): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        options
      )
    })
  }

  function geolocationErrorMessage(
    error: GeolocationPositionError
  ) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Η πρόσβαση στην τοποθεσία δεν επιτράπηκε. Έλεγξε ότι η άδεια τοποθεσίας είναι ενεργή για τη MELEO.'

      case error.POSITION_UNAVAILABLE:
        return 'Η συσκευή δεν μπόρεσε να προσδιορίσει την τοποθεσία σου. Δοκίμασε ξανά ή επίλεξε περιοχή χειροκίνητα.'

      case error.TIMEOUT:
        return 'Ο εντοπισμός τοποθεσίας άργησε περισσότερο από το αναμενόμενο. Δοκίμασε ξανά.'

      default:
        return 'Δεν μπορέσαμε να εντοπίσουμε την τοποθεσία σου.'
    }
  }

  async function resolveLocationLabel(
    lat: string,
    lon: string
  ) {
    let label = 'Η τρέχουσα τοποθεσία μου'

    try {
      const result = await api(
        `/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      )

      if (result?.label) {
        label = result.label
      }
    } catch (error) {
      console.warn(
        'MELEO Now reverse geocoding failed',
        error
      )
    }

    return label
  }

  async function locate() {
    setGeoError('')
    setReady(false)
    setLocationLabel('')
    setAccuracy(null)

    if (!window.isSecureContext) {
      setGeoError(
        'Η χρήση τοποθεσίας απαιτεί ασφαλή σύνδεση HTTPS.'
      )
      return
    }

    if (!navigator.geolocation) {
      setGeoError(
        'Η συσκευή ή ο browser δεν υποστηρίζει υπηρεσίες τοποθεσίας.'
      )
      return
    }

    setBusy(true)

    try {
      let position: GeolocationPosition

      /*
       * -------------------------------------------------------
       * 1η προσπάθεια
       * Υψηλή ακρίβεια για κινητά / GPS.
       * -------------------------------------------------------
       */
      try {
        position = await getPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000
        })
      } catch (firstError: any) {
        /*
         * -----------------------------------------------------
         * 2η προσπάθεια
         * Πιο χαλαρή ακρίβεια.
         *
         * Είναι σημαντικό σε desktop/laptop όπου ο browser
         * συχνά χρησιμοποιεί Wi-Fi/IP positioning αντί GPS.
         * -----------------------------------------------------
         */
        if (
          firstError?.code === 1
        ) {
          throw firstError
        }

        position = await getPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000
        })
      }

      const latitude =
        position.coords.latitude

      const longitude =
        position.coords.longitude

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error(
          'Invalid coordinates returned by browser'
        )
      }

      const lat = String(latitude)
      const lon = String(longitude)

      setAccuracy(
        Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null
      )

      /*
       * Reverse geocoding.
       */
      const label =
        await resolveLocationLabel(lat, lon)

      setLocationLabel(label)

      /*
       * IMPORTANT:
       * Χρησιμοποιούμε τα coordinates απευθείας.
       * Δεν βασιζόμαστε μόνο στο textual city label.
       */
      const next = {
        ...search,
        specialty,
        service: '',
        lat,
        lon,
        locationQuery: '',
        locationLabel: label
      }

      setSearch(next)

      console.log('MELEO NOW LOCATION', {
        lat,
        lon,
        accuracy: position.coords.accuracy,
        label
      })

      await loadPros(next)

      setReady(true)
    } catch (error: any) {
      console.error(
        'MELEO NOW GEOLOCATION ERROR',
        error
      )

      if (
        typeof error?.code === 'number'
      ) {
        setGeoError(
          geolocationErrorMessage(error)
        )
      } else {
        setGeoError(
          'Η τοποθεσία εντοπίστηκε με πρόβλημα κατά την αναζήτηση. Δοκίμασε ξανά.'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="now-page page">
      <div className="container">

        <div className="now-hero">

          <div>
            <span className="mode-kicker">
              ⚡ MELEO NOW
            </span>

            <h1>
              Χρειάζεσαι φροντίδα
              <br />
              <em>σήμερα;</em>
            </h1>

            <p>
              Εντόπισε επαγγελματίες που δηλώνουν
              διαθεσιμότητα και καλύπτουν τη
              γεωγραφική σου περιοχή.
            </p>
          </div>

          <div className="now-control">

            <label>
              Ειδικότητα

              <select
                value={specialty}
                onChange={e => {
                  setSpecialty(e.target.value)
                  setReady(false)
                }}
              >
                {specialtyOptions.map(x => (
                  <option key={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="btn btn-dark wide"
              onClick={locate}
              disabled={busy}
            >
              {busy
                ? '⌖ Εντοπισμός τοποθεσίας…'
                : '⌖ Χρήση τοποθεσίας & εύρεση τώρα'}
            </button>

            {locationLabel && (
              <div className="location-ok">
                ✓ Εντοπίστηκε: {locationLabel}

                {accuracy !== null && (
                  <small
                    style={{
                      display: 'block',
                      marginTop: 4
                    }}
                  >
                    Ακρίβεια περίπου {accuracy} μ.
                  </small>
                )}
              </div>
            )}

            {geoError && (
              <div className="location-error">
                <strong>
                  Δεν ολοκληρώθηκε ο εντοπισμός.
                </strong>

                <div>
                  {geoError}
                </div>

                <button
                  type="button"
                  className="btn btn-outline wide"
                  style={{ marginTop: 10 }}
                  onClick={locate}
                  disabled={busy}
                >
                  Δοκιμή ξανά
                </button>
              </div>
            )}

            <button
              className="btn btn-outline wide"
              onClick={() => setView('search')}
            >
              Αναζήτηση άλλης περιοχής
            </button>

          </div>
        </div>

        {ready && (
          <div className="now-results">

            <div className="section-title left">
              <div className="eyebrow">
                ΔΙΑΘΕΣΙΜΟΙ ΚΟΝΤΑ ΣΟΥ
              </div>

              <h2>
                {pros.length
                  ? `${pros.length} επιλογές για εσένα`
                  : 'Δεν βρέθηκαν άμεσα διαθέσιμοι'}
              </h2>

              {locationLabel && (
                <p>
                  Περιοχή αναζήτησης:{' '}
                  <strong>
                    {locationLabel}
                  </strong>
                </p>
              )}
            </div>

            <div className="pro-grid">
              {pros
                .slice(0, 6)
                .map((p: Professional) => (
                  <ProCard
                    key={p.id}
                    p={p}
                    open={() => openPro(p)}
                    favorite={false}
                    toggle={() => {}}
                  />
                ))}
            </div>

          </div>
        )}

      </div>
    </section>
  )
}
