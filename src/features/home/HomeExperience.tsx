import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { api } from '../../lib/api'
import { useTranslation } from 'react-i18next'
import { catalogLabel } from '../../domain/catalog-i18n'
import './home-rc3d.css'

import {
  serviceMap,
  specialtyOptions
} from '../../domain/catalog'

import type {
  Professional
} from '../../domain/types'


export function Home({pros,search,setSearch,loadPros,openPro,favorites,toggleFav,user,setView,SectionTitle,Step,MiniCard,ProCard}:any){
  const {t}=useTranslation()

  return <div className="rc3d-home">
    <section className="hero" aria-labelledby="home-hero-title">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyedot" aria-hidden="true"/> {t('home.eyebrow')}</div>
          <h1 id="home-hero-title">{t('home.titleLead')}<br/><em>{t('home.titleEmphasis')}</em></h1>
          <p>{t('home.intro')}</p>
          <SearchBox
            search={search}
            setSearch={setSearch}
            onSearch={async (criteria:any)=>{
              setSearch(criteria)
              await loadPros(criteria)
              try{
                sessionStorage.setItem(
                  'meleo.scrollSearchResults',
                  '1'
                )
              }catch{}
              setView('search')
            }}
          />
          <div className="trust-strip" aria-label={t('home.eyebrow')}>
            <span>✓ {t('home.trustVerified')}</span>
            <span>✓ {t('home.trustPricing')}</span>
            <span>✓ {t('home.trustBooking')}</span>
          </div>
        </div>

        <div className="hero-card-wrap" aria-hidden="true">
          <div className="floating-chip topchip"><span className="pulse-dot"/> {t('home.availableToday')}</div>
          <div className="phone-card">
            <div className="phone-head"><span>9:41</span><span className="tiny-brand">MELEO Care</span></div>
            <h3>{t('home.phoneTitle')}</h3>
            <div className="phone-search">⌖ <div><b>{t('home.nearby')}</b><small>{t('home.gpsHelp')}</small></div></div>
            <div className="chips"><span className="chip active">{t('homeExperience.phone.nursing')}</span><span className="chip">{t('homeExperience.phone.physiotherapy')}</span><span className="chip">{t('homeExperience.phone.nutrition')}</span></div>
            <div className="phone-list">{pros.slice(0,3).map((p:Professional)=><MiniCard key={p.id} p={p}/>)}</div>
          </div>
          <div className="floating-chip bottomchip"><b>0€</b><span>{t('home.patientFree')}</span></div>
        </div>
      </div>
    </section>

    <section className="care-modes">
      <div className="container"><div className="care-mode-grid">
        <button type="button" className="care-mode-card browse" onClick={()=>setView('search')}><span className="mode-kicker">{t('home.browseKicker')}</span><i aria-hidden="true">⌕</i><h3>{t('home.browseTitle')}</h3><p>{t('home.browseText')}</p><b>{t('home.browseCta')}</b></button>
        <button type="button" className="care-mode-card smart" onClick={()=>setView('smart')}><span className="mode-kicker">{t('home.smartKicker')}</span><i aria-hidden="true">✦</i><h3>{t('home.smartTitle')}</h3><p>{t('home.smartText')}</p><b>{t('home.smartCta')}</b></button>
        <button type="button" className="care-mode-card now" onClick={()=>setView('now')}><span className="mode-kicker">{t('home.nowKicker')}</span><i aria-hidden="true">⚡</i><h3>{t('home.nowTitle')}</h3><p>{t('home.nowText')}</p><b>{t('home.nowCta')}</b></button>
      </div></div>
    </section>

    <section className="metric-band"><div className="container metrics">
      <div><strong>{t('home.metricSteps')}</strong><span>{t('home.metricStepsText')}</span></div>
      <div><strong>{t('home.metricCheck')}</strong><span>{t('home.metricCheckText')}</span></div>
      <div><strong>24/7</strong><span>{t('home.metricOnline')}</span></div>
      <div><strong>0€</strong><span>{t('home.metricFree')}</span></div>
    </div></section>

    <section className="section"><div className="container">
      <SectionTitle over={t('home.featuredOver')} title={t('home.featuredTitle')} subtitle={t('home.featuredSubtitle')}/>
      <div className="pro-grid">{pros.slice(0,3).map((p:Professional)=><ProCard key={p.id} p={p} open={()=>openPro(p)} favorite={favorites.includes(p.id)} toggle={()=>toggleFav(p.id)}/>)}</div>
      <div className="center"><button type="button" className="btn btn-outline" onClick={()=>setView('search')}>{t('home.seeAll')}</button></div>
    </div></section>

    <section className="section soft"><div className="container">
      <SectionTitle over={t('home.howOver')} title={t('home.howTitle')} subtitle={t('home.howSubtitle')}/>
      <div className="steps">
        <Step n="01" icon="⌕" title={t('home.step1Title')} text={t('home.step1Text')}/>
        <Step n="02" icon="◇" title={t('home.step2Title')} text={t('home.step2Text')}/>
        <Step n="03" icon="✓" title={t('home.step3Title')} text={t('home.step3Text')}/>
      </div>
    </div></section>

    <section className="section pro-cta"><div className="container cta-grid">
      <div><div className="eyebrow light">{t('home.proOver')}</div><h2>{t('home.proTitle1')}<br/>{t('home.proTitle2')}</h2><p>{t('home.proText')}</p><button type="button" className="btn btn-gold" onClick={()=>setView('become-pro')}>{t('home.proCta')}</button></div>
      <div className="cta-panel"><div className="cta-stat"><span>BASIC</span><b>9,99€</b><small>{t('home.month')}</small></div><div className="cta-line"><span>✓</span> {t('home.proFeatureProfile')}</div><div className="cta-line"><span>✓</span> {t('home.proFeatureAlerts')}</div><div className="cta-line"><span>✓</span> {t('home.proFeatureAvailability')}</div><div className="cta-line"><span>✓</span> {t('home.proFeatureStats')}</div></div>
    </div></section>
  </div>
}

export function SearchBox({search,setSearch,onSearch}:any){
  const {t,i18n}=useTranslation()
  const services=search.specialty?serviceMap[search.specialty]||[]:[]
  const [geoBusy,setGeoBusy]=useState(false)
  const [geoError,setGeoError]=useState('')

  async function nearMe(){
    setGeoError('')
    if(!navigator.geolocation){
      setGeoError(t('search.unsupportedGeo'))
      return
    }
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=String(pos.coords.latitude),lon=String(pos.coords.longitude)
      let label=t('search.currentLocation')
      try{
        const r=await api(`/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
        label=r.label||label
      }catch{}
      setSearch({...search,lat,lon,locationQuery:'',locationLabel:label})
      setGeoBusy(false)
    },()=>{
      setGeoError(t('search.deniedGeo'))
      setGeoBusy(false)
    },{enableHighAccuracy:true,timeout:10000,maximumAge:60000})
  }

  return <>
    <div className="searchbox searchbox-three location-search" role="search" aria-label={t('search.search')}>
      <div className="searchfield">
        <label htmlFor="home-specialty">{t('search.specialty')}</label>
        <select id="home-specialty" name="specialty" value={search.specialty} onChange={e=>setSearch({...search,specialty:e.target.value,service:''})}>
          <option value="">{t('search.chooseSpecialty')}</option>
          {specialtyOptions.map(x=><option key={x} value={x}>{catalogLabel(x,i18n.language)}</option>)}
        </select>
      </div>
      <div className="divider" aria-hidden="true"/>
      <div className="searchfield">
        <label htmlFor="home-service">{t('search.service')} <span className="optional">{t('search.optional')}</span></label>
        <select id="home-service" name="service" value={search.service} disabled={!search.specialty} onChange={e=>setSearch({...search,service:e.target.value})}>
          <option value="">{search.specialty?t('search.allServices'):t('search.firstSpecialty')}</option>
          {services.map((x:string)=><option key={x} value={x}>{catalogLabel(x,i18n.language)}</option>)}
        </select>
      </div>
      <div className="divider" aria-hidden="true"/>
      <div className="searchfield location-field">
        <label htmlFor="home-location">{t('search.location')}</label>
        <div className="location-entry">
          <input id="home-location" name="location" autoComplete="postal-code" placeholder={t('search.locationPlaceholder')} value={search.locationQuery} onChange={e=>setSearch({...search,locationQuery:e.target.value,locationLabel:'',lat:'',lon:''})}/>
          <button type="button" className="locate-btn" onClick={nearMe} title={t('search.nearMeTitle')} aria-label={t('search.nearMeTitle')} disabled={geoBusy}>{geoBusy?'…':'⌖'}<span>{t('search.nearMe')}</span></button>
        </div>
        {search.locationLabel&&<small className="location-ok" aria-live="polite">⌖ {search.locationLabel}</small>}
      </div>
      <button type="button" className="search-btn" onClick={()=>onSearch(search)} disabled={!search.specialty}>⌕<span>{t('search.search')}</span></button>
    </div>
    {geoError&&<div className="location-error" role="alert">{geoError}</div>}
  </>
}

export function SmartRequest({
  search,
  setSearch,
  loadPros,
  setView
}: any) {
  const {t}=useTranslation()

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
                ? 'high'
                : 'medium',
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
    let confidence = 'low'

    if (best.score >= 18) {
      confidence = 'high'
    } else if (best.score >= 10) {
      confidence = 'medium'
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
            {t(
              'homeExperience.smart.titleLead'
            )}
            <br />
            <em>
              {t(
                'homeExperience.smart.titleEmphasis'
              )}
            </em>
          </h1>

          <p>
            {t(
              'homeExperience.smart.intro'
            )}
          </p>

          <div className="smart-examples">
            <button
              onClick={() =>
                setText(
                  t(
                    'homeExperience.smart.examples.hip'
                  )
                )
              }
            >
              {t(
                'homeExperience.smart.examples.hip'
              )}
            </button>

            <button
              onClick={() =>
                setText(
                  t(
                    'homeExperience.smart.examples.treatment'
                  )
                )
              }
            >
              {t(
                'homeExperience.smart.examples.treatment'
              )}
            </button>

            <button
              onClick={() =>
                setText(
                  t(
                    'homeExperience.smart.examples.weight'
                  )
                )
              }
            >
              {t(
                'homeExperience.smart.examples.weight'
              )}
            </button>
          </div>
        </div>

        <div className="smart-card">
          <label>
            {t(
              'homeExperience.smart.form.label'
            )}
          </label>

          <textarea
            value={text}
            onChange={e => {
              setText(e.target.value)
              setSuggestion(null)
            }}
            placeholder={t(
              'homeExperience.smart.form.placeholder'
            )}
          />

          <div className="smart-safety">
            ✦ {t(
              'homeExperience.smart.form.safety'
            )}
          </div>

          <button
            className="btn btn-dark wide"
            disabled={text.trim().length < 8}
            onClick={analyze}
          >
            {t(
              'homeExperience.smart.form.submit'
            )}
          </button>

          {suggestion?.emergency && (
            <div className="smart-result emergency-result">
              <span>
                {t(
                  'homeExperience.smart.emergency.eyebrow'
                )}
              </span>

              <h3>
                {t(
                  'homeExperience.smart.emergency.title'
                )}
              </h3>

              <p>
                {t(
                  'homeExperience.smart.emergency.text'
                )}
              </p>

              <button
                className="btn btn-dark wide"
                onClick={() =>
                  window.location.href = 'tel:112'
                }
              >
                {t(
                  'homeExperience.smart.emergency.call'
                )}
              </button>
            </div>
          )}

          {suggestion?.unmatched && (
            <div className="smart-result">
              <span>
                {t(
                  'homeExperience.smart.unmatched.eyebrow'
                )}
              </span>

              <h3>
                {t(
                  'homeExperience.smart.unmatched.title'
                )}
              </h3>

              <p>
                {t(
                  'homeExperience.smart.unmatched.text'
                )}
              </p>

              <button
                className="btn btn-outline wide"
                onClick={() => setView('search')}
              >
                {t(
                  'homeExperience.smart.unmatched.cta'
                )} →
              </button>
            </div>
          )}

          {suggestion?.specialty && (
            <div className="smart-result">
              <span>
                {t(
                  'homeExperience.smart.result.eyebrow'
                )}
              </span>

              <h3>
                {suggestion.specialty}
              </h3>

              <p>
                {suggestion.service ||
                  t(
                    'homeExperience.smart.result.allProfessionals'
                  )}
              </p>

              <small>
                {t(
                  'homeExperience.smart.result.confidence'
                )}:{' '}
                {t(
                  'homeExperience.smart.confidence.'+
                  suggestion.confidence
                )}
                {' · '}
                {t(
                  'homeExperience.smart.result.disclaimer'
                )}
              </small>

              <button
                className="btn btn-gold wide"
                onClick={() => continueSearch()}
              >
                {t(
                  'homeExperience.smart.result.cta'
                )} →
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
                    {t(
                      'homeExperience.smart.result.alternatives'
                    )}
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
  const {t,i18n}=useTranslation()

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
        return t(
          'homeExperience.now.errors.permission'
        )

      case error.POSITION_UNAVAILABLE:
        return t(
          'homeExperience.now.errors.unavailable'
        )

      case error.TIMEOUT:
        return t(
          'homeExperience.now.errors.timeout'
        )

      default:
        return t(
          'homeExperience.now.errors.default'
        )
    }
  }

  async function resolveLocationLabel(
    lat: string,
    lon: string
  ) {
    let label = t(
      'homeExperience.now.currentLocation'
    )

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
        t(
          'homeExperience.now.errors.https'
        )
      )
      return
    }

    if (!navigator.geolocation) {
      setGeoError(
        t(
          'homeExperience.now.errors.unsupported'
        )
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
          t(
            'homeExperience.now.errors.search'
          )
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
              {t(
                'homeExperience.now.titleLead'
              )}
              <br />
              <em>
                {t(
                  'homeExperience.now.titleEmphasis'
                )}
              </em>
            </h1>

            <p>
              {t(
                'homeExperience.now.intro'
              )}
            </p>
          </div>

          <div className="now-control">

            <label>
              {t(
                'homeExperience.now.specialty'
              )}

              <select
                value={specialty}
                onChange={e => {
                  setSpecialty(e.target.value)
                  setReady(false)
                }}
              >
                {specialtyOptions.map(x => (
                  <option
                    key={x}
                    value={x}
                  >
                    {catalogLabel(
                      x,
                      i18n.language
                    )}
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
                ? '⌖ '+t(
                    'homeExperience.now.locating'
                  )
                : '⌖ '+t(
                    'homeExperience.now.locate'
                  )}
            </button>

            {locationLabel && (
              <div className="location-ok">
                ✓ {t(
                  'homeExperience.now.detected'
                )}: {locationLabel}

                {accuracy !== null && (
                  <small
                    style={{
                      display: 'block',
                      marginTop: 4
                    }}
                  >
                    {t(
                      'homeExperience.now.accuracy',
                      {
                        accuracy
                      }
                    )}
                  </small>
                )}
              </div>
            )}

            {geoError && (
              <div className="location-error">
                <strong>
                  {t(
                    'homeExperience.now.failureTitle'
                  )}
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
                  {t(
                    'homeExperience.now.retry'
                  )}
                </button>
              </div>
            )}

            <button
              className="btn btn-outline wide"
              onClick={() => setView('search')}
            >
              {t(
                'homeExperience.now.otherArea'
              )}
            </button>

          </div>
        </div>

        {ready && (
          <div className="now-results">

            <div className="section-title left">
              <div className="eyebrow">
                {t(
                  'homeExperience.now.results.eyebrow'
                )}
              </div>

              <h2>
                {pros.length
                  ? t(
                      'homeExperience.now.results.count',
                      {
                        count:pros.length
                      }
                    )
                  : t(
                      'homeExperience.now.results.empty'
                    )}
              </h2>

              {locationLabel && (
                <p>
                  {t(
                    'homeExperience.now.results.area'
                  )}:{' '}
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
