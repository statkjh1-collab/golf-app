import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/supabase'

// 회칙 초안 기준 기본값. settings 테이블에 값이 있으면 그 값이 우선한다.
// (테이블이 아직 없어도 앱이 동작하도록 기본값을 둔다)
export const DEFAULT_SETTINGS = {
  fee_plan: 'A',
  join_fee: 100000,
  annual_fee: 100000,
  field_fee: 30000,
  field_meal_portion: 30000,
  late_fine: 10000,
  cancel_free_days: 7,
  gather_minutes_before: 30,
  screen_meal_cap: 50000,
  screen_points: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  min_games_avg_rank: 3,
  dormant_attendance_rate: 0.3,
  noshow_limit: 2,
  capacity_total: 40,
  rules_banner_days: 14,
}

export const useSettingsStore = defineStore('settings', () => {
  const values = ref({ ...DEFAULT_SETTINGS })
  const loadedFromDb = ref(false)

  async function load() {
    const { data, error } = await supabase.from('settings').select('key, value')
    if (error || !data) return
    const next = { ...DEFAULT_SETTINGS }
    data.forEach(row => { next[row.key] = row.value })
    values.value = next
    loadedFromDb.value = true
  }

  function get(key) {
    return values.value[key] ?? DEFAULT_SETTINGS[key]
  }

  async function set(key, value) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    if (error) return error
    values.value = { ...values.value, [key]: value }
  }

  // 순위 → 순위점수. 표보다 아래 순위는 마지막 값을 받는다.
  function screenPoints(rank) {
    const table = get('screen_points')
    if (!Array.isArray(table) || !table.length) return Math.max(11 - rank, 1)
    return table[rank - 1] ?? table[table.length - 1]
  }

  return { values, loadedFromDb, load, get, set, screenPoints }
})
