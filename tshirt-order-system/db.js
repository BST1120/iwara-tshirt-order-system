const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'app.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_url TEXT,
      description TEXT,
      design_image_url TEXT,
      colors_json TEXT NOT NULL,
      sizes_json TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_name TEXT NOT NULL,
      department TEXT,
      design_id INTEGER NOT NULL,
      design_name TEXT NOT NULL,
      color TEXT NOT NULL,
      size TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(design_id) REFERENCES designs(id)
    )
  `);

  const countRow = await get('SELECT COUNT(*) AS count FROM designs');
  if (countRow.count === 0) {
    const seedDesigns = [
      ['NATURE POSITIVE IWARA', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3364149'],
      ['井原夏祭', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3364135'],
      ['ストリート・オブ・ホイク', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3363110'],
      ['さんみいったい', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3363106'],
      ['葉っぱの幸和会', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3354035'],
      ['スモーキング・エンチョウ・イズ・ネコアレルギー', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3360105'],
      ['サマフェス01_R7年度', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3253144'],
      ['サマフェス02_R7年度', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3253177'],
      ['サマフェス03_R7年度', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3253141'],
      ['顔ロゴ', 'https://www.ttrinity.jp/shop/iwarahoikuen/design/3073553']
    ];

    const defaultColors = [
      { name: 'ホワイト', hex: '#f5f5f5' },
      { name: 'ブラック', hex: '#222222' },
      { name: 'ネイビー', hex: '#20324a' },
      { name: 'グレー', hex: '#9aa0a6' }
    ];
    const defaultSizes = ['S', 'M', 'L', 'XL', 'XXL'];

    for (let i = 0; i < seedDesigns.length; i++) {
      const [name, sourceUrl] = seedDesigns[i];
      await run(
        `INSERT INTO designs (name, source_url, description, design_image_url, colors_json, sizes_json, active, display_order)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          name,
          sourceUrl,
          '初期登録デザイン。必要に応じて色・サイズ・画像を管理画面で調整してください。',
          '',
          JSON.stringify(defaultColors),
          JSON.stringify(defaultSizes),
          i + 1,
        ]
      );
    }
  }
}

module.exports = { db, run, all, get, initDb };
