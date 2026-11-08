<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'

// 회칙 본문: 조항별 접기·펼치기 + 검색 + 조항 바로가기
const props = defineProps({
  parsed: { type: Object, required: true }, // parseRules() 결과
  query: { type: String, default: '' },
})

const root = ref(null)
const open = ref(new Set())

// "요약" 같은 조항은 처음부터 펼쳐 둔다
watch(() => props.parsed, p => {
  open.value = new Set(p.blocks.filter(b => b.kind === 'section' && b.defaultOpen).map(b => b.id))
}, { immediate: true })

const q = computed(() => props.query.trim().toLowerCase())

// 검색 중이면 맞는 조항만, 그 조항이 속한 묶음 제목과 함께 보여준다
const visible = computed(() => {
  const blocks = props.parsed.blocks
  if (!q.value) return blocks
  const out = []
  let pendingHeadings = []
  for (const b of blocks) {
    if (b.kind === 'heading') {
      pendingHeadings = pendingHeadings.filter(h => h.level < b.level)
      pendingHeadings.push(b)
      continue
    }
    if (!b.text.toLowerCase().includes(q.value)) continue
    out.push(...pendingHeadings)
    pendingHeadings = []
    out.push(b)
  }
  return out
})

const matchCount = computed(() => visible.value.filter(b => b.kind === 'section').length)

function isOpen(b) {
  return !!q.value || open.value.has(b.id)
}

function toggle(id) {
  const next = new Set(open.value)
  next.has(id) ? next.delete(id) : next.add(id)
  open.value = next
}

function setAll(value) {
  open.value = value
    ? new Set(props.parsed.blocks.filter(b => b.kind === 'section').map(b => b.id))
    : new Set()
}

// 조항으로 이동: 펼치고 스크롤. 하위 제목 앵커면 그 제목이 든 조항을 펼친다.
async function goTo(anchor) {
  if (!anchor) return false
  const section = props.parsed.blocks.find(b => b.kind === 'section' && (b.id === anchor || b.html.includes(`id="${anchor}"`)))
  if (section) open.value = new Set([...open.value, section.id])
  await nextTick()
  const el = root.value?.querySelector(`#${CSS.escape(anchor)}`)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), 1600)
  return true
}

// 본문 안의 [세칙 2-2](#rule-2-2) 같은 링크는 페이지 안에서 이동
function onClick(e) {
  const a = e.target.closest('a')
  if (!a) return
  const href = a.getAttribute('href') || ''
  if (href.startsWith('#')) {
    e.preventDefault()
    goTo(decodeURIComponent(href.slice(1)))
    history.replaceState(history.state, '', href)
  } else if (/^https?:/.test(href)) {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener')
  }
}

// 검색어 강조
function highlight() {
  const el = root.value
  if (!el) return
  // v-html로 넣은 영역 안쪽만 건드린다 (Vue가 관리하는 노드를 바꾸면 화면 갱신이 깨진다)
  const containers = [...el.querySelectorAll('.md, .article-title, .group-title')]
  containers.forEach(c => {
    c.querySelectorAll('mark.hit').forEach(m => m.replaceWith(document.createTextNode(m.textContent)))
    c.normalize()
  })
  if (!q.value) return
  const nodes = []
  containers.forEach(container => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) nodes.push(walker.currentNode)
  })
  for (const node of nodes) {
    const text = node.nodeValue
    const lower = text.toLowerCase()
    if (!lower.includes(q.value)) continue
    const frag = document.createDocumentFragment()
    let i = 0
    let j
    while ((j = lower.indexOf(q.value, i)) !== -1) {
      if (j > i) frag.appendChild(document.createTextNode(text.slice(i, j)))
      const mark = document.createElement('mark')
      mark.className = 'hit'
      mark.textContent = text.slice(j, j + q.value.length)
      frag.appendChild(mark)
      i = j + q.value.length
    }
    if (i < text.length) frag.appendChild(document.createTextNode(text.slice(i)))
    node.replaceWith(frag)
  }
}

watch([q, () => props.parsed, open], () => nextTick(highlight))
onMounted(highlight)

defineExpose({ goTo, setAll, matchCount })
</script>

<template>
  <div ref="root" class="rules-body" @click="onClick">
    <p v-if="q && matchCount === 0" class="no-hit">"{{ query }}"이(가) 들어간 조항이 없어요.</p>
    <template v-for="(b, i) in visible" :key="b.id || i">
      <div v-if="b.kind === 'html'" class="md loose" v-html="b.html" />
      <component
        v-else-if="b.kind === 'heading'"
        :is="['h2', 'h3', 'h4'][Math.min(b.level, 3) - 1]"
        :id="b.id"
        :class="['group-title', `lv${b.level}`]"
        v-html="b.title"
      />
      <section v-else class="article" :class="{ open: isOpen(b) }">
        <button class="article-head" :id="b.id" :aria-expanded="isOpen(b)" @click="toggle(b.id)">
          <span class="chev" aria-hidden="true">›</span>
          <span class="article-title" v-html="b.title" />
        </button>
        <div v-show="isOpen(b)" class="md article-body" v-html="b.html" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.rules-body { color: #eaf2e6; }
.no-hit { color: #9db39e; font-size: 0.9rem; padding: 1rem 0; }

.group-title { color: #6fbf6f; margin: 1.75rem 0 0.6rem; scroll-margin-top: 110px; }
.group-title.lv1 { font-size: 1.25rem; border-bottom: 1px solid #2c4a33; padding-bottom: 0.4rem; }
.group-title.lv2 { font-size: 1.05rem; }
.group-title.lv3, .group-title.lv4 { font-size: 0.95rem; color: #9db39e; margin: 1.25rem 0 0.5rem; }
.loose :deep(blockquote) { color: #9db39e; }

.article { border: 1px solid #2c4a33; border-radius: 10px; background: #16271a; margin-bottom: 0.5rem; }
.article-head {
  display: flex; gap: 0.5rem; align-items: baseline; width: 100%; text-align: left;
  background: none; border: 0; color: #eaf2e6; font: inherit; font-weight: 700; font-size: 0.95rem;
  padding: 0.75rem 0.9rem; cursor: pointer; scroll-margin-top: 110px; border-radius: 10px;
}
.article-head:hover { background: #1d3324; }
.chev { color: #6fbf6f; display: inline-block; transition: transform 0.15s; width: 0.7rem; flex-shrink: 0; }
.article.open .chev { transform: rotate(90deg); }
.article-body { padding: 0 0.9rem 0.9rem 2.1rem; }

.md :deep(p) { margin: 0.4rem 0; line-height: 1.7; font-size: 0.92rem; color: #d6e3d3; word-break: keep-all; }
.md :deep(ul), .md :deep(ol) { margin: 0.4rem 0; padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7; color: #d6e3d3; }
.md :deep(h4), .md :deep(h5), .md :deep(h6) { font-size: 0.92rem; color: #eaf2e6; margin: 0.9rem 0 0.3rem; scroll-margin-top: 110px; }
.md :deep(a) { color: #6fbf6f; }
.md :deep(strong) { color: #eaf2e6; }
.md :deep(blockquote) { margin: 0.5rem 0; padding: 0.4rem 0.8rem; border-left: 3px solid #4e9a51; background: #1d3324; border-radius: 0 6px 6px 0; }
.md :deep(code) { background: #1d3324; padding: 0.05rem 0.3rem; border-radius: 4px; font-size: 0.85em; }
.md :deep(table) { border-collapse: collapse; width: 100%; font-size: 0.85rem; margin: 0.6rem 0; display: block; overflow-x: auto; }
.md :deep(th), .md :deep(td) { border: 1px solid #2c4a33; padding: 0.4rem 0.55rem; text-align: left; vertical-align: top; word-break: keep-all; }
.md :deep(th) { background: #1d3324; color: #eaf2e6; white-space: nowrap; }
.md :deep(td) { color: #d6e3d3; }
.md :deep(hr) { border: 0; border-top: 1px solid #2c4a33; margin: 1rem 0; }
.loose { margin-bottom: 1rem; }

.rules-body :deep(mark.hit) { background: #e8c547; color: #0f1b12; border-radius: 2px; padding: 0 1px; }
.rules-body :deep(.flash) { animation: flash 1.6s ease-out; }
@keyframes flash { 0% { background: #3d6642; } 100% { background: transparent; } }
</style>
