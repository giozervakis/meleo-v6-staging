import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {api} from '../../../lib/api'
import {useTranslation} from 'react-i18next'

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


function dateLabel(
  value?:string,
  locale='el-GR'
){

  if(!value){
    return ''
  }

  const date=
    new Date(value)

  if(Number.isNaN(date.getTime())){
    return ''
  }

  return date.toLocaleString(
    locale,
    {
      day:'2-digit',
      month:'short',
      hour:'2-digit',
      minute:'2-digit'
    }
  )
}


function statusLabel(
  status:string,
  t:(key:string)=>string
){

  if(status==='closed'){
    return t('proSupport.status.closed')
  }

  if(status==='pending'){
    return t('proSupport.status.pending')
  }

  return t('proSupport.status.open')
}


export default function ProfessionalSupport({
  token,
  setToast
}:Props){

  const {t,i18n}=useTranslation()

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
            t('proSupport.errors.load')
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
        t('proSupport.errors.required')
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
        t('proSupport.toast.created')
      )
    }
    catch(e:any){

      setError(
        e?.message ||
        t('proSupport.errors.create')
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
        t('proSupport.errors.reply')
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
            {t('proSupport.hero.title')}
          </h2>

          <p>
            {t('proSupport.hero.text')}
          </p>

        </div>


        <aside>

          <small>
            {t('proSupport.hero.activeTickets')}
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
            {t('proSupport.hero.newRequest')}
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
                {t('proSupport.compose.title')}
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
                {t('proSupport.compose.subject')}
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
                placeholder={t('proSupport.compose.subjectPlaceholder')}
              />
            </label>


            <label>
              <span>
                {t('proSupport.compose.category')}
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
                  {t('proSupport.categories.general')}
                </option>

                <option value="account">
                  {t('proSupport.categories.account')}
                </option>

                <option value="booking">
                  {t('proSupport.categories.booking')}
                </option>

                <option value="billing">
                  {t('proSupport.categories.billing')}
                </option>

                <option value="technical">
                  {t('proSupport.categories.technical')}
                </option>

                <option value="verification">
                  Verification
                </option>
              </select>
            </label>


            <label className="full">
              <span>
                {t('proSupport.compose.message')}
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
                placeholder={t('proSupport.compose.messagePlaceholder')}
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
              {t('proSupport.actions.cancel')}
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
                ? t('proSupport.actions.sending')
                : t('proSupport.actions.create')}
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
                {t('proSupport.history.title')}
              </strong>
            </div>

            <b>
              {tickets.length}
            </b>

          </div>


          {loading

            ? <div className="pro-support-ticket-empty">
                {t('proSupport.history.loading')}
              </div>

            : tickets.length===0

              ? <div className="pro-support-ticket-empty">

                  <strong>
                    {t('proSupport.history.emptyTitle')}
                  </strong>

                  <p>
                    {t('proSupport.history.emptyText')}
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
                              ticket.status,
                              t
                            )}
                          </span>

                          <time>
                            {dateLabel(
                              ticket.updatedAt,
                              i18n.resolvedLanguage==='en'
                                ? 'en-GB'
                                : 'el-GR'
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
                    aria-label={t('proSupport.thread.back')}
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
                        selected.status,
                        t
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
                        selected.createdAt,
                        i18n.resolvedLanguage==='en'
                          ? 'en-GB'
                          : 'el-GR'
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
                                ? t('proSupport.thread.you')
                                : item.fromName ||
                                  'MELEO Support'}
                            </span>

                            <p>
                              {item.text}
                            </p>

                            <time>
                              {dateLabel(
                                item.createdAt,
                                i18n.resolvedLanguage==='en'
                                  ? 'en-GB'
                                  : 'el-GR'
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
                        placeholder={t('proSupport.thread.replyPlaceholder')}
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
                          : t('proSupport.actions.send')}
                      </button>

                    </div>

                  : <div className="pro-support-closed">

                      <span>
                        ✓
                      </span>

                      {t('proSupport.thread.closedText')}

                    </div>
                }

              </>

            : <div className="pro-support-thread-empty">

                <span>
                  ?
                </span>

                <strong>
                  {t('proSupport.thread.selectTitle')}
                </strong>

                <p>
                  {t('proSupport.thread.selectText')}
                </p>

              </div>
          }

        </section>

      </div>

    </section>
  )
}