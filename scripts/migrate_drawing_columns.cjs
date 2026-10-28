const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/gcck_mes.sqlite');

const prodCols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
if (!prodCols.includes('drawing_url')) {
  db.exec("ALTER TABLE products ADD COLUMN drawing_url TEXT DEFAULT ''");
  console.log('Added drawing_url to products');
}
if (!prodCols.includes('tech_doc_url')) {
  db.exec("ALTER TABLE products ADD COLUMN tech_doc_url TEXT DEFAULT ''");
  console.log('Added tech_doc_url to products');
}

const opCols = db.prepare('PRAGMA table_info(operations)').all().map(c => c.name);
if (!opCols.includes('drawing_url')) {
  db.exec("ALTER TABLE operations ADD COLUMN drawing_url TEXT DEFAULT ''");
  console.log('Added drawing_url to operations');
}
if (!opCols.includes('setup_doc_url')) {
  db.exec("ALTER TABLE operations ADD COLUMN setup_doc_url TEXT DEFAULT ''");
  console.log('Added setup_doc_url to operations');
}

console.log('Database migration for drawing and tech_doc columns completed successfully!');
db.close();
