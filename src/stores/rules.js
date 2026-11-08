import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/supabase'

export const APPROVERS = ['총회', '임원회']

export const useRulesStore = defineStore('rules', () => {
  const versions = ref([])
  const loaded = ref(false)
  // rules_versions 테이블이 아직 없으면 false (SQL 적용 전)
  const available = ref(true)

  async function load() {
    const { data, error } = await supabase
      .from('rules_versions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { available.value = false; loaded.value = true; return }
    available.value = true
    versions.value = data || []
    loaded.value = true
  }

  const current = computed(() => versions.value.find(v => v.is_current) || null)
  const published = computed(() =>
    versions.value
      .filter(v => v.status === 'published')
      .sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || '') || b.id - a.id)
  )
  const drafts = computed(() => versions.value.filter(v => v.status === 'draft'))

  function byId(id) {
    return versions.value.find(v => v.id === Number(id)) || null
  }

  const DRAFT_FIELDS = ['version', 'effective_date', 'content_md', 'change_summary', 'approved_by']
  const pick = obj => Object.fromEntries(DRAFT_FIELDS.map(k => [k, obj[k] === '' ? null : obj[k]]))

  async function saveDraft(fields, id = null) {
    const row = pick(fields)
    const q = id
      ? supabase.from('rules_versions').update(row).eq('id', id).eq('status', 'draft')
      : supabase.from('rules_versions').insert({ ...row, status: 'draft', is_current: false })
    const { data, error } = await q.select().single()
    if (error) return { error }
    const idx = versions.value.findIndex(v => v.id === data.id)
    if (idx >= 0) versions.value[idx] = data
    else versions.value.unshift(data)
    return { data }
  }

  async function deleteDraft(id) {
    const { error } = await supabase.from('rules_versions').delete().eq('id', id).eq('status', 'draft')
    if (error) return error
    versions.value = versions.value.filter(v => v.id !== id)
  }

  async function publish(id) {
    const { error } = await supabase.rpc('publish_rules_version', { p_id: id })
    if (error) return error
    await load()
  }

  return { versions, loaded, available, load, current, published, drafts, byId, saveDraft, deleteDraft, publish }
})
