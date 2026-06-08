
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

    const card = document.createElement('div');
    card.className = 'card design-card';
    card.dataset.designId = design.id;
    card.innerHTML = `
      <div class="preview-wrap">${renderPreview(design, primary, primary?.colors?.[0])}</div>
      <div class="card-body">
        <h3>${escapeHtml(design.name)}</h3>
        <p>${products.length ? `${products.length}種類の型から選択できます。型・色・サイズを確認してから注文できます。` : '型・色・サイズ情報を管理画面から取得してください。'}</p>

        <div class="field compact-field">
          <label>型を確認</label>
          <select class="card-product-select" data-card-product="${design.id}">
            ${products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('') || '<option value="">未取得</option>'}
          </select>
        </div>

        <div class="card-variant-info" data-card-info="${design.id}">
          ${renderVariantInfo(primary)}
        </div>

        <div class="selected-summary muted small" data-card-summary="${design.id}">
          ${renderSelectedSummary(primary, primary?.colors?.[0]?.name || '', primary?.sizes?.[0] || '')}
        </div>

        <div class="actions" style="margin-top:12px">
          <button data-select-id="${design.id}">この内容で注文フォームへ</button>
          <a class="button secondary" href="${design.source_url}" target="_blank" rel="noopener">元ページを見る</a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-select-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.design-card');
      const designId = Number(btn.dataset.selectId);
      const productId = Number(card.querySelector('.card-product-select')?.value || 0);
      const color = card.querySelector('.card-color-select')?.value || '';
      const size = card.querySelector('.card-size-select')?.value || '';
      selectDesign(designId, true, { productId, color, size });
    });
  });

  grid.querySelectorAll('[data-card-product]').forEach(select => {
    select.addEventListener('change', () => {
      const designId = Number(select.dataset.cardProduct);
      const design = state.designs.find(d => d.id === designId);
      const product = (design?.products || []).find(p => String(p.id) === String(select.value)) || null;
      const card = select.closest('.design-card');
      const preview = card.querySelector('.preview-wrap');
      const info = card.querySelector(`[data-card-info="${designId}"]`);
      const summary = card.querySelector(`[data-card-summary="${designId}"]`);

      preview.innerHTML = renderPreview(design, product, product?.colors?.[0]);
      info.innerHTML = renderVariantInfo(product);
      summary.innerHTML = renderSelectedSummary(product, product?.colors?.[0]?.name || '', product?.sizes?.[0] || '');
      attachCardVariantEvents(card, design, product);
    });
  });

  grid.querySelectorAll('.design-card').forEach(card => {
    const designId = Number(card.dataset.designId);
    const design = state.designs.find(d => d.id === designId);
    const product = design?.products?.[0] || null;
    attachCardVariantEvents(card, design, product);
  });
}

function attachCardVariantEvents(card, design, product) {
  const colorSelect = card.querySelector('.card-color-select');
  const sizeSelect = card.querySelector('.card-size-select');
  const summary = card.querySelector(`[data-card-summary="${design?.id}"]`);
  const update = () => {
    if (!summary) return;
    summary.innerHTML = renderSelectedSummary(product, colorSelect?.value || '', sizeSelect?.value || '');
  };
  if (colorSelect) colorSelect.addEventListener('change', update);
  if (sizeSelect) sizeSelect.addEventListener('change', update);
}

function renderVariantInfo(product) {
  if (!product) {
    return `<div class="muted small">型情報が未取得です。管理画面から取得してください。</div>`;
  }
  return `
    <div class="form-grid card-mini-grid">
      <div class="field compact-field">
        <label>選択できるカラー</label>
        <select class="card-color-select">
          ${(product.colors || []).map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('') || '<option value="">未取得</option>'}
        </select>
      </div>
      <div class="field compact-field">
        <label>選択できるサイズ</label>
        <select class="card-size-select">
          ${(product.sizes || []).map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('') || '<option value="">未取得</option>'}
        </select>
      </div>
    </div>
  `;
}

function renderSelectedSummary(product, color, size) {
  if (!product) return '';
  return `選択中：${escapeHtml(product.name)} / ${escapeHtml(color || 'カラー未選択')} / ${escapeHtml(size || 'サイズ未選択')}`;
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

function selectDesign(id, scroll = false, preset = {}) {
  const design = state.designs.find(d => d.id === id);
  state.selectedDesign = design || null;
  state.selectedProduct =
    (design?.products || []).find(p => Number(p.id) === Number(preset.productId)) ||
    design?.products?.[0] ||
    null;
  state.selectedColor = preset.color || state.selectedProduct?.colors?.[0]?.name || null;

  document.getElementById('designSelect').value = design ? String(design.id) : '';
  updateProductSelector();
  updateVariantSelectors();

  if (state.selectedProduct) {
    document.getElementById('productSelect').value = String(state.selectedProduct.id);
  }
  if (preset.color) {
    document.getElementById('colorSelect').value = preset.color;
    state.selectedColor = preset.color;
  }
  if (preset.size) {
    document.getElementById('sizeSelect').value = preset.size;
  }

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

function renderPreviewGallery(design, product) {
  const images = [];
  if (design?.design_image_url) images.push({ url: design.design_image_url, label: 'デザイン' });
  (product?.images || []).forEach((img, idx) => {
    if (!img?.url) return;
    if (images.some(i => i.url === img.url)) return;
    const fallback = idx === 0 ? '表' : idx === 1 ? '裏' : `画像${idx + 1}`;
    images.push({ url: img.url, label: img.label || fallback });
  });
  if (product?.image_url && !images.some(i => i.url === product.image_url)) {
    images.push({ url: product.image_url, label: '商品画像' });
  }

  const shown = images.slice(0, 3);
  if (!shown.length) return renderPreview(design, product, product?.colors?.[0]);

  return `
    <div class="triple-preview">
      ${shown.map((img, idx) => `
        <div class="mini-preview">
          <div class="mini-label">${escapeHtml(idx === 0 ? 'デザイン' : idx === 1 ? '表' : '裏')}</div>
          <img src="${img.url}" alt="${escapeHtml(img.label || design.name)}" />
        </div>
      `).join('')}
    </div>
  `;
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
