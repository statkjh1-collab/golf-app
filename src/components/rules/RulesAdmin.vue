<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRulesStore, APPROVERS } from '@/stores/rules'
import { useSettingsStore } from '@/stores/settings'
import { parseRules } from '@/lib/rulesMarkdown'
import RulesBody from '@/components/rules/RulesBody.vue'

const rules = useRulesStore()
const settings = useSettingsStore()

onMounted(() => rules.load())

// ── 편집 폼 ──
const editingId = ref(null) // null = 새 초안
const form = ref(emptyForm())
const showPreview = ref(false)
const msg = ref('')
const err = ref('')
const busy = ref(false)

function emptyForm() {
  return { version: '', effective_date: '', approved_by: '총회', change_summary: '', content_md: '' }
}

function startNew() {
  editingId.value = null
  form.value = emptyForm()
  showPreview.value = false
  msg.value = ''; err.value = ''
}

function edit(v) {
  editingId.value = v.id
  form.value = {
    version: v.version || '',
    effective_date: v.effective_date || '',
    approved_by: v.approved_by || '총회',
    change_summary: v.change_summary || '',
    content_md: v.content_md || '',
  }
  showPreview.value = false
  msg.value = ''; err.value = ''
}

function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { form.value.content_md = String(reader.result || '') }
  reader.readAsText(file, 'utf-8')
  e.target.value = ''
}

const preview = computed(() => parseRules(form.value.content_md))
const sectionCount = computed(() => preview.value.blocks.filter(b => b.kind === 'section').length)

async function save() {
  msg.value = ''; err.value = ''
  if (!form.value.version.trim()) { err.value = '버전을 입력해 주세요. (예: 2027.1)'; return }
  if (!form.value.content_md.trim()) { err.value = '회칙 본문을 붙여넣거나 파일을 올려 주세요.'; return }
  busy.value = true
  const { data, error } = await rules.saveDraft({ ...form.value, version: form.value.version.trim() }, editingId.value)
  busy.value = false
  if (error) { err.value = `저장하지 못했어요: ${error.message}`; return }
  editingId.value = data.id
  msg.value = '초안으로 저장했어요. 회원에게는 아직 보이지 않아요.'
}

async function remove(v) {
  if (!confirm(`초안 "${v.version}"을(를) 삭제할까요? 되돌릴 수 없어요.`)) return
  const error = await rules.deleteDraft(v.id)
  if (error) { alert(`삭제하지 못했어요: ${error.message}`); return }
  if (editingId.value === v.id) startNew()
}

// ── 게시 ──
const publishing = ref(null) // 게시할 초안
const checks = ref({ numbers: false, date: false })
const SETTING_ROWS = [
  ['fee_plan', '회비안 (A/B)'],
  ['join_fee', '가입비'],
  ['annual_fee', '연회비 (A안)'],
  ['field_fee', '필드 참가 회비'],
  ['late_fine', '지각 벌금'],
  ['cancel_free_days', '무위약 취소 기한 (일 전)'],
  ['screen_meal_cap', '스크린 식대 1인 상한'],
  ['min_games_avg_rank', '평균 랭킹 최소 참석'],
  ['dormant_attendance_rate', '휴면 참석률 기준'],
  ['noshow_limit', '제명 노쇼 횟수'],
  ['capacity_total', '회원 정원'],
]

function fmtSetting(key) {
  const v = settings.get(key)
  if (typeof v === 'number' && v >= 1000) return `${v.toLocaleString()}원`
  if (key === 'dormant_attendance_rate') return `${Math.round(v * 100)}%`
  return String(v)
}

function askPublish(v) {
  publishing.value = v
  checks.value = { numbers: false, date: !!v.effective_date }
}

async function confirmPublish() {
  const v = publishing.value
  busy.value = true
  const error = await rules.publish(v.id)
  busy.value = false
  if (error) { alert(`게시하지 못했어요: ${error.message}`); return }
  publishing.value = null
  if (editingId.value === v.id) startNew()
  msg.value = `${v.version}을(를) 게시했어요. 이제 회원 누구나 회칙 화면에서 볼 수 있어요.`
}

function fmt(d) { return d ? d.replaceAll('-', '.') : '-' }
</script>

<template>
  <div class="rules-admin">
    <div v-if="!rules.available" class="card warn">
      회칙 테이블이 아직 없어요. Supabase SQL Editor에서
      <code>20261108130000_rules_versions.sql</code>을 실행해 주세요.
    </div>

    <template v-else>
      <!-- 버전 목록 -->
      <div class="card">
        <div class="row-between">
          <h2>회칙 버전</h2>
          <button class="btn btn-sm" @click="startNew">+ 새 버전</button>
        </div>
        <p v-if="!rules.versions.length" class="dim">등록된 회칙이 없어요. 아래에서 초안을 만들어 주세요.</p>
        <div v-for="v in rules.versions" :key="v.id" class="ver-row" :class="{ sel: editingId === v.id }">
          <div class="ver-info">
            <b>{{ v.version }}</b>
            <span v-if="v.is_current" class="tag cur">현재 시행</span>
            <span v-else-if="v.status === 'published'" class="tag old">이전 버전</span>
            <span v-else class="tag draft">초안 · 관리자만 열람</span>
            <div class="dim small">시행 {{ fmt(v.effective_date) }} · {{ v.approved_by || '-' }}<template v-if="v.change_summary"> · {{ v.change_summary }}</template></div>
          </div>
          <div class="ver-actions">
            <template v-if="v.status === 'draft'">
              <button class="btn-ghost" @click="edit(v)">편집</button>
              <button class="btn btn-sm" @click="askPublish(v)">게시</button>
              <button class="btn-ghost danger" @click="remove(v)">삭제</button>
            </template>
            <RouterLink v-else :to="v.is_current ? '/rules' : `/rules/v/${v.id}`" class="btn-ghost">보기</RouterLink>
          </div>
        </div>
      </div>

      <!-- 초안 작성·편집 -->
      <div class="card">
        <h2>{{ editingId ? '초안 편집' : '새 초안' }}</h2>
        <div class="grid">
          <label>버전<input v-model="form.version" placeholder="예: 2027.1" /></label>
          <label>시행일<input v-model="form.effective_date" type="date" /></label>
          <label>의결 기구
            <select v-model="form.approved_by">
              <option v-for="a in APPROVERS" :key="a" :value="a">{{ a }}</option>
            </select>
          </label>
        </div>
        <label>개정 요약<input v-model="form.change_summary" placeholder="예: 필드 정기라운드 운영세칙 신설" /></label>

        <div class="row-between content-head">
          <span class="label">회칙 본문 (마크다운)</span>
          <label class="file-btn">MD 파일 올리기<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" @change="onFile" hidden /></label>
        </div>
        <textarea v-model="form.content_md" rows="14" placeholder="회칙 MD 내용을 붙여넣으세요.&#10;조항 제목은 ### 제1조 (명칭) 처럼, 세칙은 ### 2-2. 취소 및 노쇼 처럼 쓰면 바로가기 주소가 자동으로 붙어요." />
        <p class="dim small">조항 {{ sectionCount }}개 인식 · 바로가기 주소 예: {{ preview.anchors.slice(0, 4).join(', ') || '-' }}</p>

        <p v-if="err" class="error">{{ err }}</p>
        <p v-if="msg" class="ok">{{ msg }}</p>

        <div class="btns">
          <button class="btn-ghost" @click="showPreview = !showPreview" :disabled="!form.content_md.trim()">
            {{ showPreview ? '미리보기 닫기' : '미리보기' }}
          </button>
          <button class="btn" @click="save" :disabled="busy">초안 저장</button>
        </div>

        <div v-if="showPreview" class="preview">
          <p class="dim small">회원에게 보일 모습이에요. (조항을 눌러 펼쳐 보세요)</p>
          <RulesBody :parsed="preview" />
        </div>
      </div>
    </template>

    <!-- 게시 확인 -->
    <div v-if="publishing" class="overlay" @click.self="publishing = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pub-title">
        <h2 id="pub-title">{{ publishing.version }} 게시</h2>
        <p class="dim">게시하면 지금 시행 중인 회칙은 이전 버전으로 보관되고, 홈에 개정 배너가 {{ settings.get('rules_banner_days') }}일간 보여요.</p>

        <h3>회칙 숫자와 앱 설정값이 같은지 확인하세요</h3>
        <table class="settings">
          <tr v-for="[k, label] in SETTING_ROWS" :key="k"><td>{{ label }}</td><td class="val">{{ fmtSetting(k) }}</td></tr>
        </table>
        <p class="dim small">다르면 Supabase의 settings 테이블에서 값을 바꿔 주세요. (설정값 화면은 다음 단계에서 추가)</p>

        <label class="check"><input type="checkbox" v-model="checks.numbers" /> 회칙의 금액·기준이 위 설정값과 같아요</label>
        <label class="check"><input type="checkbox" v-model="checks.date" /> 총회 의결을 마쳤고 시행일({{ fmt(publishing.effective_date) }})이 맞아요</label>

        <div class="btns">
          <button class="btn-ghost" @click="publishing = null">취소</button>
          <button class="btn" :disabled="!checks.numbers || !checks.date || busy" @click="confirmPublish">게시하기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-admin { display: flex; flex-direction: column; gap: 1rem; }
.card { background: #16271a; border: 1px solid #2c4a33; border-radius: 12px; padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
.card.warn { border-color: #6b5d24; background: #2a2612; color: #eaf2e6; font-size: 0.9rem; display: block; }
h2 { font-size: 1.05rem; color: #eaf2e6; margin: 0; }
h3 { font-size: 0.92rem; color: #eaf2e6; margin: 1rem 0 0.4rem; }
.dim { color: #9db39e; font-size: 0.88rem; margin: 0; }
.small { font-size: 0.8rem; }
.row-between { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }

.ver-row { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.65rem 0; border-top: 1px solid #2c4a33; flex-wrap: wrap; }
.ver-row.sel { background: #1d3324; margin: 0 -0.6rem; padding: 0.65rem 0.6rem; border-radius: 8px; }
.ver-info b { color: #eaf2e6; margin-right: 0.35rem; }
.ver-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.tag { font-size: 0.72rem; border-radius: 4px; padding: 0.08rem 0.4rem; font-weight: 700; }
.tag.cur { background: #4e9a51; color: #fff; }
.tag.old { background: #2c4a33; color: #9db39e; }
.tag.draft { background: #2a2612; color: #e8c547; border: 1px solid #6b5d24; }

.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
label { display: flex; flex-direction: column; gap: 0.3rem; color: #9db39e; font-size: 0.82rem; }
.label { color: #9db39e; font-size: 0.82rem; }
input, select, textarea { padding: 0.55rem 0.7rem; border-radius: 8px; border: 1px solid #2c4a33; background: #0f1b12; color: #eaf2e6; font: inherit; font-size: 0.9rem; }
textarea { font-family: ui-monospace, 'D2Coding', Consolas, monospace; font-size: 0.82rem; line-height: 1.5; resize: vertical; }
.content-head { margin-top: 0.4rem; }
.file-btn { cursor: pointer; color: #6fbf6f; font-weight: 600; font-size: 0.85rem; flex-direction: row; }

.btns { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; margin-top: 0.4rem; }
.btn { background: #4e9a51; color: #fff; border: 0; border-radius: 8px; padding: 0.55rem 1.1rem; font: inherit; font-weight: 700; font-size: 0.9rem; cursor: pointer; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.82rem; }
.btn-ghost { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.82rem; cursor: pointer; text-decoration: none; }
.btn-ghost:hover:not(:disabled) { border-color: #4e9a51; color: #eaf2e6; }
.btn-ghost:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-ghost.danger:hover { border-color: #e8543e; color: #e8543e; }
.error { color: #e8543e; font-size: 0.85rem; margin: 0; }
.ok { color: #6fbf6f; font-size: 0.85rem; margin: 0; }

.preview { border-top: 1px dashed #3d6642; padding-top: 0.75rem; margin-top: 0.5rem; }

.overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.dialog { background: #16271a; border: 1px solid #3d6642; border-radius: 14px; padding: 1.25rem; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
.dialog .dim { margin-top: 0.4rem; }
table.settings { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
table.settings td { border-bottom: 1px solid #2c4a33; padding: 0.35rem 0.2rem; color: #d6e3d3; }
table.settings td.val { text-align: right; color: #eaf2e6; font-weight: 600; }
.check { flex-direction: row; align-items: flex-start; gap: 0.5rem; color: #eaf2e6; font-size: 0.88rem; margin-top: 0.6rem; }
.check input { margin-top: 0.2rem; }
code { background: #0f1b12; padding: 0.05rem 0.3rem; border-radius: 4px; }

@media (max-width: 560px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
