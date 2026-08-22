import { spawn } from 'node:child_process'

const children=[]
let stopping=false

function start(label,args){
  const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,INSTANCE_ID:process.env.INSTANCE_ID||`render-staging-${label}`}})
  children.push(child)
  child.on('exit',(code,signal)=>{
    if(stopping)return
    console.error(`[MELEO Render staging] ${label} exited`,{code,signal})
    shutdown(code ?? 1)
  })
  return child
}

function shutdown(code=0){
  if(stopping)return
  stopping=true
  for(const c of children){try{c.kill('SIGTERM')}catch{}}
  setTimeout(()=>process.exit(code),1500).unref()
}

process.on('SIGTERM',()=>shutdown(0))
process.on('SIGINT',()=>shutdown(0))

console.log('[MELEO Render staging] starting API + background worker in one free Web Service')
start('api',['server/index.js'])
// Give API/migrations a short head start before the worker opens its own pool.
setTimeout(()=>{if(!stopping)start('worker',['server/worker.js'])},5000)
