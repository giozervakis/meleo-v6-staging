export function createSmartMatchingService({
  one,
  meleoTrustForProfessional
}) {
  if (typeof one !== 'function') {
    throw new TypeError('createSmartMatchingService requires one')
  }

  if (typeof meleoTrustForProfessional !== 'function') {
    throw new TypeError('createSmartMatchingService requires meleoTrustForProfessional')
  }

  async function smartMatchDiagnosticsForProfessional(professionalId,trust=null){
    const p=await one(`
      SELECT
        id,
        verified,
        featured,
        rating,
        reviews_count,
        available,
        response_time,
        years,
        subscription_plan,
        subscription_status
      FROM professionals
      WHERE id=$1
    `,[professionalId])

    if(!p)return null

    if(!trust){
      trust=await meleoTrustForProfessional(professionalId)
    }

    const reviews=Number(p.reviews_count||0)
    const rating=Number(p.rating||0)
    const years=Number(p.years||0)

    const available=
      String(p.available||'').toLowerCase()

    const responseTime=
      String(p.response_time||'').toLowerCase()

    const verifiedPoints=
      p.verified ? 6 : 0

    const trustPoints=
      trust?.eligible
        ? Math.max(
            0,
            Math.min(
              28,
              (Number(trust.score||0)/100)*28
            )
          )
        : 18

    const ratingPoints=
      reviews===0
        ? 7
        : Math.max(
            0,
            Math.min(
              14,
              (rating/5)*14
            )
          )

    const reviewConfidencePoints=
      reviews>=20 ? 5 :
      reviews>=10 ? 4 :
      reviews>=5 ? 3 :
      reviews>=1 ? 2 : 1

    const availabilityPoints=
      available.includes('σήμερα') ||
      available.includes('άμεσα')
        ? 8
        : available.includes('διαθέσ')
          ? 6
          : 3

    const responsePoints=
      responseTime.includes('λεπτ')
        ? 6
        : (
            responseTime.includes('ώρα') ||
            responseTime.includes('ωρ')
          )
          ? 5
          : responseTime
            ? 4
            : 2

    const experiencePoints=
      years>=10 ? 3 :
      years>=5 ? 2 :
      years>0 ? 1 : 0

    const premiumPoints=
      p.subscription_plan==='premium' &&
      p.subscription_status==='active'
        ? 8
        : 0

    const featuredPoints=
      p.featured ? 2 : 0

    /*
     * Distance intentionally excluded here.
     *
     * Distance is request-dependent:
     * the same professional receives a different distance
     * contribution for each patient's search location.
     */
    const profileScore=
      verifiedPoints+
      trustPoints+
      ratingPoints+
      reviewConfidencePoints+
      availabilityPoints+
      responsePoints+
      experiencePoints+
      premiumPoints+
      featuredPoints

    return {
      version:'1.1',

      profileScore:Number(
        profileScore.toFixed(1)
      ),

      profileMax:80,

      distance:{
        dynamic:true,
        maxPoints:20,
        note:
          'Η απόσταση υπολογίζεται ξεχωριστά για κάθε αναζήτηση χρήστη.'
      },

      factors:{
        verified:{
          points:verifiedPoints,
          max:6,
          active:!!p.verified
        },

        trust:{
          points:Number(trustPoints.toFixed(1)),
          max:28,
          eligible:!!trust?.eligible,
          score:trust?.eligible
            ? Number(trust.score||0)
            : null,
          fallback:!trust?.eligible
        },

        rating:{
          points:Number(ratingPoints.toFixed(1)),
          max:14,
          rating:Number(rating.toFixed(1)),
          reviews
        },

        reviewConfidence:{
          points:reviewConfidencePoints,
          max:5,
          reviews
        },

        availability:{
          points:availabilityPoints,
          max:8,
          value:p.available||''
        },

        response:{
          points:responsePoints,
          max:6,
          value:p.response_time||''
        },

        experience:{
          points:experiencePoints,
          max:3,
          years
        },

        premium:{
          points:premiumPoints,
          max:8,
          active:premiumPoints===8
        },

        featured:{
          points:featuredPoints,
          max:2,
          active:!!p.featured
        }
      }
    }
  }

  return Object.freeze({
    smartMatchDiagnosticsForProfessional
  })
}
