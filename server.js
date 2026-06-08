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

function parseDesign(row) {
  return {
    ...row,
    colors: safeJson(row.colors_json, []),
    sizes: safeJson(row.sizes_json, []),
  };
}

function safeJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

app.get('/api/designs', async (req, res) => {
  try {
    const admin = req.query.admin === '1';
    const sql = admin
      ? 'SELECT * FROM designs ORDER BY display_order ASC, id ASC'
      : 'SELECT * FROM designs WHERE active = 1 ORDER BY display_order ASC, id ASC';
    const rows = await all(sql);
    res.json(rows.map(parseDesign));
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
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { staff_name, department, design_id, color, size, note } = req.body;
    if (!staff_name || !design_id || !color || !size) {
      return res.status(400).json({ error: 'staff_name, design_id, color, size are required' });
    }
    const design = await get('SELECT * FROM designs WHERE id = ?', [design_id]);
    if (!design) return res.status(404).json({ error: 'design not found' });

    const result = await run(
      `INSERT INTO orders (staff_name, department, design_id, design_name, color, size, quantity, note)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [staff_name, department || '', design_id, design.name, color, size, note || '']
    );
    const order = await get('SELECT * FROM orders WHERE id = ?', [result.id]);
    res.json(order);
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
      `SELECT design_name, color, size, SUM(quantity) AS total
       FROM orders
       GROUP BY design_name, color, size
       ORDER BY design_name, color, size`
    );
    const byStaff = await all(
      `SELECT staff_name, department, design_name, color, size, quantity, note, created_at
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
    const headers = ['id', 'created_at', 'staff_name', 'department', 'design_name', 'color', 'size', 'quantity', 'note'];
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
