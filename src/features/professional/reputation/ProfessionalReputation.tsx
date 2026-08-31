import React, {
  useMemo,
  useState
} from 'react'

import type {
  Booking
} from '../../../domain/types'

import {useTranslation} from 'react-i18next'

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


function formatDate(
  value:string,
  locale='el-GR'
){
  if(!value){
    return ''
  }

  const parsed=new Date(value)

  if(Number.isNaN(parsed.getTime())){
    return value
  }

  return parsed.toLocaleDateString(
    locale,
    {
      day:'2-digit',
      month:'short',
      year:'numeric'
    }
  )
}


function Stars({
  rating,
  compact=false,
  ariaLabel
}:{
  rating:number
  compact?:boolean
  ariaLabel:string
}){
  return (
    <span
      className={
        compact
          ? 'reputation-stars compact'
          : 'reputation-stars'
      }
      aria-label={ariaLabel}
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

  const {t,i18n}=useTranslation()

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
                t('proReputation.review.patientFallback')
              ),

            service:
              String(
                booking.service ||
                t('proReputation.review.visitFallback')
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

    },[completedBookings,t])


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
            {t('proReputation.hero.title')}
          </h2>

          <p>
            {t('proReputation.hero.text')}
          </p>

        </div>


        <div className="reputation-score-card">

          <span>
            {t('proReputation.hero.totalScore')}
          </span>

          <div className="reputation-score-number">
            {displayRating}
          </div>

          {platformRating>0
            ?
            <Stars
              rating={platformRating}
              ariaLabel={t(
                'proReputation.starsAria',
                {rating:platformRating}
              )}
            />
            :
            <span className="reputation-new">
              {t('proReputation.hero.newProfile')}
            </span>
          }

          <small>
            {platformReviewCount}
            {' '}
            {platformReviewCount===1
              ? t('proReputation.hero.reviewSingular')
              : t('proReputation.hero.reviewPlural')
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
            {t('proReputation.metrics.rating')}
          </b>

          <small>
            {t('proReputation.metrics.publicProfile')}
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
            {t('proReputation.metrics.completed')}
          </b>

          <small>
            {t('proReputation.metrics.realVisits')}
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
            {t('proReputation.metrics.reviews')}
          </b>

          <small>
            {t('proReputation.metrics.profileReviews')}
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
            {t('proReputation.metrics.loadedCompleted')}
          </small>
        </article>

      </div>


      <div className="reputation-layout">

        <main className="reputation-main">

          <div className="reputation-section-head">

            <div>
              <span>
                {t('proReputation.reviews.eyebrow')}
              </span>

              <h3>
                {t('proReputation.reviews.title')}
              </h3>
            </div>


            <div
              className="reputation-filters"
              role="group"
              aria-label={t('proReputation.reviews.filtersAria')}
            >

              {[
                ['all',t('proReputation.reviews.all')],
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
                          {t('proReputation.review.verifiedVisit')}
                        </small>
                      </div>

                    </div>


                    <div className="reputation-review-rating">

                      <Stars
                        rating={review.rating}
                        compact
                        ariaLabel={t(
                          'proReputation.starsAria',
                          {rating:review.rating}
                        )}
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
                      {t('proReputation.review.noComment')}
                    </p>
                  }


                  <footer>

                    <span>
                      {review.service}
                    </span>

                    <span>
                      {formatDate(
                        review.createdAt ||
                        review.date,
                        i18n.resolvedLanguage==='en'
                          ? 'en-GB'
                          : 'el-GR'
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
                  ? t('proReputation.empty.noneTitle')
                  : t('proReputation.empty.filterTitle')
                }
              </h3>

              <p>
                {reviews.length===0
                  ? t('proReputation.empty.noneText')
                  : t('proReputation.empty.filterText')
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
              {t('proReputation.trust.title')}
            </h3>


            {trustEligible
              ?
              <div className="reputation-trust-ready">

                <span>
                  ✓
                </span>

                <div>
                  <strong>
                    {t('proReputation.trust.eligibleTitle')}
                  </strong>

                  <p>
                    {t('proReputation.trust.eligibleText')}
                  </p>
                </div>

              </div>
              :
              <>
                <p className="reputation-side-copy">
                  {t('proReputation.trust.inactiveText')}
                </p>

                <div className="reputation-progress-row">

                  <div>
                    <span>
                      {t('proReputation.trust.completedVisits')}
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
                      {t('proReputation.trust.reviews')}
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
                    ? t(
                        'proReputation.trust.completedNeeded',
                        {count:completedNeeded}
                      )+' '
                    : ''
                  }

                  {reviewsNeeded>0
                    ? t(
                        'proReputation.trust.reviewsNeeded',
                        {count:reviewsNeeded}
                      )
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
              {t('proReputation.distribution.title')}
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
                {t('proReputation.distribution.empty')}
              </small>
            }

          </div>


          <div className="reputation-side-card reputation-guidance">

            <span className="reputation-side-eyebrow">
              REPUTATION SIGNALS
            </span>

            <h3>
              {t('proReputation.guidance.title')}
            </h3>

            <ul>
              <li>
                {t('proReputation.guidance.completedVisits')}
              </li>

              <li>
                {t('proReputation.guidance.steadyResponse')}
              </li>

              <li>
                {t('proReputation.guidance.positiveReviews')}
              </li>

              <li>
                {t('proReputation.guidance.verifiedProfile')}
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
                {t('proReputation.guidance.improveProfile')}
              </button>
            }

          </div>

        </aside>

      </div>

    </section>
  )
}