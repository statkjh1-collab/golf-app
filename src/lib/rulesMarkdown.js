import { Marked } from 'marked'
import DOMPurify from 'dompurify'

// 회칙 마크다운 → 화면용 구조
//
// 조항 단위(접기·펼치기·검색 단위)는 문서에 있는 가장 깊은 제목 단계(### 우선, 없으면 ##)다.
// 그보다 높은 제목(제1부, 제1장 등)은 묶음 제목으로 보여준다.
//
// 조항 바로가기 주소(앵커):
//   - 제목 끝에 {#rule-2-2} 처럼 직접 적으면 그 값을 쓴다
//   - 없으면 "제18조 ..." → art-18, "2-2. ..." → rule-2-2, "1. ..." → rule-1
//   - 그 외에는 sec-순번

const ANCHOR_RE = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/

const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    heading(token) {
      const inner = this.parser.parseInline(token.tokens)
      const id = token.anchorId ? ` id="${token.anchorId}"` : ''
      return `<h${token.depth}${id}>${inner}</h${token.depth}>\n`
    },
  },
})

function autoAnchor(text) {
  const art = text.match(/^제\s*(\d+)\s*조/)
  if (art) return `art-${art[1]}`
  const rule = text.match(/^(\d+(?:-\d+)*)\.\s/)
  if (rule) return `rule-${rule[1]}`
  return null
}

function sanitize(html) {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}

function plain(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

export function parseRules(source) {
  const tokens = md.lexer(source || '')
  const used = new Set()
  let seq = 0

  // 제목마다 앵커를 정하고 {#...} 표시를 제목에서 지운다
  for (const t of tokens) {
    if (t.type !== 'heading') continue
    let text = t.text
    let id = null
    const m = text.match(ANCHOR_RE)
    if (m) { id = m[1]; text = text.replace(ANCHOR_RE, '') }
    id = id || autoAnchor(text) || `sec-${++seq}`
    let unique = id
    let n = 2
    while (used.has(unique)) unique = `${id}-${n++}`
    used.add(unique)
    t.text = text
    t.tokens = md.Lexer.lexInline(text)
    t.anchorId = unique
  }

  const headingDepths = tokens.filter(t => t.type === 'heading').map(t => t.depth)
  const articleLevel = headingDepths.includes(3) ? 3 : headingDepths.includes(2) ? 2 : 1

  const blocks = []
  let current = null // 지금 모으는 조항
  let loose = []     // 조항 밖의 본문 (머리말, 요약표 등)

  const flushLoose = () => {
    if (!loose.length) return
    const html = sanitize(md.parser(loose))
    blocks.push({ kind: 'html', html, text: plain(html) })
    loose = []
  }
  const flushSection = () => {
    if (!current) return
    const html = sanitize(md.parser(current.body))
    blocks.push({ kind: 'section', id: current.id, title: current.title, html, text: `${plain(current.title)} ${plain(html)}` })
    current = null
  }

  for (const t of tokens) {
    if (t.type === 'heading' && t.depth <= articleLevel) {
      flushSection()
      flushLoose()
      const title = sanitize(md.parseInline(t.text))
      if (t.depth < articleLevel) {
        blocks.push({ kind: 'heading', level: t.depth, id: t.anchorId, title })
      } else {
        current = { id: t.anchorId, title, body: [] }
      }
      continue
    }
    if (current) current.body.push(t)
    else loose.push(t)
  }
  flushSection()
  flushLoose()

  // 목차: 묶음 제목 아래 조항들
  const toc = []
  let group = null
  for (const b of blocks) {
    if (b.kind === 'heading') {
      group = { id: b.id, title: b.title, level: b.level, items: [] }
      toc.push(group)
    } else if (b.kind === 'section') {
      if (!group) { group = { id: null, title: null, level: 0, items: [] }; toc.push(group) }
      group.items.push({ id: b.id, title: b.title })
    }
  }

  return { blocks, toc, anchors: [...used] }
}
