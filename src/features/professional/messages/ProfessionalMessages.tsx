import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { api } from '../../../lib/api'
import type { Booking } from '../../../domain/types'
import {useTranslation} from 'react-i18next'

import './professional-messages.css'

type Props = {
  bookings: Booking[]
  token: string
  user: any
  unreadByBooking: Record<string,number>
  unreadTotal: number
  onRefresh: () => Promise<any> | any
  onUnreadRefresh: () => Promise<any> | any
  setToast?: (message:string)=>void
}

type Filter = 'all'|'unread'

function initials(value:string){
  const parts=String(value||'')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if(!parts.length)return 'A'

  return parts
    .slice(0,2)
    .map(x=>x.charAt(0).toUpperCase())
    .join('')
}

function timestamp(
  value?:string,
  locale='el-GR'
){
  if(!value)return ''

  const date=new Date(value)

  if(Number.isNaN(date.getTime()))return ''

  const now=new Date()

  if(date.toDateString()===now.toDateString()){
    return date.toLocaleTimeString(
      locale,
      {
        hour:'2-digit',
        minute:'2-digit'
      }
    )
  }

  return date.toLocaleDateString(
    locale,
    {
      day:'2-digit',
      month:'2-digit'
    }
  )
}

function fullTimestamp(
  value?:string,
  locale='el-GR'
){
  if(!value)return ''

  const date=new Date(value)

  if(Number.isNaN(date.getTime()))return ''

  return date.toLocaleString(
    locale,
    {
      day:'2-digit',
      month:'2-digit',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit'
    }
  )
}

function statusLabel(
  status:string|undefined,
  t:(key:string)=>string
){
  const labels:Record<string,string>={
    pending:t('proMessages.status.pending'),
    clarification:t('proMessages.status.clarification'),
    quoted:t('proMessages.status.quoted'),
    accepted:t('proMessages.status.accepted'),
    completed:t('proMessages.status.completed'),
    cancelled:t('proMessages.status.cancelled')
  }

  return labels[String(status||'')]||String(status||t('proMessages.status.request'))
}

export default function ProfessionalMessages({
  bookings,
  token,
  user,
  unreadByBooking,
  unreadTotal,
  onRefresh,
  onUnreadRefresh,
  setToast
}:Props){

  const {t,i18n}=useTranslation()
  const locale=i18n.resolvedLanguage==='en'?'en-GB':'el-GR'

  const [selectedId,setSelectedId]=useState('')
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState<Filter>('all')
  const [draft,setDraft]=useState('')
  const [sending,setSending]=useState(false)
  const [mobileThreadOpen,setMobileThreadOpen]=useState(false)
  const [isMobile,setIsMobile]=useState(false)

  const messagesRef=useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    const media=window.matchMedia('(max-width: 760px)')

    const sync=()=>setIsMobile(media.matches)

    sync()

    media.addEventListener?.('change',sync)

    return ()=>{
      media.removeEventListener?.('change',sync)
    }
  },[])

  const conversations=useMemo(()=>{

    return [...bookings]
      .filter((booking:any)=>
        (booking.messages||[]).length>0 ||
        Number(unreadByBooking[booking.id]||0)>0
      )
      .sort((a:any,b:any)=>{

        const unreadA=Number(unreadByBooking[a.id]||0)
        const unreadB=Number(unreadByBooking[b.id]||0)

        if(Boolean(unreadA)!==Boolean(unreadB)){
          return unreadB-unreadA
        }

        const lastA=(a.messages||[]).at(-1)
        const lastB=(b.messages||[]).at(-1)

        const timeA=new Date(
          lastA?.createdAt||
          a.updatedAt||
          a.createdAt||
          0
        ).getTime()

        const timeB=new Date(
          lastB?.createdAt||
          b.updatedAt||
          b.createdAt||
          0
        ).getTime()

        return timeB-timeA
      })

  },[bookings,unreadByBooking])

  const visibleConversations=useMemo(()=>{

    const needle=query.trim().toLocaleLowerCase(locale)

    return conversations.filter((booking:any)=>{

      const unread=Number(unreadByBooking[booking.id]||0)

      if(filter==='unread'&&!unread)return false

      if(!needle)return true

      const last=(booking.messages||[]).at(-1)

      const haystack=[
        booking.patientName,
        booking.service,
        booking.address,
        last?.text,
        last?.fromName
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase(locale)

      return haystack.includes(needle)
    })

  },[
    conversations,
    query,
    filter,
    unreadByBooking,
    locale
  ])

  const activeConversation=useMemo(()=>{

    return conversations.find(
      (booking:any)=>booking.id===selectedId
    )||null

  },[conversations,selectedId])

  useEffect(()=>{

    if(
      selectedId &&
      !conversations.some(
        (booking:any)=>booking.id===selectedId
      )
    ){
      setSelectedId('')
      setMobileThreadOpen(false)
    }

  },[conversations,selectedId])

  useEffect(()=>{

    if(!activeConversation)return

    requestAnimationFrame(()=>{

      const el=messagesRef.current

      if(el){
        el.scrollTop=el.scrollHeight
      }

    })

  },[
    activeConversation?.id,
    activeConversation?.messages?.length
  ])

  async function markRead(id:string){

    if(!Number(unreadByBooking[id]||0))return

    try{

      await api(
        '/bookings/'+id+'/messages/read',
        {
          method:'PATCH'
        },
        token
      )

      await onUnreadRefresh()

      window.dispatchEvent(
        new CustomEvent('meleo:communication-refresh')
      )

    }
    catch(error){
      console.error(
        'Could not mark professional conversation as read',
        error
      )
    }
  }

  async function openConversation(id:string){

    setSelectedId(id)
    setDraft('')

    if(isMobile){
      setMobileThreadOpen(true)
    }

    await markRead(id)
  }

  function closeMobileThread(){

    setMobileThreadOpen(false)

    requestAnimationFrame(()=>{

      const active=document.querySelector(
        `[data-professional-conversation="${selectedId}"]`
      ) as HTMLElement|null

      active?.focus?.()

    })
  }

  async function sendMessage(){

    const text=draft.trim()

    if(
      !text ||
      !activeConversation ||
      sending
    ){
      return
    }

    try{

      setSending(true)

      await api(
        '/bookings/'+activeConversation.id+'/message',
        {
          method:'POST',
          body:JSON.stringify({text})
        },
        token
      )

      setDraft('')

      await onRefresh()
      await onUnreadRefresh()

      window.dispatchEvent(
        new CustomEvent('meleo:communication-refresh')
      )

    }
    catch(error:any){

      setToast?.(
        error?.message||
        t('proMessages.errors.send')
      )

    }
    finally{
      setSending(false)
    }
  }

  function handleComposerKeyDown(
    event:React.KeyboardEvent<HTMLTextAreaElement>
  ){

    if(
      event.key==='Enter' &&
      !event.shiftKey
    ){
      event.preventDefault()
      void sendMessage()
    }
  }

  const listVisible=
    !isMobile ||
    !mobileThreadOpen

  const threadVisible=
    !isMobile ||
    mobileThreadOpen

  return(
    <section
      className={
        'professional-messenger '+
        (mobileThreadOpen?'mobile-thread-open':'mobile-list-open')
      }
    >

      <aside
        className="professional-messenger-sidebar"
        aria-hidden={!listVisible}
      >

        <header className="professional-messenger-list-head">

          <div>
            <span>MELEO MESSAGES</span>
            <h2>{t('proMessages.header.title')}</h2>
          </div>

          {unreadTotal>0&&
            <strong
              className="professional-messenger-total-unread"
              aria-label={t(
                'proMessages.header.unreadTotalAria',
                {count:unreadTotal}
              )}
            >
              {unreadTotal}
            </strong>
          }

        </header>

        <div className="professional-messenger-tools">

          <label className="professional-messenger-search">

            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              value={query}
              onChange={event=>setQuery(event.target.value)}
              placeholder={t('proMessages.search.placeholder')}
              aria-label={t('proMessages.search.aria')}
            />

          </label>

          <div
            className="professional-messenger-filters"
            role="group"
            aria-label={t('proMessages.filters.aria')}
          >

            <button
              type="button"
              className={filter==='all'?'active':''}
              onClick={()=>setFilter('all')}
            >
              {t('proMessages.filters.all')}
            </button>

            <button
              type="button"
              className={filter==='unread'?'active':''}
              onClick={()=>setFilter('unread')}
            >
              {t('proMessages.filters.unread')}
              {unreadTotal>0&&<b>{unreadTotal}</b>}
            </button>

          </div>

        </div>

        <div className="professional-messenger-conversations">

          {visibleConversations.length===0
            ?
            <div className="professional-messenger-empty-list">

              <span aria-hidden="true">✉</span>

              <strong>
                {filter==='unread'
                  ? t('proMessages.empty.unread')
                  : query
                    ? t('proMessages.empty.search')
                    : t('proMessages.empty.none')}
              </strong>

              <p>
                {query
                  ? t('proMessages.empty.searchText')
                  : t('proMessages.empty.noneText')}
              </p>

            </div>
            :
            visibleConversations.map((booking:any)=>{

              const messages=booking.messages||[]
              const last=messages.at(-1)
              const unread=Number(
                unreadByBooking[booking.id]||0
              )

              const selected=
                activeConversation?.id===booking.id

              return(
                <button
                  type="button"
                  key={booking.id}
                  data-professional-conversation={booking.id}
                  className={
                    'professional-conversation-item '+
                    (selected?'selected ':'')+
                    (unread?'unread':'')
                  }
                  onClick={()=>
                    void openConversation(booking.id)
                  }
                >

                  <div className="professional-conversation-avatar">
                    {initials(
                      booking.patientName||
                      t('proMessages.fallback.patient')
                    )}
                  </div>

                  <div className="professional-conversation-copy">

                    <div className="professional-conversation-row">

                      <strong>
                        {booking.patientName||t('proMessages.fallback.patient')}
                      </strong>

                      <time>
                        {timestamp(last?.createdAt,locale)}
                      </time>

                    </div>

                    <div className="professional-conversation-service">
                      {booking.service||t('proMessages.fallback.careRequest')}
                    </div>

                    <div className="professional-conversation-preview">

                      <span>
                        {last?.fromRole==='professional'
                          ? t('proMessages.preview.youPrefix')
                          : ''}
                        {last?.text||
                         t('proMessages.preview.newConversation')}
                      </span>

                      {unread>0&&
                        <b
                          aria-label={t(
                            'proMessages.preview.unreadAria',
                            {count:unread}
                          )}
                        >
                          {unread}
                        </b>
                      }

                    </div>

                  </div>

                </button>
              )
            })
          }

        </div>

      </aside>


      <section
        className="professional-messenger-thread"
        aria-hidden={!threadVisible}
      >

        {activeConversation
          ?
          <>

            <header className="professional-thread-head">

              <button
                type="button"
                className="professional-thread-back"
                onClick={closeMobileThread}
                aria-label={t('proMessages.thread.backAria')}
              >
                ←
              </button>

              <div className="professional-conversation-avatar large">
                {initials(
                  activeConversation.patientName||
                  t('proMessages.fallback.patient')
                )}
              </div>

              <div className="professional-thread-person">

                <strong>
                  {activeConversation.patientName||
                   t('proMessages.fallback.patient')}
                </strong>

                <span>
                  {activeConversation.service||
                   t('proMessages.fallback.careRequest')}
                </span>

              </div>

              <span
                className={
                  'professional-thread-status status-'+
                  String(activeConversation.status||'unknown')
                }
              >
                {statusLabel(activeConversation.status,t)}
              </span>

            </header>


            <div className="professional-thread-context">

              <div>
                <span>{t('proMessages.context.service')}</span>
                <strong>
                  {activeConversation.service||'—'}
                </strong>
              </div>

              <div>
                <span>{t('proMessages.context.visit')}</span>
                <strong>
                  {activeConversation.date||'—'}
                  {activeConversation.time
                    ? ' · '+activeConversation.time
                    : ''}
                </strong>
              </div>

              {(activeConversation.agreedPrice||
                activeConversation.proposedPrice||
                activeConversation.price)&&
                <div>
                  <span>{t('proMessages.context.cost')}</span>
                  <strong>
                    {activeConversation.agreedPrice||
                     activeConversation.proposedPrice||
                     activeConversation.price}€
                  </strong>
                </div>
              }

            </div>


            <div
              className="professional-thread-messages"
              ref={messagesRef}
              aria-live="polite"
            >

              {(activeConversation.messages||[]).length===0
                ?
                <div className="professional-thread-empty">

                  <span aria-hidden="true">✉</span>

                  <strong>{t('proMessages.thread.startTitle')}</strong>

                  <p>
                    {t('proMessages.thread.startText')}
                  </p>

                </div>
                :
                (activeConversation.messages||[]).map((message:any)=>{

                  const mine=
                    message.fromRole==='professional' ||
                    message.senderRole==='professional' ||
                    message.senderUserId===user?.id

                  return(
                    <div
                      key={message.id}
                      className={
                        'professional-message-line '+
                        (mine?'mine':'theirs')
                      }
                    >

                      <div className="professional-message-bubble">

                        {!mine&&
                          <b>
                            {message.fromName||
                             message.senderName||
                             activeConversation.patientName||
                             t('proMessages.fallback.patient')}
                          </b>
                        }

                        <p>
                          {message.text||
                           message.body||
                           ''}
                        </p>

                        <time>
                          {fullTimestamp(message.createdAt,locale)}
                        </time>

                      </div>

                    </div>
                  )
                })
              }

            </div>


            {activeConversation.status!=='cancelled'&&
              <footer className="professional-thread-composer">

                <textarea
                  value={draft}
                  onChange={event=>setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={t('proMessages.composer.placeholder')}
                  rows={1}
                  aria-label={t('proMessages.composer.newMessageAria')}
                />

                <button
                  type="button"
                  disabled={
                    sending||
                    !draft.trim()
                  }
                  onClick={()=>
                    void sendMessage()
                  }
                  aria-label={t('proMessages.composer.sendAria')}
                >
                  {sending?'…':'➜'}
                </button>

              </footer>
            }

          </>
          :
          <div className="professional-thread-placeholder">

            <div className="professional-thread-placeholder-mark">
              M
            </div>

            <strong>
              {t('proMessages.placeholder.title')}
            </strong>

            <p>
              {t('proMessages.placeholder.text')}
            </p>

          </div>
        }

      </section>

    </section>
  )
}