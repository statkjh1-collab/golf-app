<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useRulesStore } from '@/stores/rules'
import { parseRules } from '@/lib/rulesMarkdown'
import RulesBody from '@/components/rules/RulesBody.vue'

const route = useRoute()
const rules = useRulesStore()
const body = ref(null)
const query = ref('')
const tocOpen = ref(false)
const missingAnchor = ref('')

onMounted(async () => {
  if (!rules.loaded) await rules.load()
  jumpToHash()
})

// /rules → 현재 시행본, /rules/v/:id → 게시된 이전 버전 (초안은 열람 불가)
const viewing = computed(() => {
  if (route.params.id) {
    const v = rules.byId(route.params.id)
    return v && v.status === 'published' ? v : null
  }
  return rules.current
})
const isOld = computed(() => !!route.params.id && viewing.value && !viewing.value.is_current)
const parsed = computed(() => parseRules(viewing.value?.content_md || ''))

async function jumpToHash() {
  missingAnchor.value = ''
  const anchor = decodeURIComponent((route.hash || '').slice(1))
  if (!anchor || !viewing.value) return
  await nextTick()
  const ok = await body.value?.goTo(anchor)
  if (!ok) missingAnchor.value = anchor
}
watch(() => route.fullPath, () => { query.value = ''; jumpToHash() })

async function tocGo(id) {
  query.value = ''
  tocOpen.value = false
  await nextTick()
  body.value?.goTo(id)
  history.replaceState(history.state, '', `#${id}`)
}

function fmt(d) {
  return d ? d.replaceAll('-', '.') : '-'
}
</script>

<template>
  <main class="page">
    <div class="head">
      <h1>📖 회칙</h1>
      <p v-if="viewing" class="meta">
        <span class="ver">{{ viewing.version }}</span>
        시행 {{ fmt(viewing.effective_date) }}
        <template v-if="viewing.approved_by"> · {{ viewing.approved_by }} 의결</template>
      </p>
    </div>

    <p v-if="!rules.loaded" class="dim">불러오는 중…</p>

    <div v-else-if="!viewing" class="card empty">
      <template v-if="route.params.id">
        <p>해당 버전을 찾을 수 없어요.</p>
        <RouterLink to="/rules" class="link">현재 회칙 보기 →</RouterLink>
      </template>
      <template v-else>
        <p>아직 시행 중인 회칙이 없어요.</p>
        <p class="dim">총회 의결 후 운영진이 게시하면 여기에서 볼 수 있어요.</p>
      </template>
    </div>

    <template v-else>
      <div v-if="isOld" class="notice old">
        이전 버전({{ viewing.version }})을 보고 있어요. 읽기 전용이에요.
        <RouterLink to="/rules" class="link">현재 회칙 보기 →</RouterLink>
      </div>
      <div v-if="missingAnchor" class="notice">
        이 버전에는 해당 조항(#{{ missingAnchor }})이 없어요. 목차에서 찾아보세요.
      </div>

      <div class="tools">
        <input v-model="query" type="search" placeholder="조항 검색 (예: 노쇼, 회비)" aria-label="조항 검색" />
        <div class="tool-btns">
          <button class="btn-ghost" @click="tocOpen = !tocOpen" :aria-expanded="tocOpen">목차</button>
          <button class="btn-ghost" @click="body?.setAll(true)">모두 펼치기</button>
          <button class="btn-ghost" @click="body?.setAll(false)">모두 접기</button>
        </div>
      </div>

      <nav v-if="tocOpen" class="toc card" aria-label="목차">
        <div v-for="(g, gi) in parsed.toc" :key="g.id || gi" class="toc-group">
          <a v-if="g.title" href="#" :class="['toc-title', `lv${g.level}`]" @click.prevent="tocGo(g.id)" v-html="g.title" />
          <a v-for="it in g.items" :key="it.id" href="#" class="toc-item" @click.prevent="tocGo(it.id)" v-html="it.title" />
        </div>
      </nav>

      <p v-if="query.trim()" class="dim result">검색 결과 {{ body?.matchCount ?? 0 }}개 조항</p>

      <RulesBody ref="body" :parsed="parsed" :query="query" />

      <section class="history" id="history">
        <h2>개정 이력</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>버전</th><th>시행일</th><th>개정 요약</th><th>의결</th><th></th></tr></thead>
            <tbody>
              <tr v-for="v in rules.published" :key="v.id" :class="{ here: v.id === viewing.id }">
                <td class="nowrap">{{ v.version }} <span v-if="v.is_current" class="tag">현재</span></td>
                <td class="nowrap">{{ fmt(v.effective_date) }}</td>
                <td>{{ v.change_summary || '-' }}</td>
                <td class="nowrap">{{ v.approved_by || '-' }}</td>
                <td class="nowrap">
                  <span v-if="v.id === viewing.id" class="dim">보는 중</span>
                  <RouterLink v-else :to="v.is_current ? '/rules' : `/rules/v/${v.id}`" class="link">보기</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page { max-width: 760px; margin: 0 auto; padding: 1.75rem 1.25rem 3rem; }
.head h1 { font-size: 1.5rem; margin: 0 0 0.3rem; color: #eaf2e6; }
.meta { color: #9db39e; font-size: 0.88rem; margin: 0 0 1.25rem; }
.ver { background: #2c4a33; color: #eaf2e6; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 6px; margin-right: 0.35rem; }
.dim { color: #9db39e; font-size: 0.88rem; }
.card { background: #16271a; border: 1px solid #2c4a33; border-radius: 12px; padding: 1.1rem 1.25rem; }
.empty p { margin: 0.25rem 0; color: #eaf2e6; }
.link { color: #6fbf6f; font-weight: 600; text-decoration: none; }

.notice { background: #1d3324; border: 1px solid #3d6642; border-radius: 10px; padding: 0.7rem 0.9rem; font-size: 0.88rem; color: #eaf2e6; margin-bottom: 0.9rem; }
.notice.old { border-color: #6b5d24; background: #2a2612; }

.tools { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 0.9rem; position: sticky; top: 94px; z-index: 5; background: #0f1b12; padding: 0.5rem 0; }
.tools input { width: 100%; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1px solid #2c4a33; background: #16271a; color: #eaf2e6; font: inherit; font-size: 0.95rem; }
.tool-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.btn-ghost { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
.btn-ghost:hover { border-color: #4e9a51; color: #eaf2e6; }

.toc { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.6rem; max-height: 60vh; overflow-y: auto; }
.toc-group { display: flex; flex-direction: column; }
.toc a { text-decoration: none; padding: 0.2rem 0; }
.toc-title { color: #6fbf6f; font-weight: 700; font-size: 0.92rem; }
.toc-title.lv2 { padding-left: 0.6rem; font-size: 0.88rem; }
.toc-item { color: #d6e3d3; font-size: 0.86rem; padding-left: 1.2rem !important; }
.toc-item:hover, .toc-title:hover { color: #eaf2e6; }
.result { margin: 0 0 0.6rem; }

.history { margin-top: 2.5rem; }
.history h2 { font-size: 1.15rem; color: #eaf2e6; margin: 0 0 0.75rem; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
th, td { border-bottom: 1px solid #2c4a33; padding: 0.5rem 0.4rem; text-align: left; color: #d6e3d3; vertical-align: top; }
th { color: #9db39e; font-weight: 600; }
tr.here td { background: #16271a; }
.nowrap { white-space: nowrap; }
.tag { font-size: 0.7rem; background: #4e9a51; color: #fff; border-radius: 4px; padding: 0.05rem 0.35rem; margin-left: 0.2rem; }

@media (max-width: 480px) {
  .page { padding: 1.25rem 1rem 3rem; }
}
</style>
