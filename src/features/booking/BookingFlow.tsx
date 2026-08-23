import React, { useState } from 'react'
import { api } from '../../lib/api'

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

  const defaultTimeSlots = [
    '08:00','08:30',
    '09:00','09:30',
    '10:00','10:30',
    '11:00','11:30',
    '12:00','12:30',
    '13:00','13:30',
    '14:00','14:30',
    '15:00','15:30',
    '16:00','16:30',
    '17:00','17:30',
    '18:00','18:30',
    '19:00','19:30',
    '20:00'
  ]

  const professionalTimes =
    Array.isArray(p?.availability)
      ? p.availability.filter(
          (x:any) => typeof x === 'string' && x.trim() !== ''
        )
      : []

  const availableTimes =
    professionalTimes.length > 0
      ? professionalTimes
      : defaultTimeSlots

  const availableServices =
    Array.isArray(p?.services) && p.services.length > 0
      ? p.services
      : ['Επίσκεψη']

  const [step,setStep] = useState(1)

  const [contactConsent,setContactConsent] = useState(false)

  const [form,setForm] = useState({
    service: seed?.service&&availableServices.includes(seed.service)?seed.service:availableServices[0],
    date: new Date(Date.now()+86400000).toISOString().slice(0,10),
    time: availableTimes[0] || '10:00',
    address: seed?.address||'',
    notes: '',
    repeat: seed?.repeat||'once'
  })

  const [busy,setBusy] = useState(false)

  async function submit(){
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
      setToast('Το αίτημα κράτησης καταχωρήθηκε')

    }catch(e:any){
      setToast(e.message)
    }finally{
      setBusy(false)
    }
  }

  if(!['patient','professional'].includes(user?.role)){
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


          {/* =========================
              STEP 1
          ========================== */}

          {step===1 && (

            <div className="form-card">

              <div className="eyebrow">
                ΒΗΜΑ 1 ΑΠΟ 2
              </div>

              <h1>
                Πότε χρειάζεσαι φροντίδα;
              </h1>


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
                  {availableServices.map((x:string)=>(
                    <option
                      key={x}
                      value={x}
                    >
                      {x}
                    </option>
                  ))}
                </select>

              </label>


              <div className="two">

                <label>
                  Ημερομηνία

                  <input
                    type="date"
                    value={form.date}
                    min={new Date().toISOString().slice(0,10)}
                    onChange={e=>
                      setForm({
                        ...form,
                        date:e.target.value
                      })
                    }
                  />

                </label>


                <label>
                  Ώρα

                  <select
                    value={form.time}
                    onChange={e=>
                      setForm({
                        ...form,
                        time:e.target.value
                      })
                    }
                  >

                    {availableTimes.map((x:string)=>(

                      <option
                        key={x}
                        value={x}
                      >
                        {x}
                      </option>

                    ))}

                  </select>

                </label>

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
                onClick={()=>setStep(2)}
              >
                Συνέχεια →
              </button>

            </div>

          )}


          {/* =========================
              STEP 2
          ========================== */}

          {step===2 && (

            <div className="form-card">

              <div className="eyebrow">
                ΒΗΜΑ 2 ΑΠΟ 2
              </div>

              <h1>
                Στοιχεία επίσκεψης
              </h1>


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
                  <span>Βασικό κόστος επίσκεψης</span>
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
                    setContactConsent(e.target.checked)
                  }
                />

                <span>
                  Συμφωνώ να κοινοποιηθούν το email και
                  το τηλέφωνό μου στον συγκεκριμένο
                  επαγγελματία για τη διαχείριση αυτού
                  του αιτήματος.
                </span>

              </label>


              <button
                className="btn btn-dark wide"
                disabled={
                  !form.address ||
                  !contactConsent ||
                  busy
                }
                onClick={submit}
              >
                {busy
                  ? 'Καταχώρηση...'
                  : 'Αποστολή αιτήματος'
                }
              </button>


              <button
                className="text-btn"
                onClick={()=>setStep(1)}
              >
                ← Αλλαγή ώρας
              </button>

            </div>

          )}


          {/* =========================
              SUCCESS
          ========================== */}

          {step===3 && (

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
                Ο επαγγελματίας θα δει το αίτημα στο
                dashboard του. Μπορείς να παρακολουθείς
                την κατάσταση από τις κρατήσεις σου.
              </p>

              <button
                className="btn btn-dark"
                onClick={()=>setView('patient-dashboard')}
              >
                Οι κρατήσεις μου
              </button>

            </div>

          )}

        </div>


        {/* =========================
            SIDEBAR
        ========================== */}

        <aside className="booking-side">

          <MiniCard p={p}/>

          <hr/>

          <p>
            <b>Τι ακολουθεί;</b>
          </p>

          <ol>
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

