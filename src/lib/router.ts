export const VIEW_PATH:Record<string,string>={
  home:'/',search:'/search',smart:'/smart-request',now:'/now',auth:'/login',
  'patient-dashboard':'/dashboard','pro-dashboard':'/professional/dashboard',
  admin:'/admin','admin-login':'/admin/login','become-pro':'/professionals/join',
  pricing:'/pricing',notifications:'/notifications',help:'/help',account:'/account',
  terms:'/terms',privacy:'/privacy',cookies:'/cookies'
}
export function viewFromPath(path:string){
  if(/^\/professionals\/[^/]+$/.test(path))return 'profile'
  if(/^\/care\/[^/]+\/[^/]+$/.test(path))return 'search'
  return Object.entries(VIEW_PATH).find(([,p])=>p===path)?.[0]||'home'
}
export function pathForView(view:string,selectedId?:string|null){
  if(view==='profile'&&selectedId)return `/professionals/${encodeURIComponent(selectedId)}`
  return VIEW_PATH[view]||'/'
}
export function pushView(view:string,selectedId?:string|null,replace=false){
  const path=pathForView(view,selectedId)
  if(window.location.pathname===path)return
  history[replace?'replaceState':'pushState']({view},'',path)
}
