
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
  const productCount = adminState.designs.reduce((sum, d) => sum + (d.products || []).length, 0);
  document.getElementById('kpiDesigns').textContent = adminState.designs.length;
  document.getElementById('kpiActive').textContent = adminState.designs.filter(d => d.active).length;
  document.getElementById('kpiProducts').textContent = productCount;
  document.getElementById('kpiOrders').textContent = adminState.orders.length;
}

function renderDesignTable() {
  const tbody = document.getElementById('designTbody');
  tbody.innerHTML = '';
  adminState.designs.forEach(design => {
    const products = design.products || [];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${design.display_order}</td>
      <td>
        <strong>${escapeHtml(design.name)}</strong><br>
        <span class="small muted">${escapeHtml(design.source_url || '')}</span>
      </td>
      <td>${design.active ? '公開中' : '非公開'}</td>
      <td>${products.length}種類</td>
      <td>${products.slice(0, 3).map(p => escapeHtml(p.name)).join('<br>')}${products.length > 3 ? `<br><span class="muted small">ほか${products.length - 3}種類</span>` : ''}</td>
      <td>
        <div class="actions">
          <button class="ghost" data-edit="${design.id}">編集</button>
          <button class="ghost" data-scrape="${design.id}">型・色・サイズ取得</button>
          <button class="danger" data-delete="${design.id}">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => fillForm(Number(btn.dataset.edit))));
  tbody.querySelectorAll('[data-scrape]').forEach(btn => btn.addEventListener('click', () => scrapeProducts(Number(btn.dataset.scrape))));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteDesign(Number(btn.dataset.delete))));
}

function populateEditSelect() {
  const select = document.getElementById('editDesignSelect');
  const current = select.value;
  select.innerHTML = '<option value="">新規登録</option>';
  adminState.designs.forEach(design => {
    const option = document.createElement('option');
    option.value = design.id;
    option.textContent = `${design.display_order}. ${design.name}`;
    select.appendChild(option);
  });
  if (current) select.value = current;
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

async function fetchCurrentMeta() {
  const id = document.getElementById('designId').value;
  if (!id) {
    alert('先に既存デザインを選択してください。');
    return;
  }
  const res = await fetch(`/api/designs/${id}/fetch-meta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overwriteName: false, overwriteDescription: false })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || '取得できませんでした');
    return;
  }
  await loadAdminData();
  fillForm(Number(id));
  document.getElementById('saveMessage').textContent = 'URLから代表画像を取得しました。';
}

async function fetchAllMeta() {
  if (!confirm('全デザインのURLから代表画像を取得します。実行しますか？')) return;
  const res = await fetch('/api/designs/fetch-all-meta', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || '取得できませんでした');
    return;
  }
  await loadAdminData();
  const ok = data.results.filter(r => r.ok).length;
  const ng = data.results.filter(r => !r.ok).length;
  document.getElementById('saveMessage').textContent = `画像取得完了：成功 ${ok}件 / 失敗 ${ng}件`;
}

async function scrapeProducts(id) {
  const design = adminState.designs.find(d => d.id === id);
  if (!confirm(`${design?.name || 'このデザイン'} の型・色・サイズをTシャツトリニティから取得します。既存の型情報は上書きされます。実行しますか？`)) return;
  setBusy(true, '取得中です。商品ページを順番に読み込むため、30秒〜数分かかることがあります。');
  const res = await fetch(`/api/designs/${id}/scrape-products`, { method: 'POST' });
  const data = await res.json();
  setBusy(false);
  if (!res.ok) {
    alert(data.error || '取得できませんでした');
    return;
  }
  await loadAdminData();
  const ok = data.results.filter(r => r.ok).length;
  const ng = data.results.filter(r => !r.ok).length;
  document.getElementById('saveMessage').textContent = `取得完了：商品 ${data.found}件 / 成功 ${ok}件 / 失敗 ${ng}件`;
}

async function scrapeAllProducts() {
  if (!confirm('全デザインの型・色・サイズをTシャツトリニティから取得します。既存の型情報は上書きされます。かなり時間がかかる場合があります。実行しますか？')) return;
  setBusy(true, '全デザインを取得中です。商品ページを多数読み込むため、数分かかることがあります。');
  const res = await fetch('/api/designs/scrape-all-products', { method: 'POST' });
  const data = await res.json();
  setBusy(false);
  if (!res.ok) {
    alert(data.error || '取得できませんでした');
    return;
  }
  await loadAdminData();
  const okDesigns = data.results.filter(r => r.ok).length;
  const totalProducts = data.results.reduce((sum, r) => sum + (r.found || 0), 0);
  document.getElementById('saveMessage').textContent = `全取得完了：成功デザイン ${okDesigns}件 / 商品候補 ${totalProducts}件`;
}

function setBusy(isBusy, message = '') {
  const busy = document.getElementById('busyBox');
  if (!busy) return;
  busy.textContent = message;
  busy.classList.toggle('hidden', !isBusy);
}


async function deleteAllOrders() {
  const first = confirm('注文データをすべて削除します。テスト注文も本番注文も消えます。実行しますか？');
  if (!first) return;
  const second = confirm('本当に削除しますか？この操作は元に戻せません。');
  if (!second) return;

  const res = await fetch('/api/orders', { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || '削除できませんでした');
    return;
  }

  await loadAdminData();
  alert(`注文データを削除しました。削除件数：${data.deleted ?? 0}件`);
}

async function deleteOrder(id) {
  if (!confirm('この注文データを削除しますか？')) return;
  const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || '削除できませんでした');
    return;
  }
  await loadAdminData();
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
      <td>${escapeHtml(order.product_name || '')}</td>
      <td>${escapeHtml(order.color)}</td>
      <td>${escapeHtml(order.size)}</td>
      <td>${escapeHtml(order.note || '')}</td>
      <td><button class="danger small" data-delete-order="${order.id}">削除</button></td>
    `;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll('[data-delete-order]').forEach(btn => {
    btn.addEventListener('click', () => deleteOrder(Number(btn.dataset.deleteOrder)));
  });
}

function renderSummary(rows) {
  const tbody = document.getElementById('summaryTbody');
  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.design_name)}</td>
      <td>${escapeHtml(row.product_name || '')}</td>
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
      <td>${escapeHtml(row.product_name || '')}</td>
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
  document.getElementById('fetchCurrentMeta').addEventListener('click', fetchCurrentMeta);
  document.getElementById('fetchAllMeta').addEventListener('click', fetchAllMeta);
  document.getElementById('scrapeAllProducts').addEventListener('click', scrapeAllProducts);
  document.getElementById('deleteAllOrders').addEventListener('click', deleteAllOrders);
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
