<template>
  <nav class="nav">
    <RouterLink to="/" class="nav-brand">⛳ 아지트 스크린골프 모임</RouterLink>
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
  padding: 0 2rem;
  height: 60px;
  background: #0f1b12;
  border-bottom: 2px solid #2c4a33;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-brand {
  font-size: 1.1rem;
  font-weight: 800;
  color: #6fbf6f;
  text-decoration: none;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav-links a {
  text-decoration: none;
  color: #9db39e;
  font-size: 0.95rem;
  font-weight: 500;
}

.nav-links a.router-link-active {
  color: #6fbf6f;
  font-weight: 700;
}
</style>
