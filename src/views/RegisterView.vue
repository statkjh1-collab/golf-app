<script setup>
import { ref } from 'vue'
import { useGolfStore } from '@/stores/golf'

const store = useGolfStore()
const name = ref('')
const done = ref(false)
const errMsg = ref('')

function register() {
  const trimmed = name.value.trim()
  if (!trimmed) { errMsg.value = '이름을 입력해 주세요.'; return }
  if (store.members.some(m => m.name === trimmed)) {
    errMsg.value = '이미 등록된 이름이에요.'; return
  }
  store.addMember(trimmed, 0)
  done.value = true
  errMsg.value = ''
}

function reset() {
  name.value = ''
  done.value = false
}
</script>

<template>
  <main class="page">
    <div class="card">
      <div class="icon">⛳</div>
      <h1>회원 등록</h1>
      <p class="sub">아지트 스크린골프 모임에 오신 걸 환영해요!<br>이름을 입력하면 바로 등록됩니다.</p>

      <template v-if="!done">
        <input v-model="name" placeholder="이름 (실명)" @keydown.enter="register" />
        <p v-if="errMsg" class="error">{{ errMsg }}</p>
        <button class="btn" @click="register">등록하기</button>
        <p class="hint">핸디캡은 첫 경기 후 스코어 결과에서 자동으로 계산돼요.</p>
      </template>

      <template v-else>
        <div class="success-box">
          <div class="check">✓</div>
          <p><b>{{ store.members[store.members.length - 1]?.name }}</b> 님, 등록 완료!</p>
          <p class="sub2">핸디캡은 경기를 마치면 자동으로 업데이트됩니다.</p>
        </div>
        <button class="btn-ghost" @click="reset">다른 이름으로 등록</button>
      </template>

      <div class="member-list" v-if="store.members.length">
        <p class="list-title">현재 회원 ({{ store.members.length }}명)</p>
        <div v-for="m in store.members" :key="m.id" class="member-row">
          <span>{{ m.name }}</span>
          <span class="hc">{{ m.handicap > 0 ? `핸디 ${m.handicap}` : '핸디 미정' }}</span>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page { max-width: 480px; margin: 0 auto; padding: 2rem 1.5rem; }

.card {
  background: #16271a;
  border: 1px solid #2c4a33;
  border-radius: 14px;
  padding: 2rem 1.5rem;
}

.icon { font-size: 2.5rem; text-align: center; margin-bottom: 0.5rem; }

h1 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #eaf2e6;
  text-align: center;
  margin: 0 0 0.5rem;
}

.sub {
  color: #9db39e;
  font-size: 0.875rem;
  text-align: center;
  line-height: 1.6;
  margin: 0 0 1.5rem;
}

input {
  width: 100%;
  background: #0f1b12;
  border: 1px solid #2c4a33;
  border-radius: 8px;
  padding: 0.7rem 0.85rem;
  color: #eaf2e6;
  font-size: 1rem;
  box-sizing: border-box;
}

.btn {
  display: block;
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.7rem;
  background: #4e9a51;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}
.btn:hover { background: #3d7a40; }

.btn-ghost {
  display: block;
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.65rem;
  background: transparent;
  border: 1px solid #2c4a33;
  color: #9db39e;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.error { color: #e8543e; font-size: 0.85rem; margin: 0.4rem 0 0; }

.hint {
  color: #9db39e;
  font-size: 0.78rem;
  text-align: center;
  margin: 0.75rem 0 0;
}

.success-box {
  text-align: center;
  padding: 1.25rem 0;
}
.check {
  width: 48px; height: 48px;
  background: #4e9a51;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; color: #fff;
  margin: 0 auto 0.75rem;
}
.success-box p { color: #eaf2e6; margin: 0.25rem 0; font-size: 1rem; }
.sub2 { color: #9db39e; font-size: 0.82rem; }

.member-list {
  margin-top: 1.5rem;
  border-top: 1px solid #2c4a33;
  padding-top: 1rem;
}
.list-title { color: #9db39e; font-size: 0.8rem; margin: 0 0 0.5rem; font-weight: 600; }
.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0;
  border-top: 1px solid #1d3324;
  font-size: 0.875rem;
  color: #eaf2e6;
}
.hc { color: #9db39e; font-size: 0.78rem; }
</style>
