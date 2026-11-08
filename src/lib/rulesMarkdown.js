import { Marked } from 'marked'
import DOMPurify from 'dompurify'

// 회칙 마크다운 → 화면용 구조
//
// 조항 단위(접기·펼치기·검색 단위) = 아래에 더 깊은 제목이 없는 제목.
// 아래에 하위 조항이 있는 제목(제1부, 제1장, 세칙 2 등)은 묶음 제목으로 보여준다.
//
// 제목으로 치는 것:
//   - 마크다운 제목 (#, ##, ### …)
//   - 굵게 시작하는 조항 문단: "**제18조 (회계)** 본문…", "**2-2. 취소 및 노쇼**"
//     → 바로 위 제목보다 한 단계 아래 제목으로 본다
//
// 조항 바로가기 주소(앵커):
//   - 제목 끝에 {#rule-2-2} 처럼 직접 적으면 그 값을 쓴다
//   - 없으면 "제18조 ..." → art-18, "2-2. ..." → rule-2-2, "1. ..." → rule-1
//   - 그 외에는 sec-순번

const ANCHOR_RE = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/
const BOLD_ARTICLE_RE = /^\*\*((?:제\s*\d+\s*조|\d+(?:-\d+)+\.)[^*\n]*)\*\*[ \t]*/

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

// 굵게 시작하는 조항 문단을 제목 토큰 + 나머지 본문으로 나눈다
function splitBoldArticles(tokens) {
  const out = []
  let lastDepth = 0
  for (const t of tokens) {
    if (t.type === 'heading') { lastDepth = t.depth; out.push(t); continue }
    const m = t.type === 'paragraph' && t.raw.match(BOLD_ARTICLE_RE)
    if (!m) { out.push(t); continue }
    const text = m[1].trim()
    out.push({ type: 'heading', depth: Math.min(lastDepth + 1, 6), text, raw: m[0], tokens: [], synthetic: true })
    const rest = t.raw.slice(m[0].length).replace(/^\n/, '')
    if (rest.trim()) out.push(...md.lexer(rest))
  }
  return out
}

export function parseRules(source) {
  const tokens = splitBoldArticles(md.lexer(source || ''))
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

  // 각 제목이 조항(하위 제목 없음)인지 묶음인지 정한다
  const headingIdx = tokens.map((t, i) => (t.type === 'heading' ? i : -1)).filter(i => i >= 0)
  headingIdx.forEach((i, k) => {
    const next = headingIdx[k + 1]
    tokens[i].isLeaf = next === undefined || tokens[next].depth <= tokens[i].depth
  })

  const blocks = []
  let current = null // 지금 모으는 조항
  let loose = []     // 조항 밖의 본문 (머리말, 안내문 등)

  const flushLoose = () => {
    const content = loose.filter(t => t.type !== 'space' && t.type !== 'hr')
    if (content.length) {
      const html = sanitize(md.parser(loose))
      blocks.push({ kind: 'html', html, text: plain(html) })
    }
    loose = []
  }
  const flushSection = () => {
    if (!current) return
    const html = sanitize(md.parser(current.body))
    blocks.push({
      kind: 'section', id: current.id, title: current.title, level: current.level, html,
      text: `${plain(current.title)} ${plain(html)}`,
      defaultOpen: /요약/.test(plain(current.title)),
    })
    current = null
  }

  for (const t of tokens) {
    if (t.type === 'heading') {
      flushSection()
      flushLoose()
      const title = sanitize(md.parseInline(t.text))
      if (t.isLeaf) current = { id: t.anchorId, title, level: t.depth, body: [] }
      else blocks.push({ kind: 'heading', level: t.depth, id: t.anchorId, title })
      continue
    }
    // 조항 사이 구분선은 버린다 (조항 상자가 이미 구분한다)
    if (t.type === 'hr') continue
    if (current) current.body.push(t)
    else loose.push(t)
  }
  flushSection()
  flushLoose()

  // 묶음 제목 단계를 1부터 다시 매긴다 (문서마다 # 시작 단계가 달라도 같은 모양)
  const groupDepths = [...new Set(blocks.filter(b => b.kind === 'heading').map(b => b.level))].sort((a, b) => a - b)
  blocks.forEach(b => { if (b.kind === 'heading') b.level = groupDepths.indexOf(b.level) + 1 })

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
