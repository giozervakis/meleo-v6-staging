import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {api} from '../../../lib/api'
import {useTranslation} from 'react-i18next'

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
          'VERIFICATION_FILE_READ_ERROR'
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

  return date.toLocaleDateString(
    locale,
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

  const {t,i18n}=useTranslation()

  const locale=
    i18n.resolvedLanguage==='en'
      ? 'en-GB'
      : 'el-GR'

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
            t('proVerification.errors.loadDocuments')
          )
        }
        finally{
          setLoading(false)
        }
      },
      [token,t]
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
            label:t(
              'proVerification.status.approved.label'
            ),
            eyebrow:t(
              'proVerification.status.approved.eyebrow'
            ),
            title:t(
              'proVerification.status.approved.title'
            ),
            text:t(
              'proVerification.status.approved.text'
            )
          }
        }

        if(pending){
          return {
            key:'pending',
            label:t(
              'proVerification.status.pending.label'
            ),
            eyebrow:t(
              'proVerification.status.pending.eyebrow'
            ),
            title:t(
              'proVerification.status.pending.title'
            ),
            text:t(
              'proVerification.status.pending.text'
            )
          }
        }

        if(rejected){
          return {
            key:'rejected',
            label:t(
              'proVerification.status.rejected.label'
            ),
            eyebrow:t(
              'proVerification.status.rejected.eyebrow'
            ),
            title:t(
              'proVerification.status.rejected.title'
            ),
            text:t(
              'proVerification.status.rejected.text'
            )
          }
        }

        return {
          key:'required',
          label:t(
            'proVerification.status.required.label'
          ),
          eyebrow:t(
            'proVerification.status.required.eyebrow'
          ),
          title:t(
            'proVerification.status.required.title'
          ),
          text:t(
            'proVerification.status.required.text'
          )
        }
      },
      [
        verified,
        pending,
        rejected,
        t
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
        t('proVerification.errors.fileType')
      )

      return
    }


    if(
      file.size >
      5*1024*1024
    ){
      setError(
        t('proVerification.errors.fileSize')
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
        t('proVerification.toast.documentSaved')
      )
    }
    catch(e:any){

      setError(
        e?.message==='VERIFICATION_FILE_READ_ERROR'
          ? t('proVerification.errors.fileRead')
          : e?.message ||
            t('proVerification.errors.upload')
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
        t('proVerification.errors.licenseRequired')
      )

      return
    }


    if(awaitingSubscription){

      setError(
        t('proVerification.errors.subscriptionRequired')
      )

      return
    }


    if(!profileComplete){

      setError(
        t('proVerification.errors.profileRequired')
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
        t('proVerification.toast.submitted')
      )
    }
    catch(e:any){

      setError(
        e?.message ||
        t('proVerification.errors.submit')
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
              {t(
                'proVerification.alerts.rejected.title'
              )}
            </strong>

            <p>
              {t(
                'proVerification.alerts.rejected.text'
              )}
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
              {t(
                'proVerification.alerts.pending.title'
              )}
            </strong>

            <p>
              {t(
                'proVerification.alerts.pending.text'
              )}
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
              {t(
                'proVerification.readiness.account.eyebrow'
              )}
            </small>

            <strong>
              Email
            </strong>

            <p>
              {emailReady
                ? t(
                    'proVerification.readiness.account.complete'
                  )
                : t(
                    'proVerification.readiness.account.required'
                  )}
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
              {t(
                'proVerification.readiness.membership.title'
              )}
            </strong>

            <p>
              {awaitingSubscription
                ? t(
                    'proVerification.readiness.membership.required'
                  )
                : String(
                    professional?.subscriptionPlan ||
                    ''
                  ).toUpperCase() ||
                  t(
                    'proVerification.readiness.membership.active'
                  )}
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
              {t(
                'proVerification.readiness.profile.title'
              )}
            </strong>

            <p>
              {profileComplete
                ? t(
                    'proVerification.readiness.profile.complete'
                  )
                : t(
                    'proVerification.readiness.profile.required'
                  )}
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
              {t(
                'proVerification.readiness.verification.title'
              )}
            </strong>

            <p>
              {verified
                ? t(
                    'proVerification.readiness.verification.complete'
                  )
                : pending
                  ? t(
                      'proVerification.readiness.verification.pending'
                    )
                  : t(
                      'proVerification.readiness.verification.required'
                    )}
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
                {t(
                  'proVerification.form.title'
                )}
              </h3>
            </div>

            {!verified&&!pending&&
              <p>
                {t(
                  'proVerification.form.intro'
                )}
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
                    {t(
                      'proVerification.form.complete.title'
                    )}
                  </strong>

                  <p>
                    {t(
                      'proVerification.form.complete.text'
                    )}
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
                      {t(
                        'proVerification.form.pending.title'
                      )}
                    </strong>

                    <p>
                      {t(
                        'proVerification.form.pending.text'
                      )}
                    </p>
                  </div>

                </div>

              : <>

                  <label className="pro-verification-field">

                    <span>
                      {t(
                        'proVerification.form.license.label'
                      )}
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
                      placeholder={t(
                        'proVerification.form.license.placeholder'
                      )}
                    />

                  </label>


                  <label className="pro-verification-field">

                    <span>
                      {t(
                        'proVerification.form.notes.label'
                      )}
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
                      placeholder={t(
                        'proVerification.form.notes.placeholder'
                      )}
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
                      ? t(
                          'proVerification.form.submit.busy'
                        )
                      : rejected
                        ? t(
                            'proVerification.form.submit.resubmit'
                          )
                        : t(
                            'proVerification.form.submit.submit'
                          )}
                  </button>

                </>
          }

        </section>


        <aside className="pro-verification-guide">

          <span>
            {t(
              'proVerification.guide.eyebrow'
            )}
          </span>

          <h3>
            {t(
              'proVerification.guide.title'
            )}
          </h3>

          <div className="pro-verification-guide-list">

            <div>
              <i>01</i>

              <p>
                {t(
                  'proVerification.guide.profile'
                )}
              </p>
            </div>

            <div>
              <i>02</i>

              <p>
                {t(
                  'proVerification.guide.license'
                )}
              </p>
            </div>

            <div>
              <i>03</i>

              <p>
                {t(
                  'proVerification.guide.documents'
                )}
              </p>
            </div>

          </div>

          <div className="pro-verification-security">
            <span>
              ◇
            </span>

            <p>
              {t(
                'proVerification.guide.security'
              )}
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
              {t(
                'proVerification.documents.title'
              )}
            </h3>
          </div>

          <p>
            {t(
              'proVerification.documents.requirements'
            )}
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
                  ? t(
                      'proVerification.documents.upload.busy'
                    )
                  : t(
                      'proVerification.documents.upload.add'
                    )}
              </strong>

              <p>
                {t(
                  'proVerification.documents.upload.text'
                )}
              </p>
            </div>

            <b>
              {t(
                'proVerification.documents.upload.select'
              )}
            </b>

          </label>
        }


        {loading

          ? <div className="pro-verification-doc-empty">
              {t(
                'proVerification.documents.loading'
              )}
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
                            ? ` · ${dateLabel(
                                document.createdAt,
                                locale
                              )}`
                            : ''}
                        </small>
                      </div>

                      <span className="pro-verification-doc-secure">
                        ✓ {t(
                          'proVerification.documents.saved'
                        )}
                      </span>

                    </article>
                )}

              </div>

            : <div className="pro-verification-doc-empty">

                <span>
                  ◇
                </span>

                <strong>
                  {t(
                    'proVerification.documents.empty.title'
                  )}
                </strong>

                <p>
                  {t(
                    'proVerification.documents.empty.text'
                  )}
                </p>

              </div>
        }

      </section>


      <footer className="pro-verification-footer">

        <span>
          i
        </span>

        <p>
          {t(
            'proVerification.footer'
          )}
        </p>

      </footer>

    </section>
  )
}