const state = {
  designs: [],
  selectedDesign: null,
  selectedColor: null,
};

async function fetchDesigns() {
  const res = await fetch('/api/designs');
  state.designs = await res.json();
  renderDesignGrid();
  populateDesignSelect();
}

function renderDesignGrid() {
  const grid = document.getElementById('designGrid');
  grid.innerHTML = '';
  state.designs.forEach(design => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="preview-wrap">${renderPreview(design, design.colors?.[0])}</div>
      <div class="card-body">
        <h3>${escapeHtml(design.name)}</h3>
        <p>${escapeHtml(design.description || 'Tシャツトリニティ掲載デザイン')}</p>
        <div class="label-row">
          <span>色</span>
          ${design.colors.map(c => `<span class="swatch"><span class="swatch-chip" style="background:${c.hex || '#ddd'}"></span>${escapeHtml(c.name)}</span>`).join('')}
        </div>
        <div class="label-row">
          <span>サイズ</span>
          ${design.sizes.map(size => `<span class="button secondary small">${escapeHtml(size)}</span>`).join('')}
        </div>
        <div class="actions" style="margin-top:12px">
          <button data-select-id="${design.id}">このデザインを選ぶ</button>
          <a class="button secondary" href="${design.source_url}" target="_blank" rel="noopener">元ページを見る</a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-select-id]').forEach(btn => {
    btn.addEventListener('click', () => selectDesign(Number(btn.dataset.selectId), true));
  });
}

function populateDesignSelect() {
  const select = document.getElementById('designSelect');
  select.innerHTML = '<option value="">デザインを選択</option>';
  state.designs.forEach(design => {
    const option = document.createElement('option');
    option.value = design.id;
    option.textContent = design.name;
    select.appendChild(option);
  });
}

function selectDesign(id, scroll = false) {
  const design = state.designs.find(d => d.id === id);
  state.selectedDesign = design || null;
  document.getElementById('designSelect').value = design ? String(design.id) : '';
  updateVariantSelectors();
  updatePreviewPane();
  if (scroll) document.getElementById('orderSection').scrollIntoView({ behavior: 'smooth' });
}

function updateVariantSelectors() {
  const colorSelect = document.getElementById('colorSelect');
  const sizeSelect = document.getElementById('sizeSelect');
  colorSelect.innerHTML = '<option value="">色を選択</option>';
  sizeSelect.innerHTML = '<option value="">サイズを選択</option>';

  if (!state.selectedDesign) return;
  state.selectedDesign.colors.forEach((color, idx) => {
    const option = document.createElement('option');
    option.value = color.name;
    option.textContent = color.name;
    option.dataset.hex = color.hex || '#ddd';
    colorSelect.appendChild(option);
    if (idx === 0) state.selectedColor = color.name;
  });
  state.selectedDesign.sizes.forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    sizeSelect.appendChild(option);
  });
}

function updatePreviewPane() {
  const preview = document.getElementById('selectedPreview');
  if (!state.selectedDesign) {
    preview.innerHTML = '<div class="muted">デザインを選ぶと、ここにプレビューが表示されます。</div>';
    return;
  }
  const colorObj = state.selectedDesign.colors.find(c => c.name === state.selectedColor) || state.selectedDesign.colors[0];
  preview.innerHTML = renderPreview(state.selectedDesign, colorObj);
}

function renderPreview(design, colorObj) {
  const color = colorObj || { name: 'ホワイト', hex: '#f5f5f5' };
  if (design.design_image_url) {
    return `
      <div class="shirt" style="background:${color.hex || '#f5f5f5'};">
        <div class="shirt-neck"></div>
        <img class="design-art" src="${design.design_image_url}" alt="${escapeHtml(design.name)}" />
      </div>
    `;
  }
  return `
    <div class="shirt" style="background:${color.hex || '#f5f5f5'}; color:${contrastColor(color.hex || '#f5f5f5')}">
      <div class="shirt-neck"></div>
      <div class="placeholder-art">${escapeHtml(design.name).replace(/ /g, '<br>')}</div>
    </div>
  `;
}

async function submitOrder(event) {
  event.preventDefault();
  const designId = Number(document.getElementById('designSelect').value);
  const payload = {
    staff_name: document.getElementById('staffName').value.trim(),
    department: document.getElementById('department').value.trim(),
    design_id: designId,
    color: document.getElementById('colorSelect').value,
    size: document.getElementById('sizeSelect').value,
    note: document.getElementById('note').value.trim(),
  };

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  const box = document.getElementById('resultBox');
  if (!res.ok) {
    box.innerHTML = `<span style="color:#c62828;font-weight:700">送信できませんでした：</span> ${escapeHtml(result.error || '不明なエラー')}`;
    return;
  }
  box.innerHTML = `<span class="success">注文内容を送信しました。</span> 管理者が集計して発注します。`;
  document.getElementById('orderForm').reset();
  state.selectedDesign = null;
  state.selectedColor = null;
  updateVariantSelectors();
  updatePreviewPane();
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

function contrastColor(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.substring(0,2), 16);
  const g = parseInt(full.substring(2,4), 16);
  const b = parseInt(full.substring(4,6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? '#222' : '#fff';
}

document.addEventListener('DOMContentLoaded', () => {
  fetchDesigns();
  document.getElementById('designSelect').addEventListener('change', e => selectDesign(Number(e.target.value)));
  document.getElementById('colorSelect').addEventListener('change', e => { state.selectedColor = e.target.value; updatePreviewPane(); });
  document.getElementById('orderForm').addEventListener('submit', submitOrder);
});
