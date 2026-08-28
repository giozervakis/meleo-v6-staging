import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {api} from '../../../lib/api'

import './professional-notifications.css'


type NotificationItem={
  id:string
  type?:string
  title?:string
  body?:string
  message?:string
  text?:string
  read?:boolean
  readAt?:string|null
  createdAt?:string
  created_at?:string
}


type Props={
  token:string
  setToast:(message:string)=>void
}


function createdAt(item:NotificationItem){

  return String(
    item.createdAt ||
    item.created_at ||
    ''
  )
}


function notificationText(item:NotificationItem){

  return String(
    item.body ||
    item.message ||
    item.text ||
    ''
  )
}


function isUnread(item:NotificationItem){

  if(
    typeof item.read === 'boolean'
  ){
    return !item.read
  }

  return !item.readAt
}


function dateLabel(value:string){

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


function typeLabel(type?:string){

  const value=
    String(type||'').toLowerCase()

  if(value.includes('support')){
    return 'Υποστήριξη'
  }

  if(
    value.includes('booking') ||
    value.includes('request')
  ){
    return 'Αίτημα'
  }

  if(
    value.includes('review') ||
    value.includes('rating')
  ){
    return 'Αξιολόγηση'
  }

  if(
    value.includes('verification')
  ){
    return 'Verification'
  }

  if(
    value.includes('subscription') ||
    value.includes('billing') ||
    value.includes('payment')
  ){
    return 'Συνδρομή'
  }

  return 'MELEO'
}


export default function ProfessionalNotifications({
  token,
  setToast
}:Props){

  const [items,setItems]=
    useState<NotificationItem[]>([])

  const [loading,setLoading]=
    useState(true)

  const [busy,setBusy]=
    useState<string|null>(null)

  const [filter,setFilter]=
    useState<'all'|'unread'>('all')

  const [query,setQuery]=
    useState('')

  const [error,setError]=
    useState('')


  const load=
    useCallback(
      async()=>{

        setLoading(true)

        try{

          const response=
            await api(
              '/notifications',
              {},
              token
            )

          const next=
            Array.isArray(response)
              ? response
              : Array.isArray(response?.items)
                ? response.items
                : []

          setItems(next)
          setError('')
        }
        catch(e:any){

          setError(
            e?.message ||
            'Δεν ήταν δυνατή η φόρτωση των ειδοποιήσεων.'
          )
        }
        finally{
          setLoading(false)
        }
      },
      [token]
    )


  useEffect(()=>{
    load()
  },[load])


  const unreadCount=
    useMemo(
      ()=>
        items.filter(
          isUnread
        ).length,
      [items]
    )


  const visible=
    useMemo(
      ()=>{

        const q=
          query.trim().toLocaleLowerCase('el-GR')

        return [...items]
          .filter(
            item=>
              filter==='all' ||
              isUnread(item)
          )
          .filter(
            item=>{

              if(!q){
                return true
              }

              return (
                String(item.title||'')+
                ' '+
                notificationText(item)+
                ' '+
                String(item.type||'')
              )
                .toLocaleLowerCase('el-GR')
                .includes(q)
            }
          )
          .sort(
            (a,b)=>{

              const unreadDifference=
                Number(isUnread(b))-
                Number(isUnread(a))

              if(unreadDifference){
                return unreadDifference
              }

              return (
                new Date(createdAt(b)).getTime() -
                new Date(createdAt(a)).getTime()
              )
            }
          )
      },
      [
        items,
        filter,
        query
      ]
    )


  async function markRead(
    item:NotificationItem
  ){

    if(
      !isUnread(item) ||
      busy
    ){
      return
    }

    setBusy(item.id)

    try{

      await api(
        `/notifications/${encodeURIComponent(item.id)}/read`,
        {
          method:'PATCH'
        },
        token
      )

      const now=
        new Date().toISOString()

      setItems(
        current=>
          current.map(
            x=>
              x.id===item.id
                ? {
                    ...x,
                    read:true,
                    readAt:now
                  }
                : x
          )
      )
    }
    catch(e:any){

      setToast(
        e?.message ||
        'Η ειδοποίηση δεν ενημερώθηκε.'
      )
    }
    finally{
      setBusy(null)
    }
  }


  async function markAllRead(){

    if(
      unreadCount===0 ||
      busy
    ){
      return
    }

    setBusy('all')

    try{

      await api(
        '/notifications/read-all',
        {
          method:'PATCH'
        },
        token
      )

      const now=
        new Date().toISOString()

      setItems(
        current=>
          current.map(
            item=>({
              ...item,
              read:true,
              readAt:
                item.readAt ||
                now
            })
          )
      )

      setToast(
        'Όλες οι ειδοποιήσεις σημειώθηκαν ως αναγνωσμένες.'
      )
    }
    catch(e:any){

      setToast(
        e?.message ||
        'Οι ειδοποιήσεις δεν ενημερώθηκαν.'
      )
    }
    finally{
      setBusy(null)
    }
  }


  return (
    <section className="pro-notifications">


      <header className="pro-notifications-hero">

        <div>

          <span>
            PROFESSIONAL NOTIFICATION CENTER
          </span>

          <h2>
            Ό,τι χρειάζεται την προσοχή σου.
          </h2>

          <p>
            Αιτήματα, υποστήριξη και σημαντικές
            ενημερώσεις του επαγγελματικού λογαριασμού
            συγκεντρωμένα σε ένα καθαρό inbox.
          </p>

        </div>


        <aside>

          <small>
            ΜΗ ΑΝΑΓΝΩΣΜΕΝΕΣ
          </small>

          <strong>
            {unreadCount}
          </strong>

          <span>
            από {items.length} συνολικά
          </span>

        </aside>

      </header>


      <div className="pro-notifications-toolbar">

        <div className="pro-notifications-filters">

          <button
            type="button"
            className={
              filter==='all'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('all')}
          >
            Όλες
          </button>

          <button
            type="button"
            className={
              filter==='unread'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('unread')}
          >
            Μη αναγνωσμένες

            {unreadCount>0&&
              <b>
                {unreadCount}
              </b>
            }
          </button>

        </div>


        <div className="pro-notifications-actions">

          <input
            value={query}
            onChange={
              event=>
                setQuery(
                  event.target.value
                )
            }
            placeholder="Αναζήτηση ειδοποιήσεων"
          />

          <button
            type="button"
            disabled={
              unreadCount===0 ||
              Boolean(busy)
            }
            onClick={markAllRead}
          >
            ✓ Ανάγνωση όλων
          </button>

        </div>

      </div>


      {error&&
        <div className="pro-notifications-error">
          {error}
        </div>
      }


      {loading

        ? <div className="pro-notifications-empty">
            Φόρτωση ειδοποιήσεων…
          </div>

        : visible.length===0

          ? <div className="pro-notifications-empty">

              <span>
                ✓
              </span>

              <strong>
                {filter==='unread'
                  ? 'Δεν υπάρχουν μη αναγνωσμένες ειδοποιήσεις'
                  : 'Δεν υπάρχουν ειδοποιήσεις'}
              </strong>

              <p>
                Οι νέες ενημερώσεις του λογαριασμού
                σου θα εμφανίζονται εδώ.
              </p>

            </div>

          : <div className="pro-notifications-list">

              {visible.map(
                item=>{

                  const unread=
                    isUnread(item)

                  return (
                    <article
                      key={item.id}
                      className={
                        unread
                          ? 'unread'
                          : ''
                      }
                    >

                      <div className="pro-notification-marker">
                        <i/>
                      </div>


                      <div className="pro-notification-content">

                        <div className="pro-notification-meta">

                          <span>
                            {typeLabel(
                              item.type
                            )}
                          </span>

                          <time>
                            {dateLabel(
                              createdAt(item)
                            )}
                          </time>

                        </div>

                        <strong>
                          {item.title ||
                           'Ενημέρωση MELEO'}
                        </strong>

                        {notificationText(item)&&
                          <p>
                            {notificationText(item)}
                          </p>
                        }

                      </div>


                      <div className="pro-notification-state">

                        {unread
                          ? <button
                              type="button"
                              disabled={
                                busy===item.id
                              }
                              onClick={
                                ()=>markRead(item)
                              }
                            >
                              {busy===item.id
                                ? '…'
                                : 'Σήμανση ως αναγνωσμένη'}
                            </button>

                          : <span>
                              ✓ Αναγνώστηκε
                            </span>
                        }

                      </div>

                    </article>
                  )
                }
              )}

            </div>
      }

    </section>
  )
}