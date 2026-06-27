import { describe, expect, it } from 'vitest'
import { sanitizeBookHtml } from './useHtmlSanitizer.js'

describe('sanitizeBookHtml', () => {
  it('removes executable tags, event handlers, and javascript URLs from book HTML', () => {
    const html = sanitizeBookHtml(`
      <section onclick="alert(1)">
        <script>alert('xss')</script>
        <iframe src="https://example.com/embed"></iframe>
        <form action="/steal"><input name="secret"></form>
        <a href="java
          script:alert(1)">bad link</a>
        <img src="javascript:alert(1)" onerror="alert(2)">
        <p data-note="keep">Safe text</p>
      </section>
    `)

    expect(html).toContain('Safe text')
    expect(html).toContain('data-note="keep"')
    expect(html).not.toMatch(/<script|<iframe|<form|onclick|onerror|javascript:/i)
  })
})
