// KEG Admin common utilities
const API = '';

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderPagination(container, pagination, onPageChange) {
  container.innerHTML = '';
  if (pagination.pages <= 1) return;

  for (let i = 1; i <= pagination.pages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === pagination.page) btn.classList.add('active');
    btn.onclick = () => onPageChange(i);
    container.appendChild(btn);
  }
}

async function checkAuth() {
  try {
    const data = await api('/api/me');
    if (!data.loggedIn) {
      window.location.href = '/admin/login.html';
    }
    return data;
  } catch {
    window.location.href = '/admin/login.html';
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}
