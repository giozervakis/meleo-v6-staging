export function createProfessionalTrustService({
  one
}){
  if(typeof one!=='function'){
    throw new Error(
      'professional trust service requires one'
    )
  }

  async function meleoTrustForProfessional(professionalId){
    const p=await one(`SELECT id,verified,rating,reviews_count "reviewsCount" FROM professionals WHERE id=$1`,[professionalId])
    if(!p)return null
    const stats=await one(`
      SELECT
        count(*)::int total,
        count(*) FILTER (WHERE status='completed')::int completed,
        count(*) FILTER (WHERE status='cancelled')::int cancelled,
        count(*) FILTER (WHERE status<>'pending')::int progressed,
        count(*) FILTER (WHERE status='completed' AND created_at>=now()-interval '90 days')::int recent_completed
      FROM bookings WHERE professional_id=$1
    `,[professionalId])
    const total=Number(stats?.total||0),completed=Number(stats?.completed||0),cancelled=Number(stats?.cancelled||0)
    const reviews=Number(p.reviewsCount||0),rating=Number(p.rating||0)
    const closed=completed+cancelled
    const completionRate=closed?Math.round((completed/closed)*100):100
    const responseRate=total?Math.round((Number(stats?.progressed||0)/total)*100):100
    const cancellationReliability=closed?Math.round((completed/closed)*100):100
    const eligible=completed>=5&&reviews>=3
    if(!eligible)return {eligible:false,label:'MELEO Verified · Νέος επαγγελματίας',completed,reviews,minCompleted:5,minReviews:3}
    const verificationPoints=p.verified?20:0
    const reviewPoints=Math.round(Math.max(0,Math.min(25,(rating/5)*25)))
    const completionPoints=Math.round(Math.max(0,Math.min(20,(completionRate/100)*20)))
    const responsePoints=Math.round(Math.max(0,Math.min(15,(responseRate/100)*15)))
    const reliabilityPoints=Math.round(Math.max(0,Math.min(10,(cancellationReliability/100)*10)))
    const recent=Number(stats?.recent_completed||0)
    const activityPoints=recent>=8?10:recent>=5?8:recent>=2?6:4
    const score=Math.max(0,Math.min(100,verificationPoints+reviewPoints+completionPoints+responsePoints+reliabilityPoints+activityPoints))
    const label=score>=90?'Εξαιρετική αξιοπιστία':score>=80?'Πολύ υψηλή αξιοπιστία':score>=70?'Υψηλή αξιοπιστία':score>=60?'Καλή αξιοπιστία':'Αναπτυσσόμενη αξιοπιστία'
    return {eligible:true,score,label,completed,reviews,rating:Number(rating.toFixed(1)),completionRate,responseRate,breakdown:{verification:verificationPoints,reviews:reviewPoints,completion:completionPoints,response:responsePoints,reliability:reliabilityPoints,activity:activityPoints}}
  }

  return Object.freeze({
    meleoTrustForProfessional
  })
}
