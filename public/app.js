
const state = {
  designs: [],
  selectedDesign: null,
  selectedProduct: null,
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
    const products = design.products || [];
    const primary = products[0] || null;
    const colors = uniqueColors(products.length ? products.flatMap(p => p.colors || []) : (design.colors || []));
    const sizes = uniqueSizes(products.length ? products.flatMap(p => p.sizes || []) : (design.sizes || []));

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="preview-wrap">${renderPreview(design, primary, colors[0])}</div>
      <div class="card-body">
        <h3>${escapeHtml(design.name)}</h3>
        <p>${products.length ? `${products.length}種類の型から選択できます。` : '型・色・サイズ情報を管理画面から取得してください。'}</p>
        <div class="label-row">
          <span>型</span>
          <span>${products.slice(0, 3).map(p => escapeHtml(p.name)).join(' / ') || '未取得'}</span>
        </div>
        <div class="label-row">
          <span>色</span>
          ${colors.slice(0, 8).map(c => `<span class="swatch"><span class="swatch-chip" style="background:${c.hex || '#ddd'}"></span>${escapeHtml(c.name)}</span>`).join('')}
          ${colors.length > 8 ? `<span class="muted small">ほか${colors.length - 8}色</span>` : ''}
        </div>
        <div class="label-row">
          <span>サイズ</span>
          ${sizes.slice(0, 8).map(size => `<span class="button secondary small">${escapeHtml(size)}</span>`).join('')}
          ${sizes.length > 8 ? `<span class="muted small">ほか${sizes.length - 8}サイズ</span>` : ''}
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
  state.selectedProduct = design?.products?.[0] || null;
  state.selectedColor = state.selectedProduct?.colors?.[0]?.name || null;

  document.getElementById('designSelect').value = design ? String(design.id) : '';
  updateProductSelector();
  updateVariantSelectors();
  updatePreviewPane();
  if (scroll) document.getElementById('orderSection').scrollIntoView({ behavior: 'smooth' });
}

function updateProductSelector() {
  const productSelect = document.getElementById('productSelect');
  productSelect.innerHTML = '<option value="">型を選択</option>';

  if (!state.selectedDesign) return;
  const products = state.selectedDesign.products || [];
  products.forEach(product => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = product.name;
    productSelect.appendChild(option);
  });

  if (state.selectedProduct) productSelect.value = String(state.selectedProduct.id);

  if (!products.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '型情報が未取得です。管理者に確認してください。';
    productSelect.appendChild(option);
  }
}

function selectProduct(id) {
  if (!state.selectedDesign) return;
  state.selectedProduct = (state.selectedDesign.products || []).find(p => p.id === id) || null;
  state.selectedColor = state.selectedProduct?.colors?.[0]?.name || null;
  updateVariantSelectors();
  updatePreviewPane();
}

function updateVariantSelectors() {
  const colorSelect = document.getElementById('colorSelect');
  const sizeSelect = document.getElementById('sizeSelect');
  colorSelect.innerHTML = '<option value="">色を選択</option>';
  sizeSelect.innerHTML = '<option value="">サイズを選択</option>';

  if (!state.selectedProduct) return;

  (state.selectedProduct.colors || []).forEach((color, idx) => {
    const option = document.createElement('option');
    option.value = color.name;
    option.textContent = color.name;
    option.dataset.hex = color.hex || '#ddd';
    colorSelect.appendChild(option);
    if (idx === 0) state.selectedColor = color.name;
  });
  (state.selectedProduct.sizes || []).forEach(size => {
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
  const colorObj = state.selectedProduct?.colors?.find(c => c.name === state.selectedColor) || state.selectedProduct?.colors?.[0] || state.selectedDesign.colors?.[0];
  preview.innerHTML = renderPreview(state.selectedDesign, state.selectedProduct, colorObj);

  const link = document.getElementById('productSourceLink');
  if (link) {
    if (state.selectedProduct?.source_url) {
      link.href = state.selectedProduct.source_url;
      link.textContent = '選択中商品の元ページを見る';
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
  }
}

function renderPreview(design, product, colorObj) {
  const image = product?.image_url || design.design_image_url;
  const label = product?.name || design.name;
  if (image) {
    return `
      <div class="mockup-box">
        <img class="mockup-image" src="${image}" alt="${escapeHtml(label)}" />
      </div>
    `;
  }

  const color = colorObj || { name: 'ホワイト', hex: '#f5f5f5' };
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
  const productId = Number(document.getElementById('productSelect').value);
  const payload = {
    staff_name: document.getElementById('staffName').value.trim(),
    department: document.getElementById('department').value.trim(),
    design_id: designId,
    product_id: productId,
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
  state.selectedProduct = null;
  state.selectedColor = null;
  updateProductSelector();
  updateVariantSelectors();
  updatePreviewPane();
}

function uniqueColors(colors) {
  const seen = new Set();
  const out = [];
  (colors || []).forEach(c => {
    if (!c?.name || seen.has(c.name)) return;
    seen.add(c.name);
    out.push(c);
  });
  return out;
}

function uniqueSizes(sizes) {
  const order = ['80','90','100','110','120','130','140','150','160','WM','WL','XS','S','M','L','XL','XXL','XXXL','4XL','5XL'];
  const set = new Set((sizes || []).filter(Boolean));
  return order.filter(s => set.has(s)).concat([...set].filter(s => !order.includes(s)));
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

function contrastColor(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.substring(0,2), 16) || 255;
  const g = parseInt(full.substring(2,4), 16) || 255;
  const b = parseInt(full.substring(4,6), 16) || 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? '#222' : '#fff';
}

document.addEventListener('DOMContentLoaded', () => {
  fetchDesigns();
  document.getElementById('designSelect').addEventListener('change', e => selectDesign(Number(e.target.value)));
  document.getElementById('productSelect').addEventListener('change', e => selectProduct(Number(e.target.value)));
  document.getElementById('colorSelect').addEventListener('change', e => { state.selectedColor = e.target.value; updatePreviewPane(); });
  document.getElementById('orderForm').addEventListener('submit', submitOrder);
});
