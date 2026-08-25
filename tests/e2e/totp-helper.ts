import crypto from 'node:crypto'

function base32Decode(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

  const clean = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '')

  let bits = ''

  for (const c of clean) {
    const value = alphabet.indexOf(c)

    if (value >= 0) {
      bits += value
        .toString(2)
        .padStart(5, '0')
    }
  }

  const output: number[] = []

  for (
    let i = 0;
    i + 8 <= bits.length;
    i += 8
  ) {
    output.push(
      parseInt(bits.slice(i, i + 8), 2)
    )
  }

  return Buffer.from(output)
}

export function generateTotp(
  secret: string,
  timestamp = Date.now()
) {
  const key = base32Decode(secret)

  if (!key.length) {
    throw new Error(
      'Invalid E2E_ADMIN_TOTP_SECRET'
    )
  }

  const step =
    Math.floor(timestamp / 30_000)

  const buffer = Buffer.alloc(8)

  buffer.writeBigUInt64BE(
    BigInt(step)
  )

  const hash =
    crypto
      .createHmac('sha1', key)
      .update(buffer)
      .digest()

  const offset =
    hash[hash.length - 1] & 0x0f

  const code =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3]

  return String(
    code % 1_000_000
  ).padStart(6, '0')
}