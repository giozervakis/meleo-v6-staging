const safeCode=value=>{
  const code=String(value||'').trim()
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(code)?code:''
}

const safeErrorName=value=>{
  const name=String(value||'Error').trim()
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(name)?name:'Error'
}

export function createHttpErrorHandler({log,observeError}){
  if(!log?.error||!log?.warn)throw new Error('createHttpErrorHandler requires structured logger')
  if(typeof observeError!=='function')throw new Error('createHttpErrorHandler requires observeError')

  return (err,req,res,next)=>{
    const requestId=req?.requestId
    const method=String(req?.method||'UNKNOWN').toUpperCase()
    const path=String(req?.path||'').slice(0,256)

    if(res.headersSent){
      observeError('http','headers_sent')
      log.error('http.error_after_headers',{
        requestId,
        method,
        path,
        errorName:safeErrorName(err?.name),
        errorCode:safeCode(err?.code)
      })
      return next(err)
    }

    if(err?.type==='entity.too.large'){
      observeError('http','payload_too_large')
      log.warn('http.payload_too_large',{requestId,path,method})
      return res.status(413).json({error:'Το αρχείο είναι πολύ μεγάλο.'})
    }

    const candidate=Number(err?.statusCode||err?.status)
    const statusCode=Number.isInteger(candidate)&&candidate>=400&&candidate<=599?candidate:500
    const kind=statusCode>=500?'unhandled':'request_error'
    observeError('http',kind)

    const meta={
      requestId,
      method,
      path,
      statusCode,
      errorName:safeErrorName(err?.name),
      errorCode:safeCode(err?.code)
    }

    if(statusCode>=500)log.error('http.unhandled_error',meta)
    else log.warn('http.request_error',meta)

    return res.status(statusCode).json({
      error:statusCode>=500?'Εσωτερικό σφάλμα. Δοκίμασε ξανά.':'Μη έγκυρο αίτημα.'
    })
  }
}
