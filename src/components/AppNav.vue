<template>
  <nav class="nav">
    <RouterLink to="/" class="nav-brand">
      <span class="brand-full">⛳ 아지트 스크린골프 모임</span>
      <span class="brand-short">⛳ 아지트</span>
    </RouterLink>
    <div class="nav-links">
      <RouterLink to="/schedule">일정·참석</RouterLink>
      <RouterLink to="/ranking">순위표</RouterLink>
      <RouterLink to="/admin">관리자</RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  height: 56px;
  background: #0f1b12;
  border-bottom: 2px solid #2c4a33;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-brand {
  font-weight: 800;
  color: #6fbf6f;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.brand-full { font-size: 1.05rem; }
.brand-short { display: none; font-size: 1.05rem; }

.nav-links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

.nav-links a {
  text-decoration: none;
  color: #9db39e;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
}

.nav-links a.router-link-active {
  color: #6fbf6f;
  font-weight: 700;
}

@media (max-width: 480px) {
  .nav { padding: 0 1rem; }
  .brand-full { display: none; }
  .brand-short { display: inline; }
  .nav-links { gap: 1rem; }
  .nav-links a { font-size: 0.85rem; }
}
</style>
