import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import { api } from '../../lib/api'

type AvailabilityResponse = {
  professionalId:string
  date:string
  dayOfWeek?:number
  slots:string[]
  occupied?:string[]
  source?:string
}

function tomorrow(){
  const d=new Date()
  d.setDate(d.getDate()+1)

  const year=d.getFullYear()
  const month=String(d.getMonth()+1).padStart(2,'0')
  const day=String(d.getDate()).padStart(2,'0')

  return `${year}-${month}-${day}`
}

function today(){
  const d=new Date()

  const year=d.getFullYear()
  const month=String(d.getMonth()+1).padStart(2,'0')
  const day=String(d.getDate()).padStart(2,'0')

  return `${year}-${month}-${day}`
}

function BookingFlow({
  p,
  seed,
  user,
  token,
  setView,
  setToast,
  Empty,
  priceLabel,
  MiniCard
}:any){

  const availableServices =
    Array.isArray(p?.services) &&
    p.services.length > 0
      ? p.services
      : ['Επίσκεψη']

  const [step,setStep]=
    useState(1)

  const [contactConsent,setContactConsent]=
    useState(false)

  const [form,setForm]=
    useState({
      service:
        seed?.service &&
        availableServices.includes(seed.service)
          ? seed.service
          : availableServices[0],
      date:tomorrow(),
      time:'',
      address:seed?.address||'',
      notes:'',
      repeat:seed?.repeat||'once'
    })

  const [busy,setBusy]=
    useState(false)

  const [slots,setSlots]=
    useState<string[]>([])

  const [occupied,setOccupied]=
    useState<string[]>([])

  const [slotsLoading,setSlotsLoading]=
    useState(false)

  const [slotsError,setSlotsError]=
    useState('')

  const [availabilitySource,setAvailabilitySource]=
    useState('')

  const loadAvailability=
    useCallback(
      async(
        date:string,
        preserveTime=true
      )=>{
        if(!p?.id || !date){
          setSlots([])
          return []
        }

        setSlotsLoading(true)
        setSlotsError('')

        try{
          const data=
            await api<AvailabilityResponse>(
              `/professionals/${encodeURIComponent(p.id)}/availability?date=${encodeURIComponent(date)}`,
              {},
              token
            )

          const nextSlots=
            Array.isArray(data?.slots)
              ? data.slots
                  .map(x=>String(x||'').trim())
                  .filter(Boolean)
              : []

          const nextOccupied=
            Array.isArray(data?.occupied)
              ? data.occupied
              : []

          setSlots(nextSlots)
          setOccupied(nextOccupied)
          setAvailabilitySource(
            String(data?.source||'')
          )

          setForm(current=>{

            const keepCurrent=
              preserveTime &&
              nextSlots.includes(
                current.time
              )

            return {
              ...current,
              time:
                keepCurrent
                  ? current.time
                  : (
                      nextSlots[0]||''
                    )
            }
          })

          return nextSlots

        }catch(e:any){
          setSlots([])
          setOccupied([])
          setAvailabilitySource('')
          setForm(current=>({
            ...current,
            time:''
          }))

          setSlotsError(
            e?.message ||
            'Δεν ήταν δυνατή η φόρτωση των διαθέσιμων ωρών.'
          )

          return []

        }finally{
          setSlotsLoading(false)
        }
      },
      [p?.id,token]
    )

  useEffect(
    ()=>{
      loadAvailability(
        form.date,
        true
      )
    },
    [
      form.date,
      loadAvailability
    ]
  )

  const selectedDateLabel=
    useMemo(
      ()=>{
        if(!form.date){
          return ''
        }

        try{
          return new Intl.DateTimeFormat(
            'el-GR',
            {
              weekday:'long',
              day:'numeric',
              month:'long'
            }
          ).format(
            new Date(
              `${form.date}T12:00:00`
            )
          )
        }catch{
          return form.date
        }
      },
      [form.date]
    )

  async function submit(){

    if(!form.time){
      setToast(
        'Επίλεξε διαθέσιμη ώρα.'
      )
      return
    }

    setBusy(true)

    try{
      await api(
        '/bookings',
        {
          method:'POST',
          body:JSON.stringify({
            professionalId:p.id,
            ...form,
            contactConsent
          })
        },
        token
      )

      setStep(3)

      setToast(
        'Το αίτημα κράτησης καταχωρήθηκε'
      )

    }catch(e:any){

      const message=
        e?.message ||
        'Δεν ήταν δυνατή η καταχώρηση.'

      setToast(message)

      /*
       * Backend is authoritative.
       * A 409 is exposed by api() as an Error message,
       * so refresh availability after any failed booking.
       * This safely handles stale/conflicting slots without
       * weakening server-side validation.
       */
      await loadAvailability(
        form.date,
        false
      )

    }finally{
      setBusy(false)
    }
  }

  if(
    !['patient','professional']
      .includes(user?.role)
  ){
    return (
      <section className="page">

        <div className="container narrow">

          <Empty
            title="Χρειάζεται λογαριασμός συνοδού/ασθενή"
            text="Οι κρατήσεις δημιουργούνται από λογαριασμό χρήστη."
          />

          <button
            className="btn btn-dark wide"
            onClick={()=>setView('home')}
          >
            Επιστροφή
          </button>

        </div>

      </section>
    )
  }

  return (
    <section className="page">

      <div className="container booking-layout">

        <div className="booking-flow">

          <button
            className="back"
            onClick={()=>setView('profile')}
          >
            ← {p.name}
          </button>

          <div className="booking-progress">
            <span className={step>=1?'on':''}>1</span>
            <i/>
            <span className={step>=2?'on':''}>2</span>
            <i/>
            <span className={step>=3?'on':''}>3</span>
          </div>


          {step===1&&(

            <div className="form-card">

              <div className="eyebrow">
                ΒΗΜΑ 1 ΑΠΟ 2
              </div>

              <h1>
                Πότε χρειάζεσαι φροντίδα;
              </h1>

              <p className="booking-live-intro">
                Επίλεξε ημερομηνία και θα εμφανιστούν
                μόνο οι πραγματικά διαθέσιμες ώρες
                του επαγγελματία.
              </p>

              <label>
                Υπηρεσία

                <select
                  value={form.service}
                  onChange={e=>
                    setForm({
                      ...form,
                      service:e.target.value
                    })
                  }
                >
                  {availableServices.map(
                    (x:string)=>(
                      <option
                        key={x}
                        value={x}
                      >
                        {x}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label>
                Ημερομηνία

                <input
                  type="date"
                  value={form.date}
                  min={today()}
                  onChange={e=>
                    setForm(current=>({
                      ...current,
                      date:e.target.value,
                      time:''
                    }))
                  }
                />
              </label>


              <div className="booking-live-availability">

                <div className="booking-live-head">

                  <div>
                    <span>
                      ΔΙΑΘΕΣΙΜΕΣ ΩΡΕΣ
                    </span>

                    <strong>
                      {selectedDateLabel}
                    </strong>
                  </div>

                  {!slotsLoading&&(
                    <small>
                      {slots.length}
                      {' '}
                      διαθέσιμες
                    </small>
                  )}

                </div>


                {slotsLoading&&(

                  <div className="booking-slots-loading">
                    <span/>
                    Έλεγχος πραγματικής διαθεσιμότητας…
                  </div>

                )}


                {!slotsLoading&&slotsError&&(

                  <div className="booking-slots-error">

                    <strong>
                      Δεν μπορέσαμε να ελέγξουμε
                      τη διαθεσιμότητα.
                    </strong>

                    <p>
                      {slotsError}
                    </p>

                    <button
                      type="button"
                      onClick={()=>
                        loadAvailability(
                          form.date,
                          false
                        )
                      }
                    >
                      Προσπάθησε ξανά
                    </button>

                  </div>

                )}


                {!slotsLoading&&
                 !slotsError&&
                 slots.length===0&&(

                  <div className="booking-no-slots">

                    <span>○</span>

                    <div>
                      <strong>
                        Δεν υπάρχει διαθέσιμη ώρα
                        αυτή την ημέρα.
                      </strong>

                      <p>
                        Επίλεξε άλλη ημερομηνία για
                        να δεις το διαθέσιμο πρόγραμμα.
                      </p>
                    </div>

                  </div>

                )}


                {!slotsLoading&&
                 !slotsError&&
                 slots.length>0&&(

                  <div className="booking-slot-grid">

                    {slots.map(time=>(

                      <button
                        type="button"
                        key={time}
                        className={
                          form.time===time
                            ? 'selected'
                            : ''
                        }
                        onClick={()=>
                          setForm(current=>({
                            ...current,
                            time
                          }))
                        }
                      >
                        {time}
                      </button>

                    ))}

                  </div>

                )}


                {!slotsLoading&&
                 availabilitySource&&(

                  <small className="booking-live-note">
                    Η διαθεσιμότητα ελέγχεται
                    ζωντανά πριν την καταχώρηση.
                  </small>

                )}

              </div>


              <label>
                Επανάληψη

                <select
                  value={form.repeat}
                  onChange={e=>
                    setForm({
                      ...form,
                      repeat:e.target.value
                    })
                  }
                >
                  <option value="once">
                    Μία επίσκεψη
                  </option>

                  <option value="daily7">
                    Καθημερινά για 7 ημέρες
                  </option>

                  <option value="twice7">
                    Πρωί & βράδυ για 7 ημέρες
                  </option>

                </select>
              </label>


              <button
                className="btn btn-dark wide"
                disabled={
                  slotsLoading ||
                  !form.time
                }
                onClick={()=>setStep(2)}
              >
                Συνέχεια →
              </button>

            </div>
          )}


          {step===2&&(

            <div className="form-card">

              <div className="eyebrow">
                ΒΗΜΑ 2 ΑΠΟ 2
              </div>

              <h1>
                Στοιχεία επίσκεψης
              </h1>

              <div className="booking-selected-slot">

                <span>
                  ΕΠΙΛΕΓΜΕΝΗ ΩΡΑ
                </span>

                <strong>
                  {selectedDateLabel}
                  {' · '}
                  {form.time}
                </strong>

                <button
                  type="button"
                  onClick={()=>setStep(1)}
                >
                  Αλλαγή
                </button>

              </div>


              <label>
                Διεύθυνση επίσκεψης

                <input
                  placeholder="Οδός, αριθμός, περιοχή"
                  value={form.address}
                  onChange={e=>
                    setForm({
                      ...form,
                      address:e.target.value
                    })
                  }
                />
              </label>


              <label>
                Σημειώσεις

                <textarea
                  placeholder="Προαιρετικές πληροφορίες για τον επαγγελματία. Μην καταχωρείτε περισσότερα ευαίσθητα δεδομένα από όσα είναι απαραίτητα."
                  value={form.notes}
                  onChange={e=>
                    setForm({
                      ...form,
                      notes:e.target.value
                    })
                  }
                />
              </label>


              <div className="summary-box">

                <div>
                  <span>Υπηρεσία</span>
                  <b>{form.service}</b>
                </div>

                <div>
                  <span>Ημερομηνία</span>
                  <b>
                    {form.date} · {form.time}
                  </b>
                </div>

                <div>
                  <span>
                    Βασικό κόστος επίσκεψης
                  </span>
                  <b>{priceLabel(p,true)}</b>
                </div>

                <div>
                  <span>Τελικό κόστος</span>
                  <b>
                    Κατόπιν τηλεφωνικής συνεννόησης
                  </b>
                </div>

              </div>


              <label className="consent-row booking-consent">

                <input
                  type="checkbox"
                  checked={contactConsent}
                  onChange={e=>
                    setContactConsent(
                      e.target.checked
                    )
                  }
                />

                <span>
                  Συμφωνώ να κοινοποιηθούν το email
                  και το τηλέφωνό μου στον συγκεκριμένο
                  επαγγελματία για τη διαχείριση αυτού
                  του αιτήματος.
                </span>

              </label>


              <button
                className="btn btn-dark wide"
                disabled={
                  !form.address ||
                  !contactConsent ||
                  !form.time ||
                  busy
                }
                onClick={submit}
              >
                {busy
                  ? 'Καταχώρηση...'
                  : 'Αποστολή αιτήματος'}
              </button>


              <button
                className="text-btn"
                onClick={()=>setStep(1)}
              >
                ← Αλλαγή ώρας
              </button>

            </div>
          )}


          {step===3&&(

            <div className="success-card">

              <div className="success-icon">
                ✓
              </div>

              <div className="eyebrow">
                ΤΟ ΑΙΤΗΜΑ ΣΤΑΛΘΗΚΕ
              </div>

              <h1>
                Η κράτησή σου είναι σε αναμονή
                επιβεβαίωσης.
              </h1>

              <p>
                Ο επαγγελματίας θα δει το αίτημα
                στο dashboard του. Η συγκεκριμένη
                ώρα δεν προσφέρεται πλέον σε νέο
                αίτημα όσο η κράτηση παραμένει ενεργή.
              </p>

              <button
                className="btn btn-dark"
                onClick={()=>
                  setView(
                    'patient-dashboard'
                  )
                }
              >
                Οι κρατήσεις μου
              </button>

            </div>
          )}

        </div>


        <aside className="booking-side">

          <MiniCard p={p}/>

          <hr/>

          <p>
            <b>Τι ακολουθεί;</b>
          </p>

          <ol>
            <li>
              Επιλέγεις πραγματικά διαθέσιμη ώρα.
            </li>

            <li>
              Στέλνεις το αίτημα.
            </li>

            <li>
              Ο επαγγελματίας επικοινωνεί μαζί σου
              για ανάγκες και τελικό κόστος.
            </li>

            <li>
              Μετά τη συμφωνία επιβεβαιώνεται
              η επίσκεψη.
            </li>
          </ol>

        </aside>

      </div>

    </section>
  )
}

export default BookingFlow