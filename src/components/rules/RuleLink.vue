<script setup>
// 규칙 화면에 붙이는 "근거 조항" 바로가기. 예: <RuleLink anchor="rule-2-2">세칙 2-2</RuleLink>
defineProps({ anchor: { type: String, required: true } })
</script>

<template>
  <RouterLink :to="{ path: '/rules', hash: `#${anchor}` }" class="rule-link">
    📖 근거 <slot />
  </RouterLink>
</template>

<style scoped>
.rule-link {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9db39e;
  border: 1px solid #2c4a33;
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
  text-decoration: none;
  white-space: nowrap;
  vertical-align: middle;
}
.rule-link:hover { color: #6fbf6f; border-color: #4e9a51; }
</style>
