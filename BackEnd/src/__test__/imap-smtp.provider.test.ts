import { describe, expect, it } from 'vitest'
import { extractMessageBody } from '../services/integrations/mail/providers/imap-smtp.provider'

describe('imap-smtp.provider extractMessageBody', () => {
  it('interpreta email multipart com text/plain e text/html', () => {
    const raw = Buffer.from(
      [
        'Content-Type: multipart/alternative; boundary="abc123"',
        '',
        '--abc123',
        'Content-Type: text/plain; charset="utf-8"',
        '',
        'Ola do texto puro.',
        '--abc123',
        'Content-Type: text/html; charset="utf-8"',
        '',
        '<html><body><p>Ola do <strong>HTML</strong>.</p></body></html>',
        '--abc123--',
      ].join('\r\n'),
      'utf8'
    )

    const parsed = extractMessageBody(raw)

    expect(parsed.text).toContain('Ola do texto puro.')
    expect(parsed.html).toContain('<strong>HTML</strong>')
    expect(parsed.preview).toContain('Ola do texto puro.')
  })

  it('decodifica corpo quoted-printable', () => {
    const raw = Buffer.from(
      [
        'Content-Type: text/plain; charset="utf-8"',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        'Ol=E1, integra=E7=E3o de email!',
      ].join('\r\n'),
      'utf8'
    )

    const parsed = extractMessageBody(raw)

    expect(parsed.text).toContain('Olá, integração de email!')
  })

  it('decodifica corpo base64 em html', () => {
    const html = '<html><body><p>Mensagem <strong>HTML</strong></p></body></html>'
    const raw = Buffer.from(
      [
        'Content-Type: text/html; charset="utf-8"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(html, 'utf8').toString('base64'),
      ].join('\r\n'),
      'utf8'
    )

    const parsed = extractMessageBody(raw)

    expect(parsed.html).toContain('<strong>HTML</strong>')
    expect(parsed.text).toContain('Mensagem HTML')
  })
})
