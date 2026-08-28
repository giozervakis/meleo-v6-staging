import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {api} from '../../../lib/api'

import './professional-support.css'


type SupportMessage={
  id:string
  fromRole:string
  fromName:string
  text:string
  createdAt:string
}


type SupportTicket={
  id:string
  subject:string
  category?:string
  status:string
  createdAt:string
  updatedAt:string
  messages:SupportMessage[]
}


type Props={
  token:string
  setToast:(message:string)=>void
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

  return date.toLocaleString(
    'el-GR',
    {
      day:'2-digit',
      month:'short',
      hour:'2-digit',
      minute:'2-digit'
    }
  )
}


function statusLabel(status:string){

  if(status==='closed'){
    return 'Κλειστό'
  }

  if(status==='pending'){
    return 'Σε αναμονή'
  }

  return 'Ανοιχτό'
}


export default function ProfessionalSupport({
  token,
  setToast
}:Props){

  const [tickets,setTickets]=
    useState<SupportTicket[]>([])

  const [selectedId,setSelectedId]=
    useState<string>('')

  const [loading,setLoading]=
    useState(true)

  const [busy,setBusy]=
    useState(false)

  const [mobileThread,setMobileThread]=
    useState(false)

  const [composeOpen,setComposeOpen]=
    useState(false)

  const [subject,setSubject]=
    useState('')

  const [category,setCategory]=
    useState('booking')

  const [message,setMessage]=
    useState('')

  const [reply,setReply]=
    useState('')

  const [error,setError]=
    useState('')


  const load=
    useCallback(
      async(
        preserveSelection=true
      )=>{

        setLoading(true)

        try{

          const response=
            await api(
              '/support/tickets?page=1&limit=100',
              {},
              token
            )

          const next=
            Array.isArray(response?.items)
              ? response.items
              : []

          setTickets(next)

          setSelectedId(
            current=>{

              if(
                preserveSelection &&
                current &&
                next.some(
                  (ticket:SupportTicket)=>
                    ticket.id===current
                )
              ){
                return current
              }

              return next[0]?.id || ''
            }
          )

          setError('')
        }
        catch(e:any){

          setError(
            e?.message ||
            'Δεν ήταν δυνατή η φόρτωση των αιτημάτων υποστήριξης.'
          )
        }
        finally{
          setLoading(false)
        }
      },
      [token]
    )


  useEffect(()=>{
    load(false)
  },[load])


  const selected=
    useMemo(
      ()=>
        tickets.find(
          ticket=>
            ticket.id===selectedId
        ) || null,
      [
        tickets,
        selectedId
      ]
    )


  const openCount=
    tickets.filter(
      ticket=>
        ticket.status!=='closed'
    ).length


  async function createTicket(){

    if(busy){
      return
    }

    if(
      !subject.trim() ||
      !message.trim()
    ){
      setError(
        'Συμπλήρωσε θέμα και μήνυμα.'
      )

      return
    }

    setBusy(true)
    setError('')

    try{

      const response=
        await api(
          '/support/tickets',
          {
            method:'POST',
            body:JSON.stringify({
              subject:
                subject.trim(),

              category,

              text:
                message.trim()
            })
          },
          token
        )

      setSubject('')
      setMessage('')
      setCategory('booking')
      setComposeOpen(false)

      await load(false)

      if(response?.id){
        setSelectedId(response.id)
        setMobileThread(true)
      }

      setToast(
        'Το αίτημα υποστήριξης δημιουργήθηκε.'
      )
    }
    catch(e:any){

      setError(
        e?.message ||
        'Το αίτημα δεν δημιουργήθηκε.'
      )
    }
    finally{
      setBusy(false)
    }
  }


  async function sendReply(){

    if(
      busy ||
      !selected ||
      !reply.trim()
    ){
      return
    }

    setBusy(true)
    setError('')

    try{

      await api(
        `/support/tickets/${encodeURIComponent(selected.id)}/message`,
        {
          method:'POST',
          body:JSON.stringify({
            text:
              reply.trim()
          })
        },
        token
      )

      setReply('')

      await load(true)
    }
    catch(e:any){

      setError(
        e?.message ||
        'Το μήνυμα δεν στάλθηκε.'
      )
    }
    finally{
      setBusy(false)
    }
  }


  return (
    <section className="pro-support">


      <header className="pro-support-hero">

        <div>

          <span>
            MELEO PROFESSIONAL SUPPORT
          </span>

          <h2>
            Υποστήριξη με ιστορικό.
          </h2>

          <p>
            Δημιούργησε αίτημα, παρακολούθησε την
            κατάστασή του και συνέχισε τη συζήτηση
            με την ομάδα MELEO στο ίδιο ticket.
          </p>

        </div>


        <aside>

          <small>
            ΕΝΕΡΓΑ TICKETS
          </small>

          <strong>
            {openCount}
          </strong>

          <button
            type="button"
            onClick={
              ()=>setComposeOpen(true)
            }
          >
            + Νέο αίτημα
          </button>

        </aside>

      </header>


      {error&&
        <div className="pro-support-error">
          {error}
        </div>
      }


      {composeOpen&&
        <section className="pro-support-compose">

          <div className="pro-support-compose-head">

            <div>
              <span>
                NEW SUPPORT REQUEST
              </span>

              <h3>
                Νέο αίτημα υποστήριξης
              </h3>
            </div>

            <button
              type="button"
              onClick={
                ()=>setComposeOpen(false)
              }
            >
              ×
            </button>

          </div>


          <div className="pro-support-compose-grid">

            <label>
              <span>
                Θέμα
              </span>

              <input
                value={subject}
                maxLength={160}
                onChange={
                  event=>
                    setSubject(
                      event.target.value
                    )
                }
                placeholder="Σύντομη περιγραφή του θέματος"
              />
            </label>


            <label>
              <span>
                Κατηγορία
              </span>

              <select
                value={category}
                onChange={
                  event=>
                    setCategory(
                      event.target.value
                    )
                }
              >
                <option value="general">
                  Γενικό
                </option>

                <option value="account">
                  Λογαριασμός
                </option>

                <option value="booking">
                  Αιτήματα / Ραντεβού
                </option>

                <option value="billing">
                  Συνδρομή / Χρέωση
                </option>

                <option value="technical">
                  Τεχνικό θέμα
                </option>

                <option value="verification">
                  Verification
                </option>
              </select>
            </label>


            <label className="full">
              <span>
                Μήνυμα
              </span>

              <textarea
                value={message}
                maxLength={2000}
                onChange={
                  event=>
                    setMessage(
                      event.target.value
                    )
                }
                placeholder="Περιέγραψε τι χρειάζεσαι…"
              />

              <small>
                {message.length} / 2000
              </small>
            </label>

          </div>


          <div className="pro-support-compose-actions">

            <button
              type="button"
              className="secondary"
              onClick={
                ()=>setComposeOpen(false)
              }
            >
              Ακύρωση
            </button>

            <button
              type="button"
              disabled={
                busy ||
                !subject.trim() ||
                !message.trim()
              }
              onClick={createTicket}
            >
              {busy
                ? 'Αποστολή…'
                : 'Δημιουργία αιτήματος'}
            </button>

          </div>

        </section>
      }


      <div
        className={
          'pro-support-workspace '+
          (mobileThread
            ? 'mobile-thread-open'
            : '')
        }
      >


        <aside className="pro-support-ticket-list">

          <div className="pro-support-ticket-list-head">

            <div>
              <span>
                SUPPORT HISTORY
              </span>

              <strong>
                Τα αιτήματά μου
              </strong>
            </div>

            <b>
              {tickets.length}
            </b>

          </div>


          {loading

            ? <div className="pro-support-ticket-empty">
                Φόρτωση…
              </div>

            : tickets.length===0

              ? <div className="pro-support-ticket-empty">

                  <strong>
                    Δεν υπάρχουν αιτήματα
                  </strong>

                  <p>
                    Όταν χρειαστείς βοήθεια,
                    δημιούργησε νέο ticket.
                  </p>

                </div>

              : <div className="pro-support-ticket-items">

                  {tickets.map(
                    ticket=>

                      <button
                        type="button"
                        key={ticket.id}
                        className={
                          ticket.id===selectedId
                            ? 'active'
                            : ''
                        }
                        onClick={
                          ()=>{

                            setSelectedId(
                              ticket.id
                            )

                            setMobileThread(true)
                          }
                        }
                      >

                        <div>
                          <span
                            className={
                              'status '+
                              ticket.status
                            }
                          >
                            {statusLabel(
                              ticket.status
                            )}
                          </span>

                          <time>
                            {dateLabel(
                              ticket.updatedAt
                            )}
                          </time>
                        </div>

                        <strong>
                          {ticket.subject}
                        </strong>

                        <small>
                          {ticket.category ||
                           'general'}
                        </small>

                      </button>
                  )}

                </div>
          }

        </aside>


        <section className="pro-support-thread">

          {selected

            ? <>

                <header className="pro-support-thread-head">

                  <button
                    type="button"
                    className="pro-support-back"
                    onClick={
                      ()=>setMobileThread(false)
                    }
                    aria-label="Πίσω στα αιτήματα"
                  >
                    ←
                  </button>

                  <div>

                    <span
                      className={
                        'status '+
                        selected.status
                      }
                    >
                      {statusLabel(
                        selected.status
                      )}
                    </span>

                    <h3>
                      {selected.subject}
                    </h3>

                    <small>
                      {selected.category ||
                       'general'}
                      {' · '}
                      {dateLabel(
                        selected.createdAt
                      )}
                    </small>

                  </div>

                </header>


                <div className="pro-support-messages">

                  {(selected.messages||[]).map(
                    item=>{

                      const mine=
                        item.fromRole!=='admin'

                      return (
                        <div
                          key={item.id}
                          className={
                            'pro-support-message '+
                            (mine
                              ? 'mine'
                              : 'support')
                          }
                        >

                          <div>

                            <span>
                              {mine
                                ? 'Εσύ'
                                : item.fromName ||
                                  'MELEO Support'}
                            </span>

                            <p>
                              {item.text}
                            </p>

                            <time>
                              {dateLabel(
                                item.createdAt
                              )}
                            </time>

                          </div>

                        </div>
                      )
                    }
                  )}

                </div>


                {selected.status!=='closed'

                  ? <div className="pro-support-reply">

                      <textarea
                        value={reply}
                        maxLength={2000}
                        onChange={
                          event=>
                            setReply(
                              event.target.value
                            )
                        }
                        placeholder="Γράψε απάντηση…"
                      />

                      <button
                        type="button"
                        disabled={
                          busy ||
                          !reply.trim()
                        }
                        onClick={sendReply}
                      >
                        {busy
                          ? '…'
                          : 'Αποστολή'}
                      </button>

                    </div>

                  : <div className="pro-support-closed">

                      <span>
                        ✓
                      </span>

                      Το ticket έχει κλείσει από
                      την ομάδα υποστήριξης.

                    </div>
                }

              </>

            : <div className="pro-support-thread-empty">

                <span>
                  ?
                </span>

                <strong>
                  Επίλεξε ένα αίτημα
                </strong>

                <p>
                  Το ιστορικό της συζήτησης θα
                  εμφανιστεί εδώ.
                </p>

              </div>
          }

        </section>

      </div>

    </section>
  )
}