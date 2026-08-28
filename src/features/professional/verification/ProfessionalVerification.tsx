import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {api} from '../../../lib/api'

import './professional-verification.css'


type VerificationDocument={
  id:string
  name:string
  mime:string
  size:number
  createdAt?:string
}


type Props={
  professional:any
  user?:any
  token:string
  onRefresh:()=>Promise<any>|any
  setToast:(message:string)=>void
}


function fileToBase64(
  file:File
):Promise<string>{

  return new Promise(
    (resolve,reject)=>{

      const reader=
        new FileReader()

      reader.onload=()=>{

        const result=
          String(reader.result||'')

        const comma=
          result.indexOf(',')

        resolve(
          comma>=0
            ? result.slice(comma+1)
            : result
        )
      }

      reader.onerror=()=>reject(
        new Error(
          'Δεν ήταν δυνατή η ανάγνωση του αρχείου.'
        )
      )

      reader.readAsDataURL(file)
    }
  )
}


function formatSize(value:any){

  const bytes=
    Number(value||0)

  if(!bytes){
    return '—'
  }

  if(bytes<1024){
    return `${bytes} B`
  }

  if(bytes<1024*1024){
    return `${(bytes/1024).toFixed(1)} KB`
  }

  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}


function dateLabel(value?:string){

  if(!value){
    return ''
  }

  const date=
    new Date(value)

  if(Number.isNaN(date.getTime())){
    return ''
  }

  return date.toLocaleDateString(
    'el-GR',
    {
      day:'2-digit',
      month:'short',
      year:'numeric'
    }
  )
}


function documentTypeLabel(
  mime?:string
){

  const value=
    String(mime||'').toLowerCase()

  if(value==='application/pdf'){
    return 'PDF'
  }

  if(value.includes('jpeg')){
    return 'JPG'
  }

  if(value.includes('png')){
    return 'PNG'
  }

  if(value.includes('webp')){
    return 'WEBP'
  }

  return 'FILE'
}


export default function ProfessionalVerification({
  professional,
  user,
  token,
  onRefresh,
  setToast
}:Props){

  const [documents,setDocuments]=
    useState<VerificationDocument[]>([])

  const [licenseNumber,setLicenseNumber]=
    useState('')

  const [notes,setNotes]=
    useState('')

  const [loading,setLoading]=
    useState(true)

  const [uploadBusy,setUploadBusy]=
    useState(false)

  const [submitBusy,setSubmitBusy]=
    useState(false)

  const [error,setError]=
    useState('')


  const loadDocuments=
    useCallback(
      async()=>{

        setLoading(true)

        try{

          const result=
            await api(
              '/professional/verification-documents',
              {},
              token
            )

          setDocuments(
            Array.isArray(result)
              ? result
              : []
          )

          setError('')
        }
        catch(e:any){

          setError(
            e?.message ||
            'Δεν ήταν δυνατή η φόρτωση των δικαιολογητικών.'
          )
        }
        finally{
          setLoading(false)
        }
      },
      [token]
    )


  useEffect(()=>{
    loadDocuments()
  },[loadDocuments])


  const stage=
    String(
      professional?.onboardingStage ||
      ''
    )


  const verified=
    Boolean(
      professional?.verified
    )


  const pending=
    !verified &&
    stage==='pending_verification'


  const rejected=
    !verified &&
    stage==='verification_rejected'


  const awaitingSubscription=
    !['active','past_due'].includes(
      String(
        professional?.subscriptionStatus ||
        ''
      )
    )


  const profileComplete=
    Boolean(
      professional?.specialty &&
      professional?.title &&
      professional?.city
    )


  const emailReady=
    user?.emailVerified!==false


  const canSubmit=
    !verified &&
    !pending &&
    !awaitingSubscription &&
    profileComplete &&
    emailReady &&
    Boolean(
      licenseNumber.trim()
    )


  const status=
    useMemo(
      ()=>{

        if(verified){
          return {
            key:'approved',
            label:'MELEO Verified',
            eyebrow:'ΕΠΑΛΗΘΕΥΜΕΝΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ',
            title:'Η επαγγελματική σου ταυτότητα έχει επαληθευτεί.',
            text:'Το προφίλ σου έχει ολοκληρώσει τη διαδικασία επαλήθευσης MELEO.'
          }
        }

        if(pending){
          return {
            key:'pending',
            label:'Σε έλεγχο',
            eyebrow:'VERIFICATION IN REVIEW',
            title:'Η αίτησή σου βρίσκεται σε έλεγχο.',
            text:'Η υποβολή έχει καταχωρηθεί και αναμένει απόφαση από την ομάδα διαχείρισης.'
          }
        }

        if(rejected){
          return {
            key:'rejected',
            label:'Χρειάζεται ενέργεια',
            eyebrow:'VERIFICATION ACTION REQUIRED',
            title:'Η προηγούμενη αίτηση δεν εγκρίθηκε.',
            text:'Μπορείς να ελέγξεις τα στοιχεία και τα δικαιολογητικά σου και να υποβάλεις νέα αίτηση.'
          }
        }

        return {
          key:'required',
          label:'Απαιτείται επαλήθευση',
          eyebrow:'MELEO PROFESSIONAL VERIFICATION',
          title:'Ολοκλήρωσε την επαγγελματική σου επαλήθευση.',
          text:'Η επαλήθευση είναι ανεξάρτητη από το εμπορικό πακέτο της συνδρομής σου.'
        }
      },
      [
        verified,
        pending,
        rejected
      ]
    )


  async function uploadFile(
    file:File
  ){

    if(uploadBusy){
      return
    }

    setError('')


    const allowed=
      [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
      ]


    if(
      file.type &&
      !allowed.includes(file.type)
    ){
      setError(
        'Επιτρέπονται μόνο PDF, JPG, PNG ή WEBP.'
      )

      return
    }


    if(
      file.size >
      5*1024*1024
    ){
      setError(
        'Το αρχείο πρέπει να είναι έως 5MB.'
      )

      return
    }


    setUploadBusy(true)

    try{

      const data=
        await fileToBase64(file)

      const result=
        await api(
          '/professional/verification-document',
          {
            method:'POST',
            body:JSON.stringify({
              name:file.name,
              data
            })
          },
          token
        )


      setDocuments(
        current=>[
          {
            id:result.id,
            name:result.name,
            mime:result.mime,
            size:Number(result.size||file.size),
            createdAt:
              new Date().toISOString()
          },
          ...current
        ]
      )


      setToast(
        'Το δικαιολογητικό αποθηκεύτηκε με ασφάλεια.'
      )
    }
    catch(e:any){

      setError(
        e?.message ||
        'Το αρχείο δεν ανέβηκε.'
      )
    }
    finally{
      setUploadBusy(false)
    }
  }


  async function submit(){

    if(submitBusy){
      return
    }

    setError('')


    if(!licenseNumber.trim()){

      setError(
        'Συμπλήρωσε αριθμό άδειας ή επαγγελματικού μητρώου.'
      )

      return
    }


    if(awaitingSubscription){

      setError(
        'Απαιτείται πρώτα ενεργή συνδρομή.'
      )

      return
    }


    if(!profileComplete){

      setError(
        'Ολοκλήρωσε πρώτα τον επαγγελματικό τίτλο, την ειδικότητα και την πόλη σου.'
      )

      return
    }


    setSubmitBusy(true)

    try{

      await api(
        '/professional/verification',
        {
          method:'POST',
          body:JSON.stringify({
            licenseNumber:
              licenseNumber.trim(),

            notes:
              notes.trim()
          })
        },
        token
      )


      await onRefresh()

      setToast(
        'Η αίτηση επαλήθευσης υποβλήθηκε.'
      )
    }
    catch(e:any){

      setError(
        e?.message ||
        'Η αίτηση δεν υποβλήθηκε.'
      )
    }
    finally{
      setSubmitBusy(false)
    }
  }


  return (
    <section className="pro-verification">


      <header
        className={
          'pro-verification-hero '+
          status.key
        }
      >

        <div className="pro-verification-hero-copy">

          <span className="pro-verification-eyebrow">
            {status.eyebrow}
          </span>

          <h2>
            {status.title}
          </h2>

          <p>
            {status.text}
          </p>


          <div className="pro-verification-status-row">

            <span
              className={
                'pro-verification-status '+
                status.key
              }
            >
              <i/>

              {status.label}
            </span>

            {professional?.specialty&&
              <span className="pro-verification-specialty">
                {professional.specialty}
              </span>
            }

          </div>

        </div>


        <aside className="pro-verification-badge">

          <div className="pro-verification-badge-symbol">
            {verified
              ? '✓'
              : pending
                ? '…'
                : rejected
                  ? '!'
                  : '✓'}
          </div>

          <span>
            MELEO
          </span>

          <strong>
            VERIFIED
          </strong>

          <small>
            PROFESSIONAL IDENTITY
          </small>

        </aside>

      </header>


      {rejected&&
        <div className="pro-verification-alert rejected">

          <span>
            !
          </span>

          <div>
            <strong>
              Χρειάζεται νέα υποβολή
            </strong>

            <p>
              Η τρέχουσα API έκδοση δεν επιστρέφει
              στον επαγγελματία το εσωτερικό σχόλιο
              απόφασης. Έλεγξε τα στοιχεία και τα
              δικαιολογητικά σου πριν από νέα υποβολή.
            </p>
          </div>

        </div>
      }


      {pending&&
        <div className="pro-verification-alert pending">

          <span>
            ◷
          </span>

          <div>
            <strong>
              Η αίτηση έχει καταχωρηθεί
            </strong>

            <p>
              Δεν χρειάζεται νέα υποβολή όσο η
              διαδικασία βρίσκεται σε κατάσταση
              ελέγχου.
            </p>
          </div>

        </div>
      }


      {error&&
        <div className="pro-verification-error">
          {error}
        </div>
      }


      <section className="pro-verification-readiness">

        <article
          className={
            emailReady
              ? 'complete'
              : 'required'
          }
        >
          <span>
            {emailReady?'✓':'1'}
          </span>

          <div>
            <small>
              ΛΟΓΑΡΙΑΣΜΟΣ
            </small>

            <strong>
              Email
            </strong>

            <p>
              {emailReady
                ? 'Επιβεβαιωμένο'
                : 'Απαιτείται επιβεβαίωση'}
            </p>
          </div>
        </article>


        <article
          className={
            awaitingSubscription
              ? 'required'
              : 'complete'
          }
        >
          <span>
            {awaitingSubscription
              ? '2'
              : '✓'}
          </span>

          <div>
            <small>
              MEMBERSHIP
            </small>

            <strong>
              Συνδρομή
            </strong>

            <p>
              {awaitingSubscription
                ? 'Απαιτείται ενεργή συνδρομή'
                : String(
                    professional?.subscriptionPlan ||
                    ''
                  ).toUpperCase() || 'Ενεργή'}
            </p>
          </div>
        </article>


        <article
          className={
            profileComplete
              ? 'complete'
              : 'required'
          }
        >
          <span>
            {profileComplete
              ? '✓'
              : '3'}
          </span>

          <div>
            <small>
              PROFILE
            </small>

            <strong>
              Επαγγελματικά στοιχεία
            </strong>

            <p>
              {profileComplete
                ? 'Βασικά στοιχεία ολοκληρωμένα'
                : 'Απαιτούνται τίτλος, ειδικότητα και πόλη'}
            </p>
          </div>
        </article>


        <article
          className={
            verified
              ? 'complete'
              : pending
                ? 'pending'
                : 'required'
          }
        >
          <span>
            {verified
              ? '✓'
              : pending
                ? '…'
                : '4'}
          </span>

          <div>
            <small>
              VERIFICATION
            </small>

            <strong>
              Έλεγχος MELEO
            </strong>

            <p>
              {verified
                ? 'Ολοκληρώθηκε'
                : pending
                  ? 'Σε εξέλιξη'
                  : 'Αναμονή υποβολής'}
            </p>
          </div>
        </article>

      </section>


      <div className="pro-verification-grid">


        <section className="pro-verification-form-card">

          <div className="pro-verification-section-heading">

            <div>
              <span>
                PROFESSIONAL IDENTITY
              </span>

              <h3>
                Στοιχεία επαλήθευσης
              </h3>
            </div>

            {!verified&&!pending&&
              <p>
                Τα στοιχεία αποστέλλονται αποκλειστικά
                στη διαδικασία επαγγελματικού ελέγχου.
              </p>
            }

          </div>


          {verified
            ? <div className="pro-verification-complete">

                <span>
                  ✓
                </span>

                <div>
                  <strong>
                    Verification complete
                  </strong>

                  <p>
                    Δεν απαιτείται νέα αίτηση όσο
                    ο λογαριασμός παραμένει
                    επαληθευμένος.
                  </p>
                </div>

              </div>

            : pending

              ? <div className="pro-verification-waiting">

                  <span>
                    ◷
                  </span>

                  <div>
                    <strong>
                      Η αίτηση βρίσκεται σε αξιολόγηση
                    </strong>

                    <p>
                      Τα ήδη αποθηκευμένα δικαιολογητικά
                      παραμένουν διαθέσιμα στη ροή
                      επαλήθευσης.
                    </p>
                  </div>

                </div>

              : <>

                  <label className="pro-verification-field">

                    <span>
                      Αριθμός άδειας / επαγγελματικού μητρώου
                    </span>

                    <input
                      value={licenseNumber}
                      maxLength={120}
                      onChange={
                        event=>
                          setLicenseNumber(
                            event.target.value
                          )
                      }
                      placeholder="Συμπλήρωσε τον αριθμό άδειας ή μητρώου"
                    />

                  </label>


                  <label className="pro-verification-field">

                    <span>
                      Σημειώσεις προς την ομάδα ελέγχου
                    </span>

                    <textarea
                      value={notes}
                      maxLength={1000}
                      onChange={
                        event=>
                          setNotes(
                            event.target.value
                          )
                      }
                      placeholder="Προαιρετικές πληροφορίες που βοηθούν στην επαλήθευση…"
                    />

                    <small>
                      {notes.length} / 1000
                    </small>

                  </label>


                  <button
                    type="button"
                    className="pro-verification-submit"
                    disabled={
                      !canSubmit ||
                      submitBusy
                    }
                    onClick={submit}
                  >
                    {submitBusy
                      ? 'Υποβολή…'
                      : rejected
                        ? 'Νέα υποβολή για έλεγχο'
                        : 'Υποβολή για έλεγχο'}
                  </button>

                </>
          }

        </section>


        <aside className="pro-verification-guide">

          <span>
            ΤΙ ΕΛΕΓΧΕΤΑΙ
          </span>

          <h3>
            Επαγγελματική ταυτότητα
          </h3>

          <div className="pro-verification-guide-list">

            <div>
              <i>01</i>

              <p>
                Τα στοιχεία του επαγγελματικού
                προφίλ που έχεις δηλώσει.
              </p>
            </div>

            <div>
              <i>02</i>

              <p>
                Ο αριθμός επαγγελματικής άδειας
                ή μητρώου που υποβάλλεις.
              </p>
            </div>

            <div>
              <i>03</i>

              <p>
                Τα δικαιολογητικά που ανεβάζεις
                στη συγκεκριμένη ροή.
              </p>
            </div>

          </div>

          <div className="pro-verification-security">
            <span>
              ◇
            </span>

            <p>
              Τα αρχεία verification αποθηκεύονται
              μέσω του secure document storage
              της MELEO και δεν αποτελούν δημόσιο
              περιεχόμενο προφίλ.
            </p>
          </div>

        </aside>

      </div>


      <section className="pro-verification-documents">

        <div className="pro-verification-section-heading">

          <div>
            <span>
              SECURE DOCUMENT VAULT
            </span>

            <h3>
              Δικαιολογητικά
            </h3>
          </div>

          <p>
            PDF, JPG, PNG ή WEBP · έως 5MB
            ανά αρχείο από το interface.
          </p>

        </div>


        {!verified&&!pending&&
          <label className="pro-verification-upload">

            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploadBusy}
              onChange={
                event=>{

                  const file=
                    event.target.files?.[0]

                  if(file){
                    uploadFile(file)
                  }

                  event.currentTarget.value=''
                }
              }
            />

            <span className="pro-verification-upload-icon">
              +
            </span>

            <div>
              <strong>
                {uploadBusy
                  ? 'Μεταφόρτωση…'
                  : 'Πρόσθεσε δικαιολογητικό'}
              </strong>

              <p>
                Το αρχείο ελέγχεται ως προς τον
                πραγματικό τύπο του πριν αποθηκευτεί.
              </p>
            </div>

            <b>
              Επιλογή αρχείου
            </b>

          </label>
        }


        {loading

          ? <div className="pro-verification-doc-empty">
              Φόρτωση δικαιολογητικών…
            </div>

          : documents.length

            ? <div className="pro-verification-doc-list">

                {documents.map(
                  document=>

                    <article
                      key={document.id}
                    >

                      <span className="pro-verification-doc-type">
                        {documentTypeLabel(
                          document.mime
                        )}
                      </span>

                      <div>
                        <strong>
                          {document.name}
                        </strong>

                        <small>
                          {formatSize(
                            document.size
                          )}

                          {document.createdAt
                            ? ` · ${dateLabel(document.createdAt)}`
                            : ''}
                        </small>
                      </div>

                      <span className="pro-verification-doc-secure">
                        ✓ Αποθηκευμένο
                      </span>

                    </article>
                )}

              </div>

            : <div className="pro-verification-doc-empty">

                <span>
                  ◇
                </span>

                <strong>
                  Δεν έχουν αποθηκευτεί δικαιολογητικά
                </strong>

                <p>
                  Τα αρχεία που ανεβάζεις για verification
                  θα εμφανίζονται εδώ.
                </p>

              </div>
        }

      </section>


      <footer className="pro-verification-footer">

        <span>
          i
        </span>

        <p>
          Η αγορά BASIC ή PREMIUM δεν συνεπάγεται
          αυτόματη επαγγελματική επαλήθευση.
          Το MELEO Verified αποτελεί ξεχωριστή
          διαδικασία ελέγχου.
        </p>

      </footer>

    </section>
  )
}