import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LANGUAGES = ['el','en'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

const STORAGE_KEY='meleo.language'

const resources={
  el:{
    translation:{
      home:{
        language:{el:'ΕΛ',en:'EN',label:'Γλώσσα'},
        eyebrow:'ΦΡΟΝΤΙΔΑ ΜΕ ΕΜΠΙΣΤΟΣΥΝΗ',
        titleLead:'Η σωστή φροντίδα,',
        titleEmphasis:'κοντά σου.',
        intro:'Βρες επαληθευμένους επαγγελματίες υγείας, φροντίδας και ευεξίας, σύγκρινε επιλογές και κλείσε την υπηρεσία που χρειάζεσαι.',
        trustVerified:'Επαληθευμένα προφίλ',
        trustPricing:'Ευέλικτη ενημέρωση κόστους',
        trustBooking:'Ασφαλής κράτηση',
        availableToday:'Διαθέσιμοι σήμερα',
        phoneTitle:'Βρες φροντίδα κοντά σου',
        nearby:'Κοντά σου',
        gpsHelp:'GPS ή αναζήτηση οποιασδήποτε περιοχής',
        patientFree:'για τον συνοδό/ασθενή',
        browseKicker:'BROWSE',
        browseTitle:'Ξέρω τι ψάχνω',
        browseText:'Ειδικότητα → προαιρετική υπηρεσία → τοποθεσία. Σύγκρινε επαγγελματίες και επίλεξε.',
        browseCta:'Αναζήτηση επαγγελματία →',
        smartKicker:'SMART REQUEST',
        smartTitle:'Πες μας τι χρειάζεσαι',
        smartText:'Περιέγραψε την ανάγκη με απλά λόγια και η MELEO θα σε κατευθύνει στη σωστή κατηγορία.',
        smartCta:'Ξεκίνα Smart Request →',
        nowKicker:'MELEO NOW',
        nowTitle:'Το χρειάζομαι άμεσα',
        nowText:'Βρες διαθέσιμους επαγγελματίες που καλύπτουν την περιοχή σου σήμερα.',
        nowCta:'Βρες διαθέσιμο τώρα →',
        metricSteps:'3 βήματα',
        metricStepsText:'μέχρι την κράτηση',
        metricCheck:'Έλεγχος',
        metricCheckText:'επαγγελματικής ιδιότητας πριν τη δημοσίευση',
        metricOnline:'online αναζήτηση',
        metricFree:'κόστος πλατφόρμας για τον συνοδό/ασθενή',
        featuredOver:'ΕΠΙΛΟΓΕΣ ΓΙΑ ΕΣΕΝΑ',
        featuredTitle:'Επαγγελματίες που ξεχωρίζουν',
        featuredSubtitle:'Ανακάλυψε επαληθευμένους επαγγελματίες κοντά σου.',
        seeAll:'Δες όλους τους επαγγελματίες →',
        howOver:'ΠΩΣ ΛΕΙΤΟΥΡΓΕΙ',
        howTitle:'Απλό, ανθρώπινο, ξεκάθαρο',
        howSubtitle:'Από την ανάγκη στη φροντίδα χωρίς περιττή ταλαιπωρία.',
        step1Title:'Αναζήτησε',
        step1Text:'Διάλεξε ειδικότητα, προαιρετικά υπηρεσία και βρες επαγγελματίες κοντά σου ή σε άλλη περιοχή.',
        step2Title:'Σύγκρινε',
        step2Text:'Δες επαλήθευση, εμπειρία, αξιολογήσεις, διαθεσιμότητα και τιμή.',
        step3Title:'Κλείσε',
        step3Text:'Στείλε το αίτημα και παρακολούθησε την κράτηση από το dashboard σου.',
        proOver:'ΓΙΑ ΕΠΑΓΓΕΛΜΑΤΙΕΣ',
        proTitle1:'Η εμπειρία σου αξίζει',
        proTitle2:'να σε βρίσκει ο κόσμος.',
        proText:'Δημιούργησε επαγγελματικό προφίλ, όρισε υπηρεσίες, τιμές και διαθεσιμότητα και δέξου νέα αιτήματα.',
        proCta:'Γίνε Founding Professional',
        month:'/ μήνα · PREMIUM 14,99€',
        proFeatureProfile:'Δικό σου επαγγελματικό προφίλ',
        proFeatureAlerts:'Ειδοποιήσεις νέων αιτημάτων',
        proFeatureAvailability:'Διαχείριση διαθεσιμότητας',
        proFeatureStats:'Στατιστικά & ιστορικό'
      },
      search:{
        specialty:'1 · Ειδικότητα',
        chooseSpecialty:'Επίλεξε ειδικότητα',
        service:'2 · Υπηρεσία',
        optional:'προαιρετικά',
        allServices:'Όλες οι υπηρεσίες',
        firstSpecialty:'Πρώτα επίλεξε ειδικότητα',
        location:'3 · Τοποθεσία',
        locationPlaceholder:'Πόλη, περιοχή ή ΤΚ',
        nearMe:'Κοντά μου',
        nearMeTitle:'Χρήση τρέχουσας τοποθεσίας',
        search:'Αναζήτηση',
        currentLocation:'Η τρέχουσα τοποθεσία μου',
        unsupportedGeo:'Η συσκευή δεν υποστηρίζει υπηρεσίες τοποθεσίας.',
        deniedGeo:'Δεν δόθηκε πρόσβαση στην τοποθεσία. Μπορείς να πληκτρολογήσεις περιοχή χειροκίνητα.'
      }
    }
  },
  en:{
    translation:{
      home:{
        language:{el:'EL',en:'EN',label:'Language'},
        eyebrow:'CARE YOU CAN TRUST',
        titleLead:'The right care,',
        titleEmphasis:'close to you.',
        intro:'Find verified health, care and wellness professionals, compare options and book the service you need.',
        trustVerified:'Verified profiles',
        trustPricing:'Flexible cost updates',
        trustBooking:'Secure booking',
        availableToday:'Available today',
        phoneTitle:'Find care near you',
        nearby:'Near you',
        gpsHelp:'GPS or search any area',
        patientFree:'for the patient/caregiver',
        browseKicker:'BROWSE',
        browseTitle:'I know what I need',
        browseText:'Specialty → optional service → location. Compare professionals and choose.',
        browseCta:'Find a professional →',
        smartKicker:'SMART REQUEST',
        smartTitle:'Tell us what you need',
        smartText:'Describe your need in simple words and MELEO will guide you to the right category.',
        smartCta:'Start Smart Request →',
        nowKicker:'MELEO NOW',
        nowTitle:'I need help now',
        nowText:'Find professionals available in your area today.',
        nowCta:'Find someone available →',
        metricSteps:'3 steps',
        metricStepsText:'to booking',
        metricCheck:'Verification',
        metricCheckText:'of professional credentials before publication',
        metricOnline:'online search',
        metricFree:'platform cost for the patient/caregiver',
        featuredOver:'PICKS FOR YOU',
        featuredTitle:'Professionals who stand out',
        featuredSubtitle:'Discover verified professionals near you.',
        seeAll:'See all professionals →',
        howOver:'HOW IT WORKS',
        howTitle:'Simple, human, clear',
        howSubtitle:'From need to care without unnecessary friction.',
        step1Title:'Search',
        step1Text:'Choose a specialty, optionally a service, and find professionals near you or in another area.',
        step2Title:'Compare',
        step2Text:'Review verification, experience, ratings, availability and price.',
        step3Title:'Book',
        step3Text:'Send your request and track the booking from your dashboard.',
        proOver:'FOR PROFESSIONALS',
        proTitle1:'Your experience deserves',
        proTitle2:'to be discovered.',
        proText:'Create your professional profile, set services, prices and availability, and receive new requests.',
        proCta:'Become a Founding Professional',
        month:'/ month · PREMIUM €14.99',
        proFeatureProfile:'Your professional profile',
        proFeatureAlerts:'New request notifications',
        proFeatureAvailability:'Availability management',
        proFeatureStats:'Statistics & history'
      },
      search:{
        specialty:'1 · Specialty',
        chooseSpecialty:'Choose specialty',
        service:'2 · Service',
        optional:'optional',
        allServices:'All services',
        firstSpecialty:'Choose a specialty first',
        location:'3 · Location',
        locationPlaceholder:'City, area or postal code',
        nearMe:'Near me',
        nearMeTitle:'Use current location',
        search:'Search',
        currentLocation:'My current location',
        unsupportedGeo:'Location services are not supported on this device.',
        deniedGeo:'Location access was not granted. You can type an area manually.'
      }
    }
  }
}

function initialLanguage():SupportedLanguage{
  try{
    const stored=localStorage.getItem(STORAGE_KEY)
    if(stored==='en'||stored==='el')return stored
  }catch{}
  return 'el'
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng:initialLanguage(),
    fallbackLng:'el',
    supportedLngs:[...SUPPORTED_LANGUAGES],
    interpolation:{escapeValue:false},
    returnNull:false
  })

function syncDocumentLanguage(language:string){
  const next=language==='en'?'en':'el'
  document.documentElement.lang=next
  try{localStorage.setItem(STORAGE_KEY,next)}catch{}
}

syncDocumentLanguage(i18n.language)
i18n.on('languageChanged',syncDocumentLanguage)

export default i18n
