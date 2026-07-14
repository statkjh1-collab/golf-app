<script setup>
import { computed, onMounted } from 'vue'
import { useGolfStore } from '@/stores/golf'

const store = useGolfStore()
onMounted(() => store.fetchTransactions())

// 날짜(모임)별로 묶어서 요약
const summaryRows = computed(() => {
  const sorted = [...store.transactions] // 오래된 순(ASC)

  // 메모 기준으로 그룹핑
  const groups = {}
  sorted.forEach(t => {
    const key = t.memo || t.description || t.date
    if (!groups[key]) groups[key] = { date: t.date, label: key, income: 0, expense: 0 }
    if (t.date > groups[key].date) groups[key].date = t.date
    groups[key].income += Number(t.income || 0)
    groups[key].expense += Number(t.expense || 0)
  })

  // 오래된 순으로 누적 잔액 계산 후 최신순으로 표시
  let running = 0
  const withBalance = Object.values(groups).map(g => {
    running += g.income - g.expense
    return { ...g, balance: running }
  })
  return withBalance.reverse()
})
</script>

<template>
  <main class="page">
    <h1>회비 현황</h1>

    <div class="card balance-card">
      <p class="dim">현재 잔액</p>
      <div class="balance-amount" :style="{ color: store.balance >= 0 ? '#4caf7d' : '#e57373' }">
        {{ store.balance.toLocaleString() }}원
      </div>
    </div>

    <div class="card">
      <h2>주차별 요약</h2>
      <p v-if="!summaryRows.length" class="dim">내역이 없습니다.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>내용</th>
              <th>수입</th>
              <th>지출</th>
              <th>잔액</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in summaryRows" :key="r.date + r.label">
              <td class="td-date">{{ r.date?.slice(5).replace('-', '/') }}</td>
              <td class="td-desc">{{ r.label }}</td>
              <td class="td-income">{{ r.income ? r.income.toLocaleString() : '' }}</td>
              <td class="td-expense">{{ r.expense ? r.expense.toLocaleString() : '' }}</td>
              <td class="td-balance" :style="{ color: r.balance >= 0 ? '#4caf7d' : '#e57373' }">
                {{ r.balance.toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page { max-width: 640px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
h1 { font-size: 1.6rem; font-weight: 700; color: #eaf2e6; margin-bottom: 1.25rem; }
h2 { font-size: 1rem; font-weight: 600; color: #9db39e; margin: 0 0 1rem; }
.card { background: #1a2e1f; border: 1px solid #2c4a33; border-radius: 14px; padding: 1.25rem; margin-bottom: 1rem; }
.dim { color: #9db39e; font-size: 0.875rem; margin: 0; }

.balance-card { text-align: center; }
.balance-amount { font-size: 2.2rem; font-weight: 700; margin-top: 0.5rem; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { text-align: left; color: #9db39e; font-weight: 600; padding: 0.5rem 0.5rem; border-bottom: 1px solid #2c4a33; white-space: nowrap; }
td { padding: 0.65rem 0.5rem; border-bottom: 1px solid #1d3324; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
.td-date { color: #9db39e; white-space: nowrap; }
.td-desc { color: #eaf2e6; }
.td-income { color: #4caf7d; font-weight: 600; text-align: right; white-space: nowrap; }
.td-expense { color: #e8543e; font-weight: 600; text-align: right; white-space: nowrap; }
.td-balance { font-weight: 700; text-align: right; white-space: nowrap; }
</style>
