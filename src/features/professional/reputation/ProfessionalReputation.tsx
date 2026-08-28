import React, {
  useMemo,
  useState
} from 'react'

import type {
  Booking
} from '../../../domain/types'

import './professional-reputation.css'


type ProfessionalReputationProps = {
  professional:any
  bookings:Booking[]
  analytics?:any
  setTab?:(tab:string)=>void
}


type ReviewItem = {
  id:string
  bookingId:string
  rating:number
  text:string
  createdAt:string
  patientName:string
  service:string
  date:string
}


function safeRating(value:any){
  const rating=Number(value)

  if(
    !Number.isFinite(rating) ||
    rating<1 ||
    rating>5
  ){
    return 0
  }

  return rating
}


function reviewRating(review:any){
  return safeRating(
    review?.rating ??
    review?.score ??
    review?.stars
  )
}


function reviewText(review:any){
  return String(
    review?.text ??
    review?.comment ??
    review?.body ??
    review?.review ??
    ''
  ).trim()
}


function reviewDate(
  review:any,
  booking:any
){
  return String(
    review?.createdAt ??
    review?.created_at ??
    booking?.date ??
    ''
  )
}


function initials(name:string){
  return String(name||'')
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .map(x=>x[0]||'')
    .join('')
    .toUpperCase() || 'ME'
}


function formatDate(value:string){
  if(!value){
    return ''
  }

  const parsed=new Date(value)

  if(Number.isNaN(parsed.getTime())){
    return value
  }

  return parsed.toLocaleDateString(
    'el-GR',
    {
      day:'2-digit',
      month:'short',
      year:'numeric'
    }
  )
}


function Stars({
  rating,
  compact=false
}:{
  rating:number
  compact?:boolean
}){
  return (
    <span
      className={
        compact
          ? 'reputation-stars compact'
          : 'reputation-stars'
      }
      aria-label={`${rating} από 5 αστέρια`}
    >
      {[1,2,3,4,5].map(star=>
        <span
          key={star}
          className={
            star<=Math.round(rating)
              ? 'on'
              : ''
          }
        >
          ★
        </span>
      )}
    </span>
  )
}


export default function ProfessionalReputation({
  professional,
  bookings,
  analytics,
  setTab
}:ProfessionalReputationProps){

  const [filter,setFilter]=
    useState<'all'|'5'|'4'|'3'>('all')


  const completedBookings=
    useMemo(
      ()=>
        (bookings||[])
          .filter(
            (booking:any)=>
              booking.status==='completed'
          ),
      [bookings]
    )


  const reviews=
    useMemo<ReviewItem[]>(()=>{

      return completedBookings
        .filter(
          (booking:any)=>
            Boolean(booking.review)
        )
        .map((booking:any)=>{

          const review=
            booking.review||{}

          return {
            id:
              String(
                review.id ||
                `review-${booking.id}`
              ),

            bookingId:
              booking.id,

            rating:
              reviewRating(review),

            text:
              reviewText(review),

            createdAt:
              reviewDate(
                review,
                booking
              ),

            patientName:
              String(
                review.patientName ??
                review.authorName ??
                booking.patientName ??
                'Ασθενής MELEO'
              ),

            service:
              String(
                booking.service ||
                'Επίσκεψη'
              ),

            date:
              String(
                booking.date||''
              )
          }
        })
        .filter(
          item=>item.rating>0
        )
        .sort(
          (a,b)=>
            new Date(
              b.createdAt||b.date
            ).getTime()
            -
            new Date(
              a.createdAt||a.date
            ).getTime()
        )

    },[completedBookings])


  const platformRating=
    Number(
      professional?.rating||0
    )

  const platformReviewCount=
    Number(
      professional?.reviews||0
    )


  const distribution=
    useMemo(()=>{

      const map:{
        [key:number]:number
      }={
        5:0,
        4:0,
        3:0,
        2:0,
        1:0
      }

      reviews.forEach(review=>{
        const rounded=
          Math.max(
            1,
            Math.min(
              5,
              Math.round(review.rating)
            )
          )

        map[rounded]+=1
      })

      return map

    },[reviews])


  const visibleReviews=
    useMemo(()=>{

      if(filter==='all'){
        return reviews
      }

      const minimum=
        Number(filter)

      return reviews.filter(
        review=>
          Math.round(review.rating)===minimum
      )

    },[
      reviews,
      filter
    ])


  const reviewedCompleted=
    completedBookings.filter(
      (booking:any)=>
        booking.reviewed ||
        booking.review
    ).length


  const reviewCoverage=
    completedBookings.length>0
      ? Math.round(
          reviewedCompleted /
          completedBookings.length *
          100
        )
      : 0


  const trust=analytics?.trust||null

  const trustEligible=
    trust?.eligible===true ||
    trust?.isEligible===true ||
    trust?.qualified===true

  const trustScoreRaw=
    trust?.score ??
    trust?.trustScore ??
    null

  const trustScore=
    trustScoreRaw===null ||
    trustScoreRaw===undefined ||
    trustScoreRaw===''
      ? null
      : Number(trustScoreRaw)

  const trustStatus=
    String(
      trust?.status ??
      trust?.label ??
      ''
    ).trim()

  const trustCompletedRaw=
    trust?.completedBookings ??
    trust?.completed ??
    trust?.completedVisits ??
    null

  const trustCompleted=
    trustCompletedRaw===null ||
    trustCompletedRaw===undefined ||
    trustCompletedRaw===''
      ? 0
      : Number(trustCompletedRaw)


  const completedNeeded=
    Math.max(
      0,
      0
    )

  const reviewsNeeded=
    Math.max(
      0,
      3-platformReviewCount
    )


  const displayRating=
    platformRating>0
      ? platformRating.toFixed(1)
      : '—'


  return (
    <section className="professional-reputation">

      <header className="reputation-hero">

        <div className="reputation-hero-copy">

          <span className="reputation-eyebrow">
            MELEO REPUTATION
          </span>

          <h2>
            Η επαγγελματική σου φήμη,
            σε ένα σημείο.
          </h2>

          <p>
            Παρακολούθησε τις πραγματικές
            αξιολογήσεις από ολοκληρωμένες
            επισκέψεις και την πρόοδό σου
            προς ισχυρότερη αξιοπιστία
            μέσα στο MELEO.
          </p>

        </div>


        <div className="reputation-score-card">

          <span>
            Συνολική βαθμολογία
          </span>

          <div className="reputation-score-number">
            {displayRating}
          </div>

          {platformRating>0
            ?
            <Stars
              rating={platformRating}
            />
            :
            <span className="reputation-new">
              Νέο προφίλ
            </span>
          }

          <small>
            {platformReviewCount}
            {' '}
            {platformReviewCount===1
              ? 'αξιολόγηση'
              : 'αξιολογήσεις'
            }
          </small>

        </div>

      </header>


      <div className="reputation-metrics">

        <article>
          <span className="reputation-metric-icon">
            ★
          </span>

          <strong>
            {displayRating}
          </strong>

          <b>
            Βαθμολογία
          </b>

          <small>
            δημόσια εικόνα προφίλ
          </small>
        </article>


        <article>
          <span className="reputation-metric-icon">
            ✓
          </span>

          <strong>
            {completedBookings.length}
          </strong>

          <b>
            Ολοκληρωμένες
          </b>

          <small>
            πραγματικές επισκέψεις
          </small>
        </article>


        <article>
          <span className="reputation-metric-icon">
            ✦
          </span>

          <strong>
            {platformReviewCount}
          </strong>

          <b>
            Αξιολογήσεις
          </b>

          <small>
            στο επαγγελματικό προφίλ
          </small>
        </article>


        <article>
          <span className="reputation-metric-icon">
            ◎
          </span>

          <strong>
            {reviewCoverage}%
          </strong>

          <b>
            Review coverage
          </b>

          <small>
            στις φορτωμένες ολοκληρωμένες
          </small>
        </article>

      </div>


      <div className="reputation-layout">

        <main className="reputation-main">

          <div className="reputation-section-head">

            <div>
              <span>
                ΑΞΙΟΛΟΓΗΣΕΙΣ
              </span>

              <h3>
                Τι λένε οι ασθενείς
              </h3>
            </div>


            <div
              className="reputation-filters"
              role="group"
              aria-label="Φίλτρα αξιολογήσεων"
            >

              {[
                ['all','Όλες'],
                ['5','5 ★'],
                ['4','4 ★'],
                ['3','3 ★']
              ].map(([value,label])=>
                <button
                  key={value}
                  type="button"
                  className={
                    filter===value
                      ? 'active'
                      : ''
                  }
                  onClick={()=>
                    setFilter(
                      value as
                      'all'|'5'|'4'|'3'
                    )
                  }
                >
                  {label}
                </button>
              )}

            </div>

          </div>


          {visibleReviews.length>0
            ?
            <div className="reputation-review-list">

              {visibleReviews.map(review=>

                <article
                  className="reputation-review-card"
                  key={review.id}
                >

                  <div className="reputation-review-top">

                    <div className="reputation-review-author">

                      <span className="reputation-avatar">
                        {initials(
                          review.patientName
                        )}
                      </span>

                      <div>
                        <strong>
                          {review.patientName}
                        </strong>

                        <small>
                          Επιβεβαιωμένη ολοκληρωμένη
                          επίσκεψη
                        </small>
                      </div>

                    </div>


                    <div className="reputation-review-rating">

                      <Stars
                        rating={review.rating}
                        compact
                      />

                      <b>
                        {review.rating.toFixed(1)}
                      </b>

                    </div>

                  </div>


                  {review.text
                    ?
                    <p className="reputation-review-text">
                      “{review.text}”
                    </p>
                    :
                    <p className="reputation-review-text muted">
                      Ο ασθενής άφησε βαθμολογία
                      χωρίς γραπτό σχόλιο.
                    </p>
                  }


                  <footer>

                    <span>
                      {review.service}
                    </span>

                    <span>
                      {formatDate(
                        review.createdAt ||
                        review.date
                      )}
                    </span>

                  </footer>

                </article>

              )}

            </div>
            :
            <div className="reputation-empty">

              <span>
                ☆
              </span>

              <h3>
                {reviews.length===0
                  ? 'Δεν υπάρχουν ακόμη αξιολογήσεις'
                  : 'Δεν υπάρχουν αξιολογήσεις σε αυτό το φίλτρο'
                }
              </h3>

              <p>
                {reviews.length===0
                  ? 'Οι αξιολογήσεις εμφανίζονται μετά από ολοκληρωμένες επισκέψεις και βοηθούν τους επόμενους ασθενείς να επιλέξουν με μεγαλύτερη εμπιστοσύνη.'
                  : 'Δοκίμασε διαφορετικό φίλτρο για να δεις τις υπόλοιπες αξιολογήσεις.'
                }
              </p>

            </div>
          }

        </main>


        <aside className="reputation-side">

          <div className="reputation-side-card">

            <span className="reputation-side-eyebrow">
              TRUST PROGRESS
            </span>

            <h3>
              Αξιοπιστία MELEO
            </h3>


            {trustEligible
              ?
              <div className="reputation-trust-ready">

                <span>
                  ✓
                </span>

                <div>
                  <strong>
                    Trust eligibility ενεργή
                  </strong>

                  <p>
                    Έχεις καλύψει το βασικό
                    ιστορικό ολοκληρωμένων
                    επισκέψεων και αξιολογήσεων.
                  </p>
                </div>

              </div>
              :
              <>
                <p className="reputation-side-copy">
                  Το Trust Score ενεργοποιείται
                  όταν υπάρχει επαρκές πραγματικό
                  ιστορικό δραστηριότητας.
                </p>

                <div className="reputation-progress-row">

                  <div>
                    <span>
                      Ολοκληρωμένες επισκέψεις
                    </span>

                    <b>
                      {trustCompleted}
                    </b>
                  </div>

                  <progress
                    max="5"
                    value={
                      Math.min(
                        trustCompleted,
                        5
                      )
                    }
                  />

                </div>


                <div className="reputation-progress-row">

                  <div>
                    <span>
                      Αξιολογήσεις
                    </span>

                    <b>
                      {Math.min(platformReviewCount,3)} / 3
                    </b>
                  </div>

                  <progress
                    max="3"
                    value={
                      Math.min(
                        platformReviewCount,
                        3
                      )
                    }
                  />

                </div>


                <small className="reputation-progress-note">

                  {completedNeeded>0
                    ? `Χρειάζονται ακόμη ${completedNeeded} ολοκληρωμένες επισκέψεις. `
                    : ''
                  }

                  {reviewsNeeded>0
                    ? `Χρειάζονται ακόμη ${reviewsNeeded} αξιολογήσεις.`
                    : ''
                  }

                </small>
              </>
            }

          </div>


          <div className="reputation-side-card">

            <span className="reputation-side-eyebrow">
              REVIEW DISTRIBUTION
            </span>

            <h3>
              Κατανομή βαθμολογιών
            </h3>


            {[5,4,3,2,1].map(star=>{

              const count=
                distribution[star]||0

              const percentage=
                reviews.length>0
                  ? Math.round(
                      count /
                      reviews.length *
                      100
                    )
                  : 0

              return (
                <div
                  className="reputation-distribution"
                  key={star}
                >

                  <span>
                    {star} ★
                  </span>

                  <div>
                    <i
                      style={{
                        width:`${percentage}%`
                      }}
                    />
                  </div>

                  <b>
                    {count}
                  </b>

                </div>
              )
            })}


            {reviews.length===0 &&
              <small className="reputation-distribution-note">
                Η κατανομή θα εμφανιστεί όταν
                υπάρχουν διαθέσιμες αξιολογήσεις
                στις φορτωμένες κρατήσεις.
              </small>
            }

          </div>


          <div className="reputation-side-card reputation-guidance">

            <span className="reputation-side-eyebrow">
              REPUTATION SIGNALS
            </span>

            <h3>
              Τι ενισχύει την εικόνα σου
            </h3>

            <ul>
              <li>
                Ολοκλήρωση πραγματικών επισκέψεων
              </li>

              <li>
                Σταθερή ανταπόκριση στα αιτήματα
              </li>

              <li>
                Θετικές αξιολογήσεις ασθενών
              </li>

              <li>
                Επαληθευμένο επαγγελματικό προφίλ
              </li>
            </ul>


            {setTab &&
              <button
                type="button"
                className="reputation-profile-button"
                onClick={()=>
                  setTab('profile')
                }
              >
                Βελτίωσε το προφίλ σου
              </button>
            }

          </div>

        </aside>

      </div>

    </section>
  )
}