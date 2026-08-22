import fs from 'node:fs'
const app=fs.readFileSync(new URL('../src/App.tsx', import.meta.url),'utf8')
const required=[
  "lazy(() => import('./features/admin/AdminPage'))",
  "lazy(() => import('./features/professional/ProfessionalDashboard'))",
  "import('./features/support/SupportPages')",
  "import('./Account')",
  '<Suspense fallback={<RouteFallback/>}>'
]
const missing=required.filter(x=>!app.includes(x))
if(missing.length){console.error('MELEO v5.4 frontend architecture check: FAIL',missing);process.exit(1)}
const size=Buffer.byteLength(app)
if(size>100*1024){console.error(`MELEO v5.4 frontend architecture check: FAIL App.tsx=${size} bytes`);process.exit(1)}
console.log(`MELEO v5.4 frontend architecture check: OK · App.tsx ${(size/1024).toFixed(1)} KB`)
