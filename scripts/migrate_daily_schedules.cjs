const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '..', 'data', 'gcck_mes.sqlite');
const db = new DatabaseSync(dbPath);

console.log('[Migration] Creating daily_schedule_rows & weekly_downtime_notes...');

db.exec(`
CREATE TABLE IF NOT EXISTS daily_schedule_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_date TEXT NOT NULL,
  shift_type TEXT NOT NULL DEFAULT 'Ca 2',
  stt INTEGER NOT NULL DEFAULT 1,
  worker_name TEXT NOT NULL,
  customer TEXT NOT NULL DEFAULT '',
  sp_id TEXT DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  nc_id TEXT DEFAULT '',
  op_name TEXT NOT NULL DEFAULT '',
  planned_qty REAL NOT NULL DEFAULT 0,
  machine_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  actual_qty REAL NOT NULL DEFAULT 0,
  drawing_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PLANNED',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_sched_date_shift ON daily_schedule_rows(work_date, shift_type);

CREATE TABLE IF NOT EXISTS weekly_downtime_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  machine_name TEXT NOT NULL DEFAULT '',
  stop_minutes REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_weekly_downtime_week ON weekly_downtime_notes(week_start);
`);

// Sample seed from user's Excel sheet for 2026-10-21
const sampleRows = [
  // Phùng Gia Phúc
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 1, worker_name: 'Phùng gia Phúc', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c NC3 kích thước 412mm lần 2', planned_qty: 20, machine_name: 'Máy Phay CNC1', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 2, worker_name: 'Phùng gia Phúc', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ phay MP', planned_qty: 12, machine_name: 'Máy Phay CNC2', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 3, worker_name: 'Phùng gia Phúc', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c NC3 kích thước 412mm lần 1', planned_qty: 0, machine_name: 'Máy phay OKK3, OKK1', note: '' },

  // Phạm Văn Sam
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 4, worker_name: 'Phạm Văn Sam', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c NC3 kích thước 412mm lần 1', planned_qty: 20, machine_name: 'Máy phay OKK3, OKK1', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 5, worker_name: 'Phạm Văn Sam', customer: 'Hà Song Hải- XM Hạ Long', product_name: 'Thanh đập đá vôi (2220x510x145)', op_name: 'G/c theo bản vẽ', planned_qty: 0.25, machine_name: 'Máy phay OIGO', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 6, worker_name: 'Phạm Văn Sam', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ phay MP', planned_qty: 0, machine_name: 'Máy Phay CNC2', note: '' },

  // Trần Văn Quỳnh
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 7, worker_name: 'Trần Văn Quỳnh', customer: 'Hà Song Hải- XM Hạ Long', product_name: 'Thanh đập đá vôi (2220x510x145)', op_name: 'G/c theo bản vẽ', planned_qty: 0.25, machine_name: 'Máy phay OIGO', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 8, worker_name: 'Trần Văn Quỳnh', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ', planned_qty: 9, machine_name: 'Máy Phay CNC1', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 9, worker_name: 'Trần Văn Quỳnh', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ', planned_qty: 8, machine_name: 'Máy Phay CNC2', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 10, worker_name: 'Trần Văn Quỳnh', customer: 'Thysen', product_name: 'Sealing strip, above', op_name: 'G/c theo bản vẽ', planned_qty: 2, machine_name: 'Máy Phay CNC1', note: 'Tăng ca 2 tiếng' },

  // Đinh Văn Nhận
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 11, worker_name: 'Đinh Văn Nhận', customer: 'Win win', product_name: 'Mẫu kéo nén', op_name: 'G/c theo bản vẽ', planned_qty: 6, machine_name: 'Máy tiện T630-Okuma', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 12, worker_name: 'Đinh Văn Nhận', customer: 'Cty', product_name: 'Mẫu va đập VC , Bi các loại', op_name: 'G/c cắt mài theo yêu cầu', planned_qty: 6, machine_name: 'Máy cắt dây DK 7780, DK7745 , podatech', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 13, worker_name: 'Đinh Văn Nhận', customer: 'Win win', product_name: 'ALKTOP 1640 M', op_name: 'G/c theo bản vẽ', planned_qty: 16, machine_name: 'Máy tiện T630-Okuma', note: 'Tăng ca 2 tiếng' },

  // Phạm Văn Tráng
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 14, worker_name: 'Phạm Văn Tráng', customer: 'Hà Song Hải- XM Hạ Long', product_name: 'Thanh đập đá vôi (2220x510x145)', op_name: 'G/c theo bản vẽ', planned_qty: 0.25, machine_name: 'Máy phay OIGO', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 15, worker_name: 'Phạm Văn Tráng', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ phay MP', planned_qty: 12, machine_name: 'Máy Phay CNC2', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 16, worker_name: 'Phạm Văn Tráng', customer: 'Win win', product_name: 'ISHIZUE 216-550', op_name: 'G/c theo bản vẽ', planned_qty: 4, machine_name: 'Máy tiện T630-Okuma', note: 'Tăng ca 2 tiếng' },

  // Nguyễn Trung Đông
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 17, worker_name: 'Nguyễn Trung Đông', customer: 'Win win', product_name: 'ISHIZUE 355-1060,,457-950', op_name: 'G/c theo bản vẽ', planned_qty: 6, machine_name: 'Máy tiện FUJI', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 18, worker_name: 'Nguyễn Trung Đông', customer: 'Cty', product_name: 'Mẫu va đập VC , Bi các loại', op_name: 'G/c cắt mài theo yêu cầu', planned_qty: 6, machine_name: 'Máy cắt dây DK 7780, DK7745 , podatech', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 19, worker_name: 'Nguyễn Trung Đông', customer: 'Win win', product_name: 'ISHIZUE 355-1060,,457-950', op_name: 'G/c theo bản vẽ', planned_qty: 2, machine_name: 'Máy tiện FUJI', note: 'Tăng ca 2 tiếng' },

  // Phùng Đình Hùng
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 20, worker_name: 'Phùng Đình Hùng', customer: 'TFG', product_name: 'Mantle số hiệu A3G03266-3 theo bv HAKA12756-01', op_name: 'G/c theo bản vẽ', planned_qty: 0.25, machine_name: 'Máy tiện T1516', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 21, worker_name: 'Phùng Đình Hùng', customer: 'Vico- QLTB', product_name: 'Mẫu thử kéo', op_name: 'G/c theo bản vẽ', planned_qty: 6, machine_name: 'Máy cưa vòng', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 22, worker_name: 'Phùng Đình Hùng', customer: 'Vico- QLTB', product_name: 'Mẫu thử kéo', op_name: 'G/c theo bản vẽ', planned_qty: 0, machine_name: 'Máy cưa vòng', note: '' },

  // Phùng Công Thắng
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 23, worker_name: 'Phùng Công Thắng', customer: 'Thysen', product_name: 'ALKTOP 1950 M, 1130H', op_name: 'G/c khoan lỗ phi 14 hoàn thiện', planned_qty: 16, machine_name: 'Máy tiện T630-Okuma', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 24, worker_name: 'Phùng Công Thắng', customer: 'Cty', product_name: 'Mẫu va đập VC , Bi các loại', op_name: 'G/c cắt mài theo yêu cầu', planned_qty: 6, machine_name: 'Máy cắt dây DK 7780, DK7745 , podatech', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 25, worker_name: 'Phùng Công Thắng', customer: 'Thysen', product_name: 'Sealing strip, above', op_name: 'G/c theo bản vẽ', planned_qty: 5, machine_name: 'Máy Khoan cần', note: 'Tăng ca 2 tiếng' },

  // Đặng Ngọc Long
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 26, worker_name: 'Đặng Ngọc Long', customer: 'Win win', product_name: 'ISHIZUE 267-700,267-800', op_name: 'G/c theo bản vẽ', planned_qty: 10, machine_name: 'Máy tiện FUJI', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 27, worker_name: 'Đặng Ngọc Long', customer: 'Cty', product_name: 'Mẫu va đập VC , Bi các loại', op_name: 'G/c cắt mài theo yêu cầu', planned_qty: 6, machine_name: 'Máy cắt dây DK 7780, DK7745 , podatech', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 2', stt: 28, worker_name: 'Đặng Ngọc Long', customer: 'Win win', product_name: 'ISHIZUE 267-700,267-800', op_name: 'G/c theo bản vẽ', planned_qty: 3, machine_name: 'Máy tiện T630-Okuma', note: 'Tăng ca 2 tiếng' },

  // Trần Văn Dũng
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 29, worker_name: 'Trần Văn Dũng', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ', planned_qty: 9, machine_name: 'Máy Phay CNC1', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 30, worker_name: 'Trần Văn Dũng', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ', planned_qty: 8, machine_name: 'Máy Phay CNC2', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 31, worker_name: 'Trần Văn Dũng', customer: 'Thysen', product_name: 'Sealing strip, above', op_name: 'G/c theo bản vẽ', planned_qty: 2, machine_name: 'Máy Phay CNC1', note: '' },

  // Vũ Tiên Thuận
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 32, worker_name: 'Vũ Tiên Thuận', customer: 'Win win', product_name: 'ISHIZUE 267-700,267-800', op_name: 'G/c theo bản vẽ', planned_qty: 10, machine_name: 'Máy tiện FUJI', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 33, worker_name: 'Vũ Tiên Thuận', customer: 'Cty', product_name: 'Mẫu va đập VC , Bi các loại', op_name: 'G/c cắt mài theo yêu cầu', planned_qty: 6, machine_name: 'Máy cắt dây DK 7780, DK7745 , podatech', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 34, worker_name: 'Vũ Tiên Thuận', customer: 'Win win', product_name: 'ISHIZUE 267-700,267-800', op_name: 'G/c theo bản vẽ', planned_qty: 0, machine_name: 'Máy tiện FUJI', note: '' },

  // Nguyễn Văn Thanh
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 35, worker_name: 'Nguyễn Văn Thanh', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ', planned_qty: 12, machine_name: 'Máy tiện T630-Okuma', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 36, worker_name: 'Nguyễn Văn Thanh', customer: 'Cty', product_name: 'Mẫu va đập VC , Bi các loại', op_name: 'G/c cắt mài theo yêu cầu', planned_qty: 6, machine_name: 'Máy cắt dây DK 7780, DK7745 , podatech', note: '' },
  { work_date: '2026-10-21', shift_type: 'Ca 3', stt: 37, worker_name: 'Nguyễn Văn Thanh', customer: 'Thysen', product_name: 'Sealing strip, below', op_name: 'G/c theo bản vẽ', planned_qty: 2, machine_name: 'Máy phay OKK3, OKK1', note: 'Tăng ca 2 tiếng' }
];

const count = db.prepare('SELECT COUNT(*) AS c FROM daily_schedule_rows WHERE work_date = ?').get('2026-10-21');
if (Number(count.c) === 0) {
  const insertStmt = db.prepare(`
    INSERT INTO daily_schedule_rows (work_date, shift_type, stt, worker_name, customer, product_name, op_name, planned_qty, machine_name, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of sampleRows) {
    insertStmt.run(r.work_date, r.shift_type, r.stt, r.worker_name, r.customer, r.product_name, r.op_name, r.planned_qty, r.machine_name, r.note);
  }
  console.log(`[Migration] Inserted ${sampleRows.length} sample daily schedule rows for 2026-10-21.`);
} else {
  console.log(`[Migration] Already have ${count.c} rows for 2026-10-21.`);
}

console.log('[Migration] Done!');
