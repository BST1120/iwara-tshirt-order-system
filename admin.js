const adminState = {
  designs: [],
  orders: [],
  selectedDesignId: null,
};

async function loadAdminData() {
  const [designsRes, ordersRes, summaryRes] = await Promise.all([
    fetch('/api/designs?admin=1'),
    fetch('/api/orders'),
    fetch('/api/summary'),
  ]);
  adminState.designs = await designsRes.json();
  adminState.orders = await ordersRes.json();
  const summary = await summaryRes.json();

  renderKpis(summary);
  renderDesignTable();
  renderOrders(adminState.orders);
  renderSummary(summary.byVariant);
  renderNotes(summary.notes);
  populateEditSelect();
}

function renderKpis(summary) {
  document.getElementById('kpiDesigns').textContent = adminState.designs.length;
  document.getElementById('kpiActive').textContent = adminState.designs.filter(d => d.active).length;
  document.getElementById('kpiOrders').textContent = adminState.orders.length;
}

function renderDesignTable() {
  const tbody = document.getElementById('designTbody');
  tbody.innerHTML = '';
  adminState.designs.forEach(design => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${design.display_order}</td>
      <td>${escapeHtml(design.name)}</td>
      <td>${design.active ? '公開中' : '非公開'}</td>
      <td>${design.colors.map(c => c.name).join(', ')}</td>
      <td>${design.sizes.join(', ')}</td>
      <td>
        <div class="actions">
          <button class="ghost" data-edit="${design.id}">編集</button>
          <button class="danger" data-delete="${design.id}">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => fillForm(Number(btn.dataset.edit))));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteDesign(Number(btn.dataset.delete))));
}

function populateEditSelect() {
  const select = document.getElementById('editDesignSelect');
  select.innerHTML = '<option value="">新規登録</option>';
  adminState.designs.forEach(design => {
    const option = document.createElement('option');
    option.value = design.id;
    option.textContent = `${design.display_order}. ${design.name}`;
    select.appendChild(option);
  });
}

function fillForm(id) {
  const design = adminState.designs.find(d => d.id === id);
  if (!design) return;
  adminState.selectedDesignId = id;
  document.getElementById('editDesignSelect').value = String(id);
  document.getElementById('designId').value = design.id;
  document.getElementById('name').value = design.name || '';
  document.getElementById('source_url').value = design.source_url || '';
  document.getElementById('description').value = design.description || '';
  document.getElementById('design_image_url').value = design.design_image_url || '';
  document.getElementById('display_order').value = design.display_order || 0;
  document.getElementById('active').checked = !!design.active;
  document.getElementById('sizes').value = design.sizes.join(', ');
  document.getElementById('colors').value = design.colors.map(c => `${c.name}:${c.hex || ''}`).join(', ');
}

async function saveDesign(event) {
  event.preventDefault();
  const colors = document.getElementById('colors').value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => {
      const [name, hex] = v.split(':').map(x => x.trim());
      return { name, hex: hex || '#dddddd' };
    });
  const sizes = document.getElementById('sizes').value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const payload = {
    id: document.getElementById('designId').value || undefined,
    name: document.getElementById('name').value.trim(),
    source_url: document.getElementById('source_url').value.trim(),
    description: document.getElementById('description').value.trim(),
    design_image_url: document.getElementById('design_image_url').value.trim(),
    display_order: Number(document.getElementById('display_order').value || 0),
    active: document.getElementById('active').checked,
    colors,
    sizes,
  };

  const res = await fetch('/api/designs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || '保存できませんでした');
    return;
  }

  const fileInput = document.getElementById('design_image_file');
  if (fileInput.files[0]) {
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    await fetch(`/api/designs/${data.id}/upload`, { method: 'POST', body: formData });
  }

  document.getElementById('designForm').reset();
  document.getElementById('designId').value = '';
  adminState.selectedDesignId = null;
  await loadAdminData();
  document.getElementById('saveMessage').textContent = '保存しました。';
}

async function deleteDesign(id) {
  if (!confirm('このデザインを削除しますか？')) return;
  await fetch(`/api/designs/${id}`, { method: 'DELETE' });
  await loadAdminData();
}

function renderOrders(orders) {
  const tbody = document.getElementById('ordersTbody');
  tbody.innerHTML = '';
  orders.forEach(order => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(order.created_at)}</td>
      <td>${escapeHtml(order.staff_name)}</td>
      <td>${escapeHtml(order.department || '')}</td>
      <td>${escapeHtml(order.design_name)}</td>
      <td>${escapeHtml(order.color)}</td>
      <td>${escapeHtml(order.size)}</td>
      <td>${escapeHtml(order.note || '')}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderSummary(rows) {
  const tbody = document.getElementById('summaryTbody');
  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.design_name)}</td>
      <td>${escapeHtml(row.color)}</td>
      <td>${escapeHtml(row.size)}</td>
      <td>${row.total}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderNotes(rows) {
  const tbody = document.getElementById('notesTbody');
  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.staff_name)}</td>
      <td>${escapeHtml(row.design_name)}</td>
      <td>${escapeHtml(row.note)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

document.addEventListener('DOMContentLoaded', () => {
  loadAdminData();
  document.getElementById('designForm').addEventListener('submit', saveDesign);
  document.getElementById('editDesignSelect').addEventListener('change', e => {
    if (!e.target.value) {
      document.getElementById('designForm').reset();
      document.getElementById('designId').value = '';
      adminState.selectedDesignId = null;
      return;
    }
    fillForm(Number(e.target.value));
  });
});
