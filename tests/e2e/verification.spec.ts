import { test, expect, APIRequestContext } from '@playwright/test'

const API = process.env.E2E_API_URL || 'http://localhost:8787'

const ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL || 'admin@meleo.gr'

const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD || 'admin123'

const PROFESSIONAL_EMAIL =
  process.env.E2E_PROFESSIONAL_EMAIL || 'maria@meleo.gr'

const PROFESSIONAL_PASSWORD =
  process.env.E2E_PROFESSIONAL_PASSWORD || 'demo123'

async function login(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const response = await request.post(`${API}/api/auth/login`, {
    data: {
      email,
      password,
    },
  })

  expect(
    response.ok(),
    `Login failed for ${email}: ${await response.text()}`
  ).toBeTruthy()

  return response
}

test.describe('MELEO Professional Verification', () => {
  test('professional submits verification and admin approves it', async ({
    request,
  }) => {
    //
    // ------------------------------------------------------------
    // 1. PROFESSIONAL LOGIN
    // ------------------------------------------------------------
    //

    await login(
      request,
      PROFESSIONAL_EMAIL,
      PROFESSIONAL_PASSWORD
    )

    //
    // ------------------------------------------------------------
    // 2. COMPLETE PROFESSIONAL PROFILE
    // ------------------------------------------------------------
    //

    const profileResponse = await request.put(
  `${API}/api/professional/profile`,
  {
    data: {
      specialty: 'Νοσηλευτική',
      title: 'Νοσηλευτής κατ’ οίκον',
      city: 'Ηράκλειο',
    },
  }
)

    expect(
      profileResponse.ok(),
      `Profile update failed: ${await profileResponse.text()}`
    ).toBeTruthy()

    //
    // ------------------------------------------------------------
    // 3. UPLOAD TEST VERIFICATION DOCUMENT
    // ------------------------------------------------------------
    //
    // Minimal valid PDF.
    //

    const pdf = Buffer.from(
      '%PDF-1.4\n' +
        '1 0 obj\n' +
        '<< /Type /Catalog >>\n' +
        'endobj\n' +
        'trailer\n' +
        '<< /Root 1 0 R >>\n' +
        '%%EOF'
    )

const documentResponse = await request.post(
  `${API}/api/professional/verification-document`,
  {
    data: {
      name: 'e2e-verification.pdf',
      type: 'license',
      mime: 'application/pdf',
      dataBase64: pdf.toString('base64'),
    },
  }
)

    expect(
      documentResponse.ok(),
      `Document upload failed: ${await documentResponse.text()}`
    ).toBeTruthy()

    const documentBody = await documentResponse.json()

    expect(documentBody.id).toBeTruthy()
	expect(documentBody.mime).toBe('application/pdf')
	expect(documentBody.status).toBe('submitted')

    //
    // ------------------------------------------------------------
    // 4. SUBMIT VERIFICATION REQUEST
    // ------------------------------------------------------------
    //

    const verificationResponse = await request.post(
      `${API}/api/professional/verification`,
      {
        data: {
          licenseNumber: `E2E-${Date.now()}`,
          notes: 'Playwright E2E verification test',
        },
      }
    )

    expect(
      verificationResponse.ok(),
      `Verification submit failed: ${await verificationResponse.text()}`
    ).toBeTruthy()

    const verificationBody =
  await verificationResponse.json()

console.log(
  'VERIFICATION SUBMIT RESULT:',
  JSON.stringify(verificationBody, null, 2)
)

expect(verificationBody.id).toBeTruthy()
expect(verificationBody.status).toBe('pending')
expect(verificationBody.licenseNumber).toBeTruthy()

const verificationId =
  verificationBody.id

    //
    // ------------------------------------------------------------
    // 5. ADMIN LOGIN
    // ------------------------------------------------------------
    //

    await login(
      request,
      ADMIN_EMAIL,
      ADMIN_PASSWORD
    )

    //
    // ------------------------------------------------------------
    // 6. ADMIN FINDS VERIFICATION
    // ------------------------------------------------------------
    //

    const adminListResponse = await request.get(
      `${API}/api/admin/verifications`
    )

    expect(
      adminListResponse.ok(),
      `Admin verification list failed: ${await adminListResponse.text()}`
    ).toBeTruthy()

    const verificationList =
      await adminListResponse.json()

    const pendingRequest = verificationList.find(
      (item: any) =>
        item.id === verificationId
    )

    expect(pendingRequest).toBeTruthy()
    expect(pendingRequest.status).toBe('pending')

    //
    // ------------------------------------------------------------
    // 7. ADMIN APPROVES
    // ------------------------------------------------------------
    //

    const approvalResponse = await request.patch(
      `${API}/api/admin/verifications/${verificationId}`,
      {
        data: {
          status: 'approved',
          adminNote:
            'Approved automatically by Playwright E2E test',
        },
      }
    )

    expect(
      approvalResponse.ok(),
      `Approval failed: ${await approvalResponse.text()}`
    ).toBeTruthy()

    const approvalBody =
      await approvalResponse.json()

    expect(approvalBody.status).toBe('approved')

    //
    // ------------------------------------------------------------
    // 8. VERIFY ADMIN MEMBER STATE
    // ------------------------------------------------------------
    //

    const membersResponse = await request.get(
      `${API}/api/admin/members`
    )

    expect(
      membersResponse.ok(),
      `Admin members failed: ${await membersResponse.text()}`
    ).toBeTruthy()

    const members = await membersResponse.json()

    const professional = members.find(
      (member: any) =>
        member.email?.toLowerCase() ===
        PROFESSIONAL_EMAIL.toLowerCase()
    )

    expect(professional).toBeTruthy()

    expect(professional.verified).toBe(true)

    expect(professional.lifecycleStatus).toBe(
      'approved'
    )

    expect(professional.onboardingStage).toBe(
      'approved'
    )

    expect(professional.verificationStatus).toBe(
      'approved'
    )
  })
})