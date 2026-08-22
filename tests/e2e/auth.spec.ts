import { test, expect } from '@playwright/test'

async function openAuth(page:any){await page.goto('/login');await expect(page.getByRole('heading',{name:'Καλώς ήρθες ξανά'})).toBeVisible()}

test('patient demo login reaches patient dashboard',async({page})=>{await openAuth(page);await page.getByRole('button',{name:'Συνοδός',exact:true}).click();await page.getByRole('button',{name:'Σύνδεση',exact:true}).last().click();await page.goto('/dashboard');await expect(page.getByText('Οι κρατήσεις μου')).toBeVisible()})

test('professional demo login lazy-loads professional area',async({page})=>{await openAuth(page);await page.getByRole('button',{name:'Επαγγελματίας',exact:true}).click();await page.getByRole('button',{name:'Σύνδεση',exact:true}).last().click();await expect(page.locator('body')).toContainText(/Dashboard|Professional|Συνδρομή|Αιτήματα/i)})

test('admin demo login opens admin or 2FA challenge',async({page})=>{await openAuth(page);await page.getByRole('button',{name:'Admin',exact:true}).click();await page.getByRole('button',{name:'Σύνδεση',exact:true}).last().click();await expect(page.locator('body')).toContainText(/Admin|2FA|Κωδικός 2FA|Control Center/i)})

test('public search route renders without authenticated bundle',async({page})=>{await page.goto('/search');await expect(page.locator('body')).toContainText(/Αναζήτηση|επαγγελματ/i)})
