import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/supabase'

export const useGolfStore = defineStore('golf', () => {
  const members = ref([])
  const meetings = ref([])
  const attendances = ref([])
  const scores = ref([])
  const loading = ref(false)

  async function init() {
    loading.value = true
    const [m, mt, a, s] = await Promise.all([
      supabase.from('members').select('*').order('id'),
      supabase.from('meetings').select('*').order('id'),
      supabase.from('attendances').select('*').order('id'),
      supabase.from('scores').select('*').order('id'),
    ])
    members.value = m.data || []
    meetings.value = mt.data || []
    attendances.value = a.data || []
    scores.value = s.data || []
    loading.value = false
  }

  async function addMember(name, handicap) {
    const { data } = await supabase.from('members').insert({ name, handicap: Number(handicap) || 0, active: true }).select().single()
    if (data) members.value.push(data)
  }

  async function updateMember(id, name, handicap) {
    const { data } = await supabase.from('members').update({ name, handicap: Number(handicap) || 0 }).eq('id', id).select().single()
    if (data) {
      const idx = members.value.findIndex(m => m.id === id)
      if (idx >= 0) members.value[idx] = data
    }
  }

  async function deleteMember(id) {
    await supabase.from('members').delete().eq('id', id)
    members.value = members.value.filter(m => m.id !== id)
  }

  async function addMeeting(title, date, time) {
    const { data } = await supabase.from('meetings').insert({ title, meet_date: date, meet_time: time, capacity: 10, status: 'open', total_fee: null }).select().single()
    if (data) meetings.value.push(data)
  }

  async function deleteMeeting(id) {
    await supabase.from('meetings').delete().eq('id', id)
    meetings.value = meetings.value.filter(m => m.id !== id)
    attendances.value = attendances.value.filter(a => a.meeting_id !== id)
    scores.value = scores.value.filter(s => s.meeting_id !== id)
  }

  async function toggleAttend(meeting_id, member_id) {
    const existing = attendances.value.find(a => a.meeting_id === meeting_id && a.member_id === member_id)
    if (existing) {
      await supabase.from('attendances').delete().eq('id', existing.id)
      attendances.value = attendances.value.filter(a => a.id !== existing.id)
      return true
    }
    const mt = meetings.value.find(m => m.id === meeting_id)
    const cnt = attendances.value.filter(a => a.meeting_id === meeting_id).length
    if (mt && cnt >= mt.capacity) return false
    const { data } = await supabase.from('attendances').insert({ meeting_id, member_id, team: null }).select().single()
    if (data) attendances.value.push(data)
    return true
  }

  function isAttending(meeting_id, member_id) {
    return attendances.value.some(a => a.meeting_id === meeting_id && a.member_id === member_id)
  }

  function attendCount(meeting_id) {
    return attendances.value.filter(a => a.meeting_id === meeting_id).length
  }

  async function assignTeams(meeting_id) {
    const atts = attendances.value.filter(a => a.meeting_id === meeting_id)
    const shuffled = [...atts].sort(() => Math.random() - 0.5)
    const updates = shuffled.map((a, i) => ({ ...a, team: i < Math.ceil(shuffled.length / 2) ? 'A' : 'B' }))
    await Promise.all(updates.map(a => supabase.from('attendances').update({ team: a.team }).eq('id', a.id)))
    updates.forEach(u => {
      const idx = attendances.value.findIndex(a => a.id === u.id)
      if (idx >= 0) attendances.value[idx] = { ...attendances.value[idx], team: u.team }
    })
  }

  async function saveScores(meeting_id, entries, total_fee) {
    const withNet = entries
      .map(e => ({ ...e, net: e.gross + (e.mulligan ? 1 : 0) - (e.handicap || 0) }))
      .sort((a, b) => a.net - b.net)
    const n = withNet.length
    const ratios = n <= 0 ? [] : n === 1 ? [1] : (() => {
      const raw = withNet.map((_, i) => 5 + 10 * (i / (n - 1)))
      const sum = raw.reduce((a, b) => a + b, 0)
      return raw.map(r => r / sum)
    })()

    await supabase.from('scores').delete().eq('meeting_id', meeting_id)
    scores.value = scores.value.filter(s => s.meeting_id !== meeting_id)

    const newScores = withNet.map((e, i) => ({
      meeting_id,
      member_id: e.member_id,
      gross: e.gross,
      mulligan: e.mulligan,
      net: e.net,
      rank: i + 1,
      ratio: ratios[i] || 0,
      fee_amount: total_fee ? Math.round(total_fee * (ratios[i] || 0) / 100) * 100 : null,
    }))

    const { data } = await supabase.from('scores').insert(newScores).select()
    if (data) scores.value.push(...data)

    await supabase.from('meetings').update({ total_fee, status: 'done' }).eq('id', meeting_id)
    const mt = meetings.value.find(m => m.id === meeting_id)
    if (mt) { mt.total_fee = total_fee; mt.status = 'done' }

    // 핸디 자동 재계산
    const participantIds = [...new Set(entries.map(e => e.member_id))]
    await Promise.all(participantIds.map(async memberId => {
      const allGross = scores.value.filter(s => s.member_id === memberId).map(s => s.gross)
      if (!allGross.length) return
      const avg = allGross.reduce((a, b) => a + b, 0) / allGross.length
      const newHc = Math.max(0, Math.round(avg - 72))
      await supabase.from('members').update({ handicap: newHc }).eq('id', memberId)
      const m = members.value.find(m => m.id === memberId)
      if (m) m.handicap = newHc
    }))
  }

  // 회비
  const transactions = ref([])
  const balance = computed(() =>
    transactions.value.reduce((sum, t) => sum + Number(t.income || 0) - Number(t.expense || 0), 0)
  )
  async function fetchTransactions() {
    const { data } = await supabase.from('transactions').select('*').order('date').order('id')
    transactions.value = data || []
  }
  async function updateTransactionMemo(id, memo) {
    await supabase.from('transactions').update({ memo }).eq('id', id)
    const t = transactions.value.find(t => t.id === id)
    if (t) t.memo = memo
  }

  const cumulativeRanking = computed(() => {
    const map = {}
    scores.value.forEach(s => {
      if (s.rank == null) return
      if (!map[s.member_id]) map[s.member_id] = { games: 0, points: 0, wins: 0 }
      map[s.member_id].games++
      map[s.member_id].points += Math.max(11 - s.rank, 1)
      if (s.rank === 1) map[s.member_id].wins++
    })
    return Object.entries(map)
      .map(([id, v]) => ({ id: Number(id), name: members.value.find(m => m.id === Number(id))?.name || '?', ...v }))
      .sort((a, b) => b.points - a.points)
  })

  const upcomingMeetings = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return meetings.value.filter(m => m.meet_date >= today && m.status !== 'done').sort((a, b) => a.meet_date.localeCompare(b.meet_date))
  })

  const doneMeetings = computed(() =>
    meetings.value.filter(m => m.status === 'done').sort((a, b) => b.meet_date.localeCompare(a.meet_date))
  )

  return {
    members, meetings, attendances, scores, loading,
    init,
    addMember, updateMember, deleteMember,
    addMeeting, deleteMeeting,
    toggleAttend, isAttending, attendCount,
    assignTeams, saveScores,
    transactions, balance, fetchTransactions, updateTransactionMemo,
    cumulativeRanking, upcomingMeetings, doneMeetings,
  }
})
