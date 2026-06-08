
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { run, all, get, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `design_${req.params.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

function safeJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function decodeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function absoluteUrl(src, baseUrl) {
  try {
    if (!src) return '';
    return new URL(src, baseUrl).toString();
  } catch {
    return src || '';
  }
}

async function fetchHtml(url) {
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error('有効なURLを入力してください');
  }
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; IwaraTshirtOrderBot/1.0)',
      'accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`ページ取得に失敗しました: ${response.status}`);
  return await response.text();
}

function readMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeHtml(match[1]);
  }
  return '';
}

function pickMeta(html, baseUrl) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = readMeta(html, 'og:title') || (titleMatch ? decodeHtml(titleMatch[1].trim()) : '');
  const description = readMeta(html, 'og:description') || readMeta(html, 'description');
  const image = readMeta(html, 'og:image') || readMeta(html, 'twitter:image') || readMeta(html, 'twitter:image:src') || '';
  return {
    title: title.replace(/\|デザインTシャツ通販.*$/, '').trim(),
    description: description.trim(),
    image: absoluteUrl(image, baseUrl),
  };
}

const COLOR_NAMES = [
  'ホワイト','ブラック','ネイビー','グレー','杢グレー','ミックスグレー','アッシュ','オートミール','アイボリー','ナチュラル',
  'ベビーピンク','ライトピンク','ピンク','ホットピンク','レッド','バーガンディ','ワイン','オレンジ','イエロー','デイジー',
  'ライトイエロー','ライム','ライムグリーン','グリーン','フォレスト','オリーブ','カーキ','ミント','アクア','ターコイズ',
  'ライトブルー','サックス','ブルー','ロイヤルブルー','インディゴ','パープル','ラベンダー','ブラウン','チョコレート',
  'チャコール','スミ','サンド','ベージュ','シルバー','ゴールド'
];

const COLOR_HEX = {
  'ホワイト':'#f7f7f7','ブラック':'#222222','ネイビー':'#20324a','グレー':'#9aa0a6','杢グレー':'#a7adb4',
  'ミックスグレー':'#9aa0a6','アッシュ':'#d9dcdf','オートミール':'#ddd1bd','アイボリー':'#f3ead8','ナチュラル':'#efe3c8',
  'ベビーピンク':'#f7c4d8','ライトピンク':'#f3a6c5','ピンク':'#e76f9f','ホットピンク':'#d93175','レッド':'#c62828',
  'バーガンディ':'#6f1d2e','ワイン':'#7b1e35','オレンジ':'#ef7d22','イエロー':'#ffd54f','デイジー':'#ffd42a',
  'ライトイエロー':'#fff3a3','ライム':'#a8d64f','ライムグリーン':'#91c84a','グリーン':'#2e7d32','フォレスト':'#17452f',
  'オリーブ':'#6f7d3c','カーキ':'#7a704f','ミント':'#9adbc8','アクア':'#6fd3dd','ターコイズ':'#2ca6a4',
  'ライトブルー':'#90caf9','サックス':'#8ecae6','ブルー':'#1565c0','ロイヤルブルー':'#1f4fa3','インディゴ':'#243b6b',
  'パープル':'#6a3fa0','ラベンダー':'#b69bd6','ブラウン':'#6d4c41','チョコレート':'#4b2f2a','チャコール':'#4b4f54',
  'スミ':'#363636','サンド':'#cdbb91','ベージュ':'#c9b693','シルバー':'#cfd4d9','ゴールド':'#d4af37'
};

const SIZE_ORDER = ['80','90','100','110','120','130','140','150','160','WM','WL','XS','S','M','L','XL','XXL','XXXL','4XL','5XL'];

function uniqueByName(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = typeof item === 'string' ? item : item.name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function orderSizes(sizes) {
  const set = new Set(sizes);
  return SIZE_ORDER.filter(s => set.has(s)).concat([...set].filter(s => !SIZE_ORDER.includes(s)));
}

function extractColors(html) {
  const found = [];
  const altRegex = /alt=["']([^"']+)["']/gi;
  let match;
  while ((match = altRegex.exec(html))) {
    const alt = decodeHtml(match[1]);
    for (const name of COLOR_NAMES) {
      if (alt === name || alt.includes(name)) {
        found.push({ name, hex: COLOR_HEX[name] || '#dddddd' });
      }
    }
  }

  const text = stripTags(html);
  for (const name of COLOR_NAMES) {
    if (text.includes(name)) found.push({ name, hex: COLOR_HEX[name] || '#dddddd' });
  }

  return uniqueByName(found);
}

function extractSizes(html, productName = '') {
  const text = stripTags(html);
  const found = [];

  // まず、サイズ選択の近くだけを見る。ページ全体を見ると、別商品の80/90/100などを拾ってしまうため。
  const markers = ['サイズ選択', 'サイズを選択', 'サイズ', 'Size'];
  let contexts = [];

  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0) {
      // 「サイズ選択」から、数量・カート・説明欄などに入る前までを候補にする
      let context = text.slice(index, index + 500);
      const stopWords = ['数量', 'カート', '購入', '素材', '仕様', '商品説明', 'この商品について', '注意事項', 'サイズ表'];
      let stop = context.length;
      for (const word of stopWords) {
        const pos = context.indexOf(word, marker.length);
        if (pos > 0 && pos < stop) stop = pos;
      }
      context = context.slice(0, stop);
      contexts.push(context);
    }
  }

  // HTMLのselect / optionにサイズがある場合もあるため、optionだけを優先的に見る
  const optionMatches = [...html.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)].map(m => stripTags(m[1]));
  if (optionMatches.length) {
    contexts.unshift(optionMatches.join(' '));
  }

  const target = contexts.join(' ');
  for (const size of SIZE_ORDER) {
    const pattern = new RegExp(`(^|\\s|　|>)${size}($|\\s|　|<|サイズ|cm)`);
    if (pattern.test(target)) found.push(size);
  }

  let ordered = orderSizes(found);

  // 取得できなかった場合のみ、商品型ごとの安全な既定値にする
  if (!ordered.length) {
    ordered = defaultSizesForProduct(productName);
  }

  // 商品型に応じて、ありえないサイズを除外する。
  // 例：ビッグシルエットTシャツに80/90/100が混ざる問題を防ぐ。
  return filterSizesByProductName(ordered, productName);
}

function defaultSizesForProduct(productName = '') {
  if (/キッズ|ベビー|幼児|子供|こども/i.test(productName)) {
    return ['80', '90', '100', '110', '120', '130', '140', '150'];
  }
  if (/レディース|ウィメンズ/i.test(productName)) {
    return ['WM', 'WL'];
  }
  if (/ビッグ|スーパーヘビー|ヘビー|USA|オーガニック|ハイグレード|スタンダード|ライトウェイト|ドライ|ロング|プレミアム|Tシャツ|ポロシャツ/i.test(productName)) {
    return ['S', 'M', 'L', 'XL'];
  }
  if (/缶バッジ|キーホルダー|アクリル|ステッカー/i.test(productName)) {
    return ['FREE'];
  }
  return ['S', 'M', 'L', 'XL'];
}

function filterSizesByProductName(sizes, productName = '') {
  const name = String(productName || '');

  if (/缶バッジ|キーホルダー|アクリル|ステッカー/i.test(name)) {
    return ['FREE'];
  }

  if (/キッズ|ベビー|幼児|子供|こども/i.test(name)) {
    const allowed = new Set(['80','90','100','110','120','130','140','150','160']);
    return sizes.filter(s => allowed.has(s));
  }

  if (/レディース|ウィメンズ/i.test(name)) {
    const allowed = new Set(['WM','WL','S','M','L']);
    return sizes.filter(s => allowed.has(s));
  }

  // 大人用・ビッグシルエット・一般Tシャツは子どもサイズを除外
  if (/ビッグ|スーパーヘビー|ヘビー|USA|オーガニック|ハイグレード|スタンダード|ライトウェイト|ドライ|ロング|プレミアム|Tシャツ|ポロシャツ|パーカー|スウェット/i.test(name)) {
    const childSizes = new Set(['80','90','100','110','120','130','140','150','160']);
    const filtered = sizes.filter(s => !childSizes.has(s));
    return filtered.length ? filtered : defaultSizesForProduct(name);
  }

  return sizes;
}

function extractProductLinksFromDesignPage(html, baseUrl, designName) {
  const links = [];
  const regex = /<a[^>]+href=["']([^"']*\/product\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const href = absoluteUrl(match[1], baseUrl);
    const text = stripTags(match[2]);
    if (!href || !/\/product\/\d+/.test(href)) continue;
    if (links.some(l => l.url === href)) continue;
    // 商品一覧以外の重複リンクが混ざる可能性があるため、デザイン名またはTシャツ/缶バッジ等の商品名を含むものを優先
    if (text && (text.includes(designName.slice(0, 4)) || /Tシャツ|ロングTシャツ|ビッグ|オーガニック|缶バッジ|パーカー|スウェット|ポロシャツ|バッグ/.test(text))) {
      links.push({ url: href, text });
    }
  }
  return links.slice(0, 30);
}


const PRODUCT_NAME_PATTERNS = [
  'ハイグレードTシャツ',
  'ビッグシルエットTシャツ',
  'スーパーヘビーTシャツ',
  'スタンダードTシャツ',
  'ライトウェイトTシャツ',
  'オーガニックコットンTシャツ',
  'ドライTシャツ',
  'ロングTシャツ',
  'プレミアムTシャツ',
  'レディースTシャツ',
  'キッズTシャツ',
  'ポロシャツ',
  'パーカー',
  'ジップパーカー',
  'スウェット',
  'トートバッグ',
  'サコッシュ',
  '缶バッジ',
  'アクリルキーホルダー',
  'アクリルスタンド',
  'ステッカー',
];

function normalizeProductName(text, fallbackTitle = '') {
  const combined = decodeHtml(`${text || ''} ${fallbackTitle || ''}`)
    .replace(/[|｜].*?Tシャツトリニティ.*$/g, ' ')
    .replace(/注文時の注意事項[\s\S]*$/g, ' ')
    .replace(/この商品について[\s\S]*$/g, ' ')
    .replace(/素材・仕様[\s\S]*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const pattern of PRODUCT_NAME_PATTERNS) {
    if (combined.includes(pattern)) return pattern;
  }

  const baseMatch = combined.match(/ベースアイテム\s*([^\s]+(?:Tシャツ|パーカー|スウェット|ポロシャツ|バッグ|缶バッジ|キーホルダー|スタンド|ステッカー))/);
  if (baseMatch) return baseMatch[1].trim();

  const title = decodeHtml(fallbackTitle || '').replace(/\|デザインTシャツ通販.*$/, '').trim();
  const paren = title.match(/（([^）]+)）/);
  if (paren && paren[1].length <= 30) return paren[1];

  const first = combined.split(/\s+/).find(t => /Tシャツ|パーカー|スウェット|ポロシャツ|バッグ|缶バッジ|キーホルダー|スタンド|ステッカー/.test(t));
  return first && first.length <= 30 ? first : '商品';
}

function extractImages(html, baseUrl) {
  const images = [];
  const add = (url, label = '') => {
    const abs = absoluteUrl(url, baseUrl);
    if (!abs || images.some(i => i.url === abs)) return;
    if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(abs) && !/image|img|product|item|design|up-t/i.test(abs)) return;
    images.push({ url: abs, label });
  };

  const og = readMeta(html, 'og:image') || readMeta(html, 'twitter:image') || readMeta(html, 'twitter:image:src');
  if (og) add(og, '代表画像');

  const imgRegex = /<img[^>]+>/gi;
  let match;
  while ((match = imgRegex.exec(html))) {
    const tag = match[0];
    const src =
      (tag.match(/\sdata-src=["']([^"']+)["']/i) || [])[1] ||
      (tag.match(/\ssrc=["']([^"']+)["']/i) || [])[1] ||
      (tag.match(/\sdata-original=["']([^"']+)["']/i) || [])[1];

    const alt = decodeHtml(((tag.match(/\salt=["']([^"']*)["']/i) || [])[1] || ''));
    const cls = decodeHtml(((tag.match(/\sclass=["']([^"']*)["']/i) || [])[1] || ''));
    const around = `${alt} ${cls} ${src || ''}`;

    if (/logo|icon|sprite|avatar|banner/i.test(around)) continue;
    if (/商品|Tシャツ|デザイン|front|back|main|sub|color|item|product|thumb|プリント|画像/i.test(around)) {
      add(src, alt || '商品画像');
    }
  }

  return images.slice(0, 8);
}

async function scrapeProduct(productUrl) {
  const html = await fetchHtml(productUrl);
  const meta = pickMeta(html, productUrl);
  const pageText = stripTags(html);

  const baseMatch = pageText.match(/ベースアイテム\s+(.{1,80}?)(?:\s+[^ ]+の特徴|の特徴|素材・仕様|品番|カラー|サイズ)/);
  const baseItem = baseMatch ? normalizeProductName(baseMatch[1], meta.title) : '';
  const name = baseItem && baseItem !== '商品' ? baseItem : normalizeProductName(pageText.slice(0, 1200), meta.title);

  const colors = extractColors(html);
  const sizes = extractSizes(html, name);
  const images = extractImages(html, productUrl);
  if (meta.image && !images.some(i => i.url === meta.image)) {
    images.unshift({ url: meta.image, label: '代表画像' });
  }

  return {
    name,
    source_url: productUrl,
    image_url: images[0]?.url || meta.image,
    images,
    colors: colors.length ? colors : [{ name: 'ホワイト', hex: '#f7f7f7' }],
    sizes: sizes.length ? sizes : ['S','M','L','XL'],
  };
}

function parseDesign(row) {
  return {
    ...row,
    colors: safeJson(row.colors_json, []),
    sizes: safeJson(row.sizes_json, []),
    products: row.products_json ? safeJson(row.products_json, []) : [],
  };
}

async function getDesignWithProducts(whereSql = '', params = []) {
  const designs = await all(`SELECT * FROM designs ${whereSql} ORDER BY display_order ASC, id ASC`, params);
  const products = await all('SELECT * FROM products WHERE active = 1 ORDER BY design_id ASC, display_order ASC, id ASC');
  const productsByDesign = {};
  for (const p of products) {
    if (!productsByDesign[p.design_id]) productsByDesign[p.design_id] = [];
    productsByDesign[p.design_id].push({
      ...p,
      colors: safeJson(p.colors_json, []),
      sizes: safeJson(p.sizes_json, []),
      images: p.images_json ? safeJson(p.images_json, []) : [],
    });
  }
  return designs.map(d => parseDesign({ ...d, products_json: JSON.stringify(productsByDesign[d.id] || []) }));
}

app.get('/api/designs', async (req, res) => {
  try {
    const admin = req.query.admin === '1';
    const rows = admin
      ? await getDesignWithProducts('')
      : await getDesignWithProducts('WHERE active = 1');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/designs', async (req, res) => {
  try {
    const {
      id,
      name,
      source_url,
      description,
      design_image_url,
      active,
      display_order,
      colors,
      sizes,
    } = req.body;

    const colorsJson = JSON.stringify(Array.isArray(colors) ? colors : safeJson(colors, []));
    const sizesJson = JSON.stringify(Array.isArray(sizes) ? sizes : safeJson(sizes, []));
    const activeValue = active ? 1 : 0;

    if (id) {
      await run(
        `UPDATE designs
         SET name = ?, source_url = ?, description = ?, design_image_url = ?,
             colors_json = ?, sizes_json = ?, active = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, source_url, description, design_image_url, colorsJson, sizesJson, activeValue, display_order || 0, id]
      );
      const updated = await get('SELECT * FROM designs WHERE id = ?', [id]);
      return res.json(parseDesign(updated));
    }

    const result = await run(
      `INSERT INTO designs (name, source_url, description, design_image_url, colors_json, sizes_json, active, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, source_url, description, design_image_url, colorsJson, sizesJson, activeValue, display_order || 0]
    );
    const created = await get('SELECT * FROM designs WHERE id = ?', [result.id]);
    res.json(parseDesign(created));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/designs/:id/fetch-meta', async (req, res) => {
  try {
    const design = await get('SELECT * FROM designs WHERE id = ?', [req.params.id]);
    if (!design) return res.status(404).json({ error: 'design not found' });

    const html = await fetchHtml(design.source_url);
    const meta = pickMeta(html, design.source_url);
    const nextName = req.body?.overwriteName && meta.title ? meta.title : design.name;
    const nextDescription = req.body?.overwriteDescription && meta.description ? meta.description : design.description;
    const nextImage = meta.image || design.design_image_url;

    await run(
      `UPDATE designs
       SET name = ?, description = ?, design_image_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextName, nextDescription, nextImage, req.params.id]
    );

    const updated = await get('SELECT * FROM designs WHERE id = ?', [req.params.id]);
    res.json({ design: parseDesign(updated), meta });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/designs/:id/scrape-products', async (req, res) => {
  try {
    const design = await get('SELECT * FROM designs WHERE id = ?', [req.params.id]);
    if (!design) return res.status(404).json({ error: 'design not found' });

    const designHtml = await fetchHtml(design.source_url);
    const meta = pickMeta(designHtml, design.source_url);
    if (meta.image) {
      await run('UPDATE designs SET design_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [meta.image, design.id]);
    }

    const links = extractProductLinksFromDesignPage(designHtml, design.source_url, design.name);
    await run('DELETE FROM products WHERE design_id = ?', [design.id]);

    const results = [];
    for (let i = 0; i < links.length; i++) {
      try {
        const product = await scrapeProduct(links[i].url);
        await run(
          `INSERT INTO products (design_id, name, source_url, image_url, images_json, colors_json, sizes_json, active, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [design.id, product.name || normalizeProductName(links[i].text), product.source_url, product.image_url, JSON.stringify(product.images || []), JSON.stringify(product.colors), JSON.stringify(product.sizes), i + 1]
        );
        results.push({ ok: true, url: links[i].url, name: product.name, colors: product.colors.length, sizes: product.sizes.length });
      } catch (e) {
        results.push({ ok: false, url: links[i].url, error: e.message });
      }
    }

    res.json({ design_id: design.id, found: links.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/designs/scrape-all-products', async (req, res) => {
  try {
    const designs = await all('SELECT * FROM designs ORDER BY display_order ASC, id ASC');
    const allResults = [];
    for (const design of designs) {
      try {
        const designHtml = await fetchHtml(design.source_url);
        const meta = pickMeta(designHtml, design.source_url);
        if (meta.image) {
          await run('UPDATE designs SET design_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [meta.image, design.id]);
        }
        const links = extractProductLinksFromDesignPage(designHtml, design.source_url, design.name);
        await run('DELETE FROM products WHERE design_id = ?', [design.id]);
        const productResults = [];
        for (let i = 0; i < links.length; i++) {
          try {
            const product = await scrapeProduct(links[i].url);
            await run(
              `INSERT INTO products (design_id, name, source_url, image_url, images_json, colors_json, sizes_json, active, display_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
              [design.id, product.name || normalizeProductName(links[i].text), product.source_url, product.image_url, JSON.stringify(product.images || []), JSON.stringify(product.colors), JSON.stringify(product.sizes), i + 1]
            );
            productResults.push({ ok: true, name: product.name, url: links[i].url });
          } catch (e) {
            productResults.push({ ok: false, url: links[i].url, error: e.message });
          }
        }
        allResults.push({ id: design.id, name: design.name, ok: true, found: links.length, products: productResults });
      } catch (e) {
        allResults.push({ id: design.id, name: design.name, ok: false, error: e.message });
      }
    }
    res.json({ results: allResults });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/designs/fetch-all-meta', async (req, res) => {
  try {
    const designs = await all('SELECT * FROM designs ORDER BY display_order ASC, id ASC');
    const results = [];
    for (const design of designs) {
      try {
        const html = await fetchHtml(design.source_url);
        const meta = pickMeta(html, design.source_url);
        const nextImage = meta.image || design.design_image_url;
        const nextDescription = design.description || meta.description || '';
        await run(
          `UPDATE designs SET design_image_url = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [nextImage, nextDescription, design.id]
        );
        results.push({ id: design.id, name: design.name, ok: true, image: nextImage });
      } catch (e) {
        results.push({ id: design.id, name: design.name, ok: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/designs/:id/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });
    const imageUrl = `/uploads/${req.file.filename}`;
    await run('UPDATE designs SET design_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [imageUrl, req.params.id]);
    const row = await get('SELECT * FROM designs WHERE id = ?', [req.params.id]);
    res.json(parseDesign(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/designs/:id', async (req, res) => {
  try {
    await run('DELETE FROM designs WHERE id = ?', [req.params.id]);
    await run('DELETE FROM products WHERE design_id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { staff_name, department, design_id, product_id, color, size, note } = req.body;
    if (!staff_name || !design_id || !product_id || !color || !size) {
      return res.status(400).json({ error: 'staff_name, design_id, product_id, color, size are required' });
    }
    const design = await get('SELECT * FROM designs WHERE id = ?', [design_id]);
    const product = await get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!design) return res.status(404).json({ error: 'design not found' });
    if (!product) return res.status(404).json({ error: 'product not found' });

    const result = await run(
      `INSERT INTO orders (staff_name, department, design_id, design_name, product_id, product_name, product_url, color, size, quantity, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [staff_name, department || '', design_id, design.name, product_id, product.name, product.source_url, color, size, note || '']
    );
    const order = await get('SELECT * FROM orders WHERE id = ?', [result.id]);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.delete('/api/orders', async (req, res) => {
  try {
    const result = await run('DELETE FROM orders');
    res.json({ ok: true, deleted: result.changes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ ok: true, deleted: result.changes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM orders ORDER BY datetime(created_at) DESC, id DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const byVariant = await all(
      `SELECT design_name, product_name, color, size, SUM(quantity) AS total
       FROM orders
       GROUP BY design_name, product_name, color, size
       ORDER BY design_name, product_name, color, size`
    );
    const byStaff = await all(
      `SELECT staff_name, department, design_name, product_name, color, size, quantity, note, created_at
       FROM orders
       ORDER BY staff_name ASC, created_at DESC`
    );
    const notes = byStaff.filter(r => (r.note || '').trim().length > 0);
    res.json({ byVariant, byStaff, notes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export/orders.csv', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM orders ORDER BY datetime(created_at) DESC, id DESC');
    const headers = ['id', 'created_at', 'staff_name', 'department', 'design_name', 'product_name', 'product_url', 'color', 'size', 'quantity', 'note'];
    const escapeCsv = (value) => {
      const str = String(value ?? '');
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const csv = [headers.join(',')]
      .concat(rows.map(row => headers.map(h => escapeCsv(row[h])).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send('\ufeff' + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path === '/admin') return next();
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});
