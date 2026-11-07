/**
 * Hendrixx Exclusive — Google Sheets database
 * ============================================
 *
 * What this script does
 *   1. Menu "Hendrixx DB" → "Setup / kemaskini semua tab" creates every tab (table) with
 *      headers, column formats, dropdowns, checkboxes, computed columns and a Dashboard.
 *      Safe to run again: it never deletes data, it only adds missing tabs/columns and
 *      re-applies formatting.
 *   2. "Isi data contoh" fills Material, Pricelist, Add-on, ProductOptions, Agent and Settings (only empty tabs).
 *   3. Deployed as a Web App, it is a small JSON API (protected by a token) so the
 *      Laravel system can read/write rows. See doGet / doPost at the bottom.
 *
 * Conventions
 *   - Row 1 = column keys (snake_case, same names as the Laravel database). Hover a header
 *     to see its description (note). Do not rename headers.
 *   - Every table has an `id` column. New ids = highest id + 1.
 *   - Columns marked `computed` are ARRAYFORMULAs in the header cell. Never type in them.
 */

const APP = {
  name: 'Hendrixx Exclusive',
  navy: '#030164',
  cream: '#FCF9EA',
  timezone: 'Asia/Kuala_Lumpur',
  formatRows: 1000, // rows that receive formatting / validation
};

const STAGES = ['order', 'design', 'jobsheet', 'production', 'postage', 'completed'];
const STAGE_LABELS = {
  order: 'Order Diterima + Deposit',
  design: 'Design Selesai',
  jobsheet: 'Submit Jobsheet ke Kilang',
  production: 'Baju Selesai',
  postage: 'Postage',
  completed: 'Complete',
};

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

// Column helper. type: id | text | longtext | int | number | money | percent | date | datetime | bool | enum
const c = (key, note, type = 'text', extra = {}) => Object.assign({ key, note, type }, extra);

const SCHEMA = {
  Settings: {
    color: '#5d5c78',
    columns: [
      c('id', 'ID', 'id'),
      c('key', 'Nama tetapan (jangan ubah)'),
      c('value', 'Nilai'),
      c('description', 'Penerangan', 'longtext'),
    ],
  },

  Materials: {
    color: '#2f8f6b',
    columns: [
      c('id', 'ID', 'id'),
      c('code', 'Kod material unik, cth: MAT-EYELET'),
      c('name', 'Nama material'),
      c('category', 'Kategori', 'enum', { options: ['Kain', 'Lycra', 'Collar / Rib', 'Aksesori', 'Packaging', 'Ink / Paper'] }),
      c('gsm', 'Berat kain (GSM)', 'int'),
      c('unit', 'Unit kiraan', 'enum', { options: ['meter', 'kg', 'roll', 'helai', 'pcs'] }),
      c('cost_per_unit', 'Kos seunit (RM)', 'money'),
      c('supplier', 'Pembekal'),
      c('stock_qty', 'Stok semasa', 'number'),
      c('reorder_level', 'Order semula bila stok bawah paras ini', 'number'),
      c('description', 'Ciri-ciri / nota', 'longtext'),
      c('active', 'Masih digunakan?', 'bool'),
      c('updated_at', 'Dikemaskini', 'datetime'),
    ],
  },

  Pricelist: {
    color: '#c9a227',
    columns: [
      c('id', 'ID', 'id'),
      c('code', 'Kod harga unik, cth: JRS-SS-EYE-30'),
      c('product', 'Produk', 'enum', {
        options: ['Jersey', 'Jersey Esports', 'Corporate Polo', 'Baju Larian / Event', 'Seluar / Short', 'Jaket'],
        allowOther: true,
      }),
      c('material_code', 'Material (kod dari tab Materials)', 'ref', { refTable: 'Materials', refKey: 'code' }),
      c('sleeve', 'Jenis lengan', 'enum', { options: ['Pendek', 'Panjang', 'Tanpa lengan', 'Raglan'] }),
      c('collar', 'Jenis kolar', 'enum', { options: ['Round Neck', 'V Neck', 'Polo Collar', 'Mandarin', 'Hoodie'] }),
      c('min_qty', 'Kuantiti minimum (helai) untuk harga ini', 'int'),
      c('max_qty', 'Kuantiti maksimum (kosong = tiada had)', 'int'),
      c('price', 'Harga jual / helai (RM)', 'money'),
      c('cost', 'Kos / helai (RM)', 'money'),
      c('margin_pct', 'Margin (auto)', 'percent', {
        computed: (r) => `IF(${r('price')}="",,IF(${r('price')}=0,,(${r('price')}-${r('cost')})/${r('price')}))`,
      }),
      c('active', 'Harga masih aktif?', 'bool'),
      c('notes', 'Nota', 'longtext'),
    ],
  },

  AddOns: {
    color: '#c9a227',
    columns: [
      c('id', 'ID', 'id'),
      c('code', 'Kod add-on unik'),
      c('name', 'Nama add-on, cth: Naik taraf Lycra'),
      c('charge_type', 'Cara caj', 'enum', { options: ['per helai', 'per order'] }),
      c('price', 'Harga jual (RM)', 'money'),
      c('cost', 'Kos (RM)', 'money'),
      c('active', 'Aktif?', 'bool'),
      c('notes', 'Nota', 'longtext'),
    ],
  },

  ProductOptions: {
    color: '#c9a227',
    columns: [
      c('id', 'ID', 'id'),
      c('group', 'Kumpulan: garment_type = Jenis baju | print_method = Proses printing | neck_type = Jenis neck | neck_finish = Neck sublimation / readymade', 'enum', {
        options: ['garment_type', 'print_method', 'neck_type', 'neck_finish'],
      }),
      c('name', 'Nama pilihan, cth: Silkscreen'),
      c('price', 'Tambahan harga / helai (RM), 0 = tiada caj', 'money'),
      c('cost', 'Tambahan kos / helai (RM)', 'money'),
      c('sort', 'Susunan dalam dropdown (kecil dahulu)', 'int'),
      c('active', 'Aktif?', 'bool'),
      c('notes', 'Nota', 'longtext'),
    ],
  },

  Agents: {
    color: '#4f4dc2',
    columns: [
      c('id', 'ID', 'id'),
      c('name', 'Nama ejen'),
      c('phone', 'No. telefon'),
      c('area', 'Kawasan / sekolah'),
      c('commission_type', 'Jenis komisen', 'enum', { options: ['percent', 'per helai'] }),
      c('commission_value', 'Nilai komisen (% atau RM/helai)', 'number'),
      c('bank_account', 'Bank & no. akaun'),
      c('active', 'Aktif?', 'bool'),
      c('notes', 'Nota', 'longtext'),
      c('created_at', 'Didaftarkan', 'datetime'),
    ],
  },

  Customers: {
    color: APP.navy,
    columns: [
      c('id', 'ID', 'id'),
      c('name', 'Nama PIC'),
      c('phone', 'No. telefon / WhatsApp'),
      c('email', 'Email'),
      c('organization', 'Organisasi / team / sekolah'),
      c('state', 'Negeri penghantaran (pos)'),
      c('address', 'Alamat penghantaran', 'longtext'),
      c('created_at', 'Didaftarkan', 'datetime'),
    ],
  },

  Orders: {
    color: APP.navy,
    columns: [
      c('id', 'ID', 'id'),
      c('order_no', 'No. order, cth: HX2610-001 (auto jika kosong melalui API)'),
      c('customer_id', 'ID customer (tab Customers)', 'int'),
      c('agent_id', 'ID ejen (tab Agents), kosong jika jualan terus', 'int'),
      c('sales_user', 'Sales PIC'),
      c('title', 'Nama projek'),
      c('stage', 'Peringkat semasa: ' + STAGES.map((s) => `${s} = ${STAGE_LABELS[s]}`).join(' | '), 'enum', { options: STAGES }),
      c('stage_entered_at', 'Masa masuk peringkat semasa', 'datetime'),
      c('required_by', 'Tarikh customer perlukan', 'date'),
      c('subtotal', 'Subtotal (RM)', 'money'),
      c('discount', 'Diskaun (RM)', 'money'),
      c('shipping_fee', 'Caj pos (RM)', 'money'),
      c('total', 'Jumlah (RM)', 'money'),
      c('deposit_required', 'Deposit diperlukan (RM)', 'money'),
      c('paid', 'Jumlah dibayar (auto dari tab Payments)', 'money', {
        computed: (r, x) => `SUMIF(${x('Payments', 'order_id')},${r('id')},${x('Payments', 'amount')})`,
      }),
      c('balance', 'Baki (auto)', 'money', { computed: (r) => `${r('total')}-${r('paid')}` }),
      c('commission_amount', 'Komisen ejen (RM)', 'money'),
      c('invoice_sent_at', 'Invoice dihantar', 'datetime'),
      c('confirmed_at', 'Deposit diterima / order confirm', 'datetime'),
      c('design_approved_at', 'Design diluluskan customer', 'datetime'),
      c('jobsheet_submitted_at', 'Jobsheet dihantar ke kilang', 'datetime'),
      c('supplier_ref', 'No. rujukan kilang'),
      c('due_date', 'Due date kilang (6 hari bekerja)', 'date'),
      c('production_received_at', 'Baju diterima dari kilang', 'datetime'),
      c('shipping_method', 'Cara penghantaran', 'enum', { options: ['courier', 'pickup'] }),
      c('courier', 'Syarikat kurier (lama, tidak diisi lagi)'),
      c('tracking_no', 'No. tracking (lama, tidak diisi lagi)'),
      c('shipped_at', 'Tarikh dipos / diambil', 'datetime'),
      c('postage_cost', 'Kos pos sebenar (RM)', 'money'),
      c('tracking_sent_at', 'No. tracking dihantar ke customer', 'datetime'),
      c('completed_at', 'Tarikh complete', 'datetime'),
      c('cancelled_at', 'Tarikh dibatalkan (kosong = aktif)', 'datetime'),
      c('feedback_rating', 'Rating customer 1-5', 'int', { options: ['1', '2', '3', '4', '5'] }),
      c('feedback_comment', 'Komen customer', 'longtext'),
      c('notes', 'Nota dalaman', 'longtext'),
      c('jobsheet_notes', 'Senarai nama / nombor untuk jobsheet', 'longtext'),
      c('public_token', 'Token link invoice awam (auto)'),
      c('created_at', 'Order dicipta', 'datetime'),
      c('updated_at', 'Dikemaskini', 'datetime'),
    ],
  },

  OrderItems: {
    color: APP.navy,
    columns: [
      c('id', 'ID', 'id'),
      c('order_id', 'ID order (tab Orders)', 'int'),
      c('pricelist_code', 'Kod harga (tab Pricelist)', 'ref', { refTable: 'Pricelist', refKey: 'code' }),
      c('description', 'Item, cth: Jersey Round Neck Short Sleeve'),
      c('garment_type', 'Jenis baju, cth: Muslimah, Long Sleeve'),
      c('print_method', 'Proses printing: Sublimation / Silkscreen / Heatpress'),
      c('fabric', 'Jenis kain (nama dari tab Materials)', 'ref', { refTable: 'Materials', refKey: 'name' }),
      c('neck_type', 'Jenis neck, cth: Round Neck, V Neck'),
      c('neck_finish', 'Neck: Sublimation / Readymade'),
      c('test_print', 'Test print?', 'bool'),
      c('quantity', 'Bilangan helai', 'int'),
      c('unit_price', 'Harga / helai (RM)', 'money'),
      c('line_total', 'Jumlah (auto)', 'money', { computed: (r) => `${r('quantity')}*${r('unit_price')}` }),
      c('sizes', 'Size breakdown, cth: S:2, M:5, L:3'),
      c('addons', 'Kod add-on, dipisah koma'),
      c('names', 'Senarai nama: nombor - nama - saiz (satu baris satu helai)', 'longtext'),
      c('notes', 'Nota item (collar, sleeve, dll.)'),
    ],
  },

  Payments: {
    color: '#2f8f6b',
    columns: [
      c('id', 'ID', 'id'),
      c('order_id', 'ID order (tab Orders)', 'int'),
      c('type', 'Jenis bayaran', 'enum', { options: ['deposit', 'balance', 'full'] }),
      c('amount', 'Jumlah (RM)', 'money'),
      c('method', 'Cara bayaran', 'enum', { options: ['transfer', 'cash', 'duitnow', 'cheque'] }),
      c('reference', 'No. rujukan bank'),
      c('paid_on', 'Tarikh bayar', 'date'),
      c('proof_url', 'Link bukti bayaran'),
      c('recorded_by', 'Direkod oleh'),
      c('created_at', 'Masa direkod', 'datetime'),
    ],
  },

  Attachments: {
    color: '#5d5c78',
    columns: [
      c('id', 'ID', 'id'),
      c('order_id', 'ID order', 'int'),
      c('kind', 'Jenis fail', 'enum', { options: ['design_final', 'mockup', 'reference', 'other'] }),
      c('file_url', 'Link fail (Drive / server)'),
      c('file_name', 'Nama fail asal'),
      c('size_bytes', 'Saiz (bytes)', 'int'),
      c('uploaded_by', 'Dimuat naik oleh'),
      c('created_at', 'Masa upload', 'datetime'),
    ],
  },

  Activities: {
    color: '#5d5c78',
    columns: [
      c('id', 'ID', 'id'),
      c('order_id', 'ID order', 'int'),
      c('type', 'Jenis aktiviti', 'enum', {
        options: ['created', 'updated', 'stage', 'invoice', 'payment', 'design', 'jobsheet', 'production', 'postage', 'feedback', 'file', 'cancel'],
        allowOther: true,
      }),
      c('message', 'Penerangan', 'longtext'),
      c('user', 'Oleh'),
      c('created_at', 'Masa', 'datetime'),
    ],
  },

  Inquiries: {
    color: '#4f4dc2',
    columns: [
      c('id', 'ID', 'id'),
      c('name', 'Nama'),
      c('phone', 'No. WhatsApp'),
      c('email', 'Email'),
      c('organization', 'Team / organisasi'),
      c('product', 'Produk diminta'),
      c('quantity', 'Anggaran helai', 'int'),
      c('required_by', 'Tarikh perlu', 'date'),
      c('message', 'Mesej / idea design', 'longtext'),
      c('status', 'Status', 'enum', { options: ['new', 'contacted', 'converted', 'lost'] }),
      c('order_id', 'ID order jika sudah jadi order', 'int'),
      c('created_at', 'Diterima', 'datetime'),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Menu & setup                                                        */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hendrixx DB')
    .addItem('Setup / kemaskini semua tab', 'setupDatabase')
    .addItem('Isi data contoh (tab kosong sahaja)', 'seedSampleData')
    .addItem('Bina semula Dashboard', 'menuBuildDashboard')
    .addSeparator()
    .addItem('Tunjuk API token', 'showApiToken')
    .addItem('Jana API token baru', 'rotateApiToken')
    .addToUi();
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(APP.timezone);

  // Pass 1: every tab exists with all header keys (so cross-tab formulas can resolve columns).
  Object.keys(SCHEMA).forEach((name) => ensureHeaders(ss, name));

  // Pass 2: formats, validation, computed columns.
  Object.keys(SCHEMA).forEach((name) => formatTable(ss, name));

  buildDashboard(ss);
  removeBlankDefaultSheet(ss);
  ensureApiToken();

  ss.toast('Semua tab sedia. Guna menu "Isi data contoh" jika mahu data permulaan.', APP.name, 8);
}

function menuBuildDashboard() {
  buildDashboard(SpreadsheetApp.getActive());
}

function ensureHeaders(ss, name) {
  const schema = SCHEMA[name];
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const lastCol = sheet.getLastColumn();
  const existing = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];

  if (existing.filter(Boolean).length === 0) {
    const keys = schema.columns.map((col) => col.key);
    ensureColumns(sheet, keys.length);
    sheet.getRange(1, 1, 1, keys.length).setValues([keys]);
    return;
  }

  // Append columns that are new in the schema; existing columns and data are untouched.
  const missing = schema.columns.map((col) => col.key).filter((key) => existing.indexOf(key) === -1);
  if (missing.length) {
    const start = existing.length + 1;
    ensureColumns(sheet, existing.length + missing.length);
    sheet.getRange(1, start, 1, missing.length).setValues([missing]);
  }
}

function formatTable(ss, name) {
  const schema = SCHEMA[name];
  const sheet = ss.getSheetByName(name);
  const headers = getHeaders(sheet);
  const rows = Math.max(APP.formatRows, sheet.getMaxRows()) - 1;
  if (sheet.getMaxRows() < rows + 1) sheet.insertRowsAfter(sheet.getMaxRows(), rows + 1 - sheet.getMaxRows());

  const width = headers.length;
  const header = sheet.getRange(1, 1, 1, width);
  header
    .setBackground(APP.navy)
    .setFontColor(APP.cream)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setWrap(false);
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(Math.min(2, width));
  sheet.setTabColor(schema.color);

  const ref = (key) => colRange(headers, key, name, false);
  const xref = (table, key) => colRange(getHeaders(ss.getSheetByName(table)), key, table, true);

  schema.columns.forEach((col) => {
    const index = headers.indexOf(col.key) + 1;
    if (!index) return;
    const body = sheet.getRange(2, index, rows, 1);
    const headCell = sheet.getRange(1, index);

    headCell.setNote(col.note + (col.computed ? '\n\n(Auto — jangan taip dalam column ini)' : ''));
    body.clearDataValidations();
    applyFormat(sheet, index, body, col);

    if (col.computed) {
      // Header cell holds the array formula; it also prints the key as the header text.
      const idCol = ref('id');
      headCell.setFormula(`={"${col.key}";ARRAYFORMULA(IF(${idCol}="",,${col.computed(ref, xref)}))}`);
      headCell.setFontColor('#ffe9a8');
      body.setBackground('#f6f3e4');
      return;
    }

    if (col.options) {
      // Dropdown (enum columns, or numeric columns with fixed choices such as rating)
      body.setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(col.options, true).setAllowInvalid(!!col.allowOther).build(),
      );
    } else if (col.type === 'bool') {
      body.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
      body.setHorizontalAlignment('center');
    } else if (col.type === 'ref') {
      const target = ss.getSheetByName(col.refTable);
      const targetIndex = getHeaders(target).indexOf(col.refKey) + 1;
      if (targetIndex) {
        const list = target.getRange(2, targetIndex, Math.max(1, target.getMaxRows() - 1), 1);
        body.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(list, true).setAllowInvalid(true).build());
      }
    }
  });

  // Light banding once, so new rows are readable.
  if (sheet.getBandings().length === 0) {
    sheet
      .getRange(1, 1, rows + 1, width)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
      .setHeaderRowColor(APP.navy)
      .setFirstRowColor('#ffffff')
      .setSecondRowColor('#fbf9f0');
  }

  // Warn (not block) anyone editing header keys.
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter((p) => p.getDescription() === 'header');
  if (protections.length === 0) {
    header.protect().setDescription('header').setWarningOnly(true);
  }
}

function applyFormat(sheet, index, body, col) {
  const widths = { id: 60, int: 90, number: 100, money: 110, percent: 90, date: 110, datetime: 150, bool: 80, enum: 140, ref: 170, longtext: 280, text: 170 };
  sheet.setColumnWidth(index, widths[col.type] || 160);

  switch (col.type) {
    case 'id':
    case 'int':
      body.setNumberFormat('0');
      break;
    case 'number':
      body.setNumberFormat('#,##0.##');
      break;
    case 'money':
      body.setNumberFormat('"RM" #,##0.00');
      break;
    case 'percent':
      body.setNumberFormat('0.0%');
      break;
    case 'date':
      body.setNumberFormat('dd/mm/yyyy');
      break;
    case 'datetime':
      body.setNumberFormat('dd/mm/yyyy hh:mm');
      break;
    case 'longtext':
      body.setNumberFormat('@').setWrap(true);
      break;
    case 'bool':
      break;
    default:
      body.setNumberFormat('@'); // plain text keeps leading zeros (phone numbers) and stops auto-conversion
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function buildDashboard(ss) {
  const sheet = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard', 0);
  sheet.clear();
  sheet.getRange('A:H').clearDataValidations();
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
  sheet.setTabColor(APP.navy);
  sheet.setHiddenGridlines(true);

  const o = (key) => colRange(getHeaders(ss.getSheetByName('Orders')), key, 'Orders', true);
  const oi = (key) => colRange(getHeaders(ss.getSheetByName('OrderItems')), key, 'OrderItems', true);
  const p = (key) => colRange(getHeaders(ss.getSheetByName('Payments')), key, 'Payments', true);
  const inq = (key) => colRange(getHeaders(ss.getSheetByName('Inquiries')), key, 'Inquiries', true);
  const monthStart = 'EOMONTH(TODAY(),-1)+1';

  sheet.getRange('A1').setValue(`${APP.name} — Dashboard`).setFontSize(18).setFontWeight('bold').setFontColor(APP.navy);
  sheet.getRange('A2').setFormula('="Dikemaskini: "&TEXT(NOW(),"dd/mm/yyyy hh:mm")').setFontColor('#5d5c78');

  const kpis = [
    ['Jualan bulan ini', `=SUMIFS(${o('total')},${o('created_at')},">="&${monthStart},${o('cancelled_at')},"")`, '"RM" #,##0.00'],
    [
      'Helaian bulan ini',
      `=ARRAYFORMULA(SUMPRODUCT(${oi('quantity')},--(IFERROR(VLOOKUP(${oi('order_id')},{${o('id')},${o('created_at')}},2,FALSE),0)>=${monthStart})))`,
      '#,##0',
    ],
    ['Kutipan bulan ini', `=SUMIFS(${p('amount')},${p('paid_on')},">="&${monthStart})`, '"RM" #,##0.00'],
    ['Baki belum kutip', `=SUMIFS(${o('balance')},${o('cancelled_at')},"",${o('balance')},">0")`, '"RM" #,##0.00'],
    ['Job aktif (pending)', `=COUNTIFS(${o('id')},"<>",${o('stage')},"<>completed",${o('cancelled_at')},"")`, '0'],
    ['Lewat di kilang', `=COUNTIFS(${o('stage')},"production",${o('cancelled_at')},"",${o('production_received_at')},"",${o('due_date')},"<"&TODAY())`, '0'],
    ['Inquiry baru', `=COUNTIF(${inq('status')},"new")`, '0'],
    ['Purata rating', `=IFERROR(AVERAGE(${o('feedback_rating')}),"-")`, '0.0'],
  ];

  kpis.forEach(([label, formula, format], i) => {
    const col = 1 + (i % 4) * 2;
    const row = 4 + Math.floor(i / 4) * 3;
    sheet.getRange(row, col).setValue(label).setFontColor('#5d5c78').setFontSize(9);
    sheet.getRange(row + 1, col).setFormula(formula).setNumberFormat(format).setFontSize(16).setFontWeight('bold').setFontColor(APP.navy);
    sheet.getRange(row, col, 2, 1).setBackground('#ffffff').setBorder(true, true, true, true, false, false, '#e7e2cc', SpreadsheetApp.BorderStyle.SOLID);
  });

  // Pipeline by stage
  const pipelineRow = 11;
  sheet.getRange(pipelineRow, 1, 1, 3).setValues([['Peringkat', 'Bil. order', 'Helaian']]).setBackground(APP.navy).setFontColor(APP.cream).setFontWeight('bold');
  STAGES.filter((s) => s !== 'completed').forEach((stage, i) => {
    const r = pipelineRow + 1 + i;
    sheet.getRange(r, 1).setValue(`${i + 1}. ${STAGE_LABELS[stage]}`);
    sheet.getRange(r, 2).setFormula(`=COUNTIFS(${o('stage')},"${stage}",${o('cancelled_at')},"")`);
    sheet
      .getRange(r, 3)
      .setFormula(
        `=ARRAYFORMULA(SUMPRODUCT(${oi('quantity')},--ISNUMBER(MATCH(${oi('order_id')},FILTER(${o('id')},${o('stage')}="${stage}",${o('cancelled_at')}=""),0))))`,
      );
  });

  // Sales last 6 months
  const trendRow = 11;
  sheet.getRange(trendRow, 5, 1, 3).setValues([['Bulan', 'Jualan', 'Kutipan']]).setBackground(APP.navy).setFontColor(APP.cream).setFontWeight('bold');
  for (let k = 5; k >= 0; k--) {
    const r = trendRow + 1 + (5 - k);
    const start = `(EOMONTH(TODAY(),-${k + 1})+1)`;
    const end = `(EOMONTH(TODAY(),-${k})+1)`;
    sheet.getRange(r, 5).setFormula(`=TEXT(${start},"mmm yyyy")`);
    sheet.getRange(r, 6).setFormula(`=SUMIFS(${o('total')},${o('created_at')},">="&${start},${o('created_at')},"<"&${end},${o('cancelled_at')},"")`).setNumberFormat('"RM" #,##0');
    sheet.getRange(r, 7).setFormula(`=SUMIFS(${p('amount')},${p('paid_on')},">="&${start},${p('paid_on')},"<"&${end})`).setNumberFormat('"RM" #,##0');
  }

  [210, 110, 190, 40, 190, 120, 190, 40].forEach((width, i) => sheet.setColumnWidth(i + 1, width));

  // Sales chart
  sheet.getCharts().forEach((chart) => sheet.removeChart(chart));
  const chart = sheet
    .newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange(trendRow, 5, 7, 2))
    .setPosition(19, 1, 0, 0)
    .setOption('title', 'Jualan 6 bulan')
    .setOption('legend', { position: 'none' })
    .setOption('colors', [APP.navy])
    .setOption('width', 640)
    .setOption('height', 280)
    .build();
  sheet.insertChart(chart);
}

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

function seedSampleData() {
  const ss = SpreadsheetApp.getActive();
  const now = new Date();
  const seeded = [];

  const seed = (table, rows) => {
    if (readTable(table).length > 0) return;
    rows.forEach((row) => insertRow(table, row));
    seeded.push(table);
  };

  seed('Settings', [
    { key: 'company_name', value: APP.name, description: 'Nama syarikat pada invoice' },
    { key: 'company_phone', value: '60123456789', description: 'No. WhatsApp syarikat (format 60...)' },
    { key: 'bank_name', value: 'Maybank', description: 'Bank untuk bayaran' },
    { key: 'bank_account', value: '0000 0000 0000', description: 'No. akaun bank' },
    { key: 'production_days', value: '6', description: 'Hari bekerja kilang selepas jobsheet dihantar' },
    { key: 'deposit_percent', value: '50', description: 'Peratus deposit default' },
    { key: 'working_days', value: '1,2,3,4,5', description: 'Hari bekerja (1=Isnin ... 7=Ahad)' },
  ]);

  seed('Materials', [
    { code: 'MAT-EYELET', name: 'Microfiber Eyelet', category: 'Kain', gsm: 140, unit: 'kg', cost_per_unit: 28, supplier: 'Kilang Fabrik A', stock_qty: 50, reorder_level: 15, description: 'Berlubang halus, breathable. Paling popular untuk jersey bola.', active: true, updated_at: now },
    { code: 'MAT-INTERLOCK', name: 'Microfiber Interlock', category: 'Kain', gsm: 160, unit: 'kg', cost_per_unit: 30, supplier: 'Kilang Fabrik A', stock_qty: 40, reorder_level: 15, description: 'Permukaan licin, warna print sangat terang.', active: true, updated_at: now },
    { code: 'MAT-COOLMAX', name: 'Jersey Cool Max', category: 'Kain', gsm: 150, unit: 'kg', cost_per_unit: 32, supplier: 'Kilang Fabrik B', stock_qty: 30, reorder_level: 10, description: 'Cepat kering, sesuai untuk larian.', active: true, updated_at: now },
    { code: 'MAT-HONEYCOMB', name: 'Honeycomb', category: 'Kain', gsm: 180, unit: 'kg', cost_per_unit: 33, supplier: 'Kilang Fabrik B', stock_qty: 20, reorder_level: 10, description: 'Tekstur sarang lebah, sesuai untuk polo korporat.', active: true, updated_at: now },
    { code: 'MAT-SPANDEX', name: 'Spandex', category: 'Kain', gsm: 200, unit: 'kg', cost_per_unit: 38, supplier: 'Kilang Fabrik C', stock_qty: 10, reorder_level: 5, description: 'Elastik, untuk seluar & jersey ketat.', active: true, updated_at: now },
    { code: 'MAT-LYCRA', name: 'Lycra Premium', category: 'Lycra', gsm: 180, unit: 'kg', cost_per_unit: 45, supplier: 'Kilang Fabrik C', stock_qty: 12, reorder_level: 5, description: 'Untuk naik taraf Lycra.', active: true, updated_at: now },
    { code: 'MAT-RIB', name: 'Rib Knit Collar', category: 'Collar / Rib', gsm: '', unit: 'pcs', cost_per_unit: 1.2, supplier: 'Pembekal Aksesori', stock_qty: 500, reorder_level: 100, description: 'Kolar polo & hujung lengan.', active: true, updated_at: now },
    { code: 'MAT-POLYBAG', name: 'Polybag + Label HX', category: 'Packaging', gsm: '', unit: 'pcs', cost_per_unit: 0.35, supplier: 'Pembekal Packaging', stock_qty: 1000, reorder_level: 200, description: 'Pembungkusan setiap helai.', active: true, updated_at: now },
  ]);

  const tiers = [
    [1, 9, 55, 30],
    [10, 29, 45, 26],
    [30, 99, 40, 24],
    [100, '', 35, 22],
  ];
  const pricelist = [];
  [
    ['JRS-SS-EYE', 'Jersey', 'MAT-EYELET', 'Pendek', 'Round Neck', 0],
    ['JRS-LS-EYE', 'Jersey', 'MAT-EYELET', 'Panjang', 'Round Neck', 5],
    ['ESP-SS-INT', 'Jersey Esports', 'MAT-INTERLOCK', 'Pendek', 'V Neck', 3],
    ['POLO-SS-HNC', 'Corporate Polo', 'MAT-HONEYCOMB', 'Pendek', 'Polo Collar', 8],
  ].forEach(([code, product, material, sleeve, collar, extra]) => {
    tiers.forEach(([min, max, price, cost]) => {
      pricelist.push({ code: `${code}-${min}`, product, material_code: material, sleeve, collar, min_qty: min, max_qty: max, price: price + extra, cost: cost + extra * 0.5, active: true });
    });
  });
  seed('Pricelist', pricelist);

  seed('AddOns', [
    { code: 'ADD-LYCRA', name: 'Naik taraf Lycra', charge_type: 'per helai', price: 8, cost: 4, active: true },
    { code: 'ADD-LONG', name: 'Lengan panjang', charge_type: 'per helai', price: 5, cost: 2.5, active: true },
    { code: 'ADD-3XL', name: 'Saiz 3XL ke atas', charge_type: 'per helai', price: 3, cost: 1.5, active: true },
    { code: 'ADD-NAMENO', name: 'Nama & nombor custom', charge_type: 'per helai', price: 0, cost: 0, active: true, notes: 'Percuma' },
    { code: 'ADD-RUSH', name: 'Rush order (3 hari bekerja)', charge_type: 'per order', price: 150, cost: 80, active: true },
    { code: 'ADD-NAMESET', name: 'Nameset', charge_type: 'per helai', price: 0, cost: 0, active: true },
    { code: 'ADD-BACKTAPE', name: 'Backtape', charge_type: 'per helai', price: 0, cost: 0, active: true },
    { code: 'ADD-TESTPRINT', name: 'Test print', charge_type: 'per order', price: 0, cost: 0, active: true, notes: 'Dicaj sekali bagi setiap item yang minta test print.' },
  ]);

  const options = [];
  Object.entries({
    garment_type: ['Round Neck Short Sleeve', 'Long Sleeve', 'Muslimah', 'Polo Collar', 'Raglan', 'Singlet'],
    print_method: ['Sublimation', 'Silkscreen', 'Heatpress'],
    neck_type: ['Round Neck', 'V Neck', 'Polo Collar', 'Mandarin Collar', 'Hoodie'],
    neck_finish: ['Sublimation', 'Readymade'],
  }).forEach(([group, names]) => {
    names.forEach((name, i) => options.push({ group, name, price: 0, cost: 0, sort: i + 1, active: true }));
  });
  seed('ProductOptions', options);

  seed('Agents', [
    { name: 'Luqman', phone: '0121112222', area: 'MITS Pandan Indah', commission_type: 'per helai', commission_value: 4.5, active: true, created_at: now },
    { name: "Wan Nur 'Irdhina", phone: '0133334444', area: 'MITS Sabak Bernam', commission_type: 'percent', commission_value: 10, active: true, created_at: now },
  ]);

  SpreadsheetApp.getActive().toast(seeded.length ? 'Data contoh diisi: ' + seeded.join(', ') : 'Tiada tab kosong — data sedia ada tidak diubah.', APP.name, 8);
  ss.setActiveSheet(ss.getSheetByName('Dashboard') || ss.getSheets()[0]);
}

/* ------------------------------------------------------------------ */
/* Table helpers (used by setup, seed and the API)                     */
/* ------------------------------------------------------------------ */

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  return lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim()) : [];
}

function columnLetter(index) {
  let letter = '';
  while (index > 0) {
    const mod = (index - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    index = Math.floor((index - mod) / 26);
  }
  return letter;
}

/** "B2:B" (same sheet) or "'Payments'!B2:B" (other sheet) for a header key. */
function colRange(headers, key, sheetName, qualified) {
  const index = headers.indexOf(key) + 1;
  if (!index) throw new Error(`Column "${key}" tidak wujud dalam tab ${sheetName}`);
  const letter = columnLetter(index);
  return (qualified ? `'${sheetName}'!` : '') + `${letter}2:${letter}`;
}

function ensureColumns(sheet, count) {
  if (sheet.getMaxColumns() < count) sheet.insertColumnsAfter(sheet.getMaxColumns(), count - sheet.getMaxColumns());
}

function removeBlankDefaultSheet(ss) {
  ['Sheet1', 'Helaian1'].forEach((name) => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sheet);
  });
}

function tableSheet(table) {
  if (!SCHEMA[table]) throw new Error(`Table tidak dikenali: ${table}`);
  const sheet = SpreadsheetApp.getActive().getSheetByName(table);
  if (!sheet) throw new Error(`Tab ${table} belum wujud. Jalankan "Setup" dahulu.`);
  return sheet;
}

function columnDef(table, key) {
  return SCHEMA[table].columns.find((col) => col.key === key);
}

/** Last row that has an id (ignores checkbox / formula-only rows). */
function lastDataRow(sheet, headers) {
  const idIndex = headers.indexOf('id') + 1;
  const count = sheet.getMaxRows() - 1;
  if (!idIndex || count < 1) return 1;
  const ids = sheet.getRange(2, idIndex, count, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] !== '' && ids[i][0] !== null) return i + 2;
  }
  return 1;
}

function readTable(table) {
  const sheet = tableSheet(table);
  const headers = getHeaders(sheet);
  const last = lastDataRow(sheet, headers);
  if (last < 2) return [];

  const values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  return values
    .map((row, i) => {
      const record = { _row: i + 2 };
      headers.forEach((key, j) => {
        if (key) record[key] = toJson(table, key, row[j]);
      });
      return record;
    })
    .filter((record) => record.id !== null);
}

function findRowById(table, id) {
  return readTable(table).find((record) => String(record.id) === String(id)) || null;
}

function nextId(table) {
  const ids = readTable(table).map((record) => Number(record.id) || 0);
  return ids.length ? Math.max.apply(null, ids) + 1 : 1;
}

/** Writes only non-computed columns so ARRAYFORMULA columns are never overwritten. */
function writeRecord(sheet, rowIndex, headers, table, data) {
  let runStart = null;
  let runValues = [];

  const flush = () => {
    if (runStart !== null && runValues.length) sheet.getRange(rowIndex, runStart, 1, runValues.length).setValues([runValues]);
    runStart = null;
    runValues = [];
  };

  headers.forEach((key, i) => {
    const def = columnDef(table, key);
    const writable = def && !def.computed && Object.prototype.hasOwnProperty.call(data, key);
    if (!writable) return flush();
    if (runStart === null) runStart = i + 1;
    runValues.push(fromJson(def, data[key]));
  });
  flush();
}

function insertRow(table, data) {
  const sheet = tableSheet(table);
  const headers = getHeaders(sheet);
  const record = Object.assign({}, data);

  // Keep the id sent by the website so both databases share the same ids.
  record.id = record.id ? Number(record.id) : nextId(table);
  if (headers.indexOf('created_at') !== -1 && !record.created_at) record.created_at = new Date();
  if (headers.indexOf('updated_at') !== -1 && !record.updated_at) record.updated_at = new Date();
  if (table === 'Orders') {
    if (!record.order_no) record.order_no = nextOrderNo();
    if (!record.public_token) record.public_token = Utilities.getUuid().replace(/-/g, '');
    if (!record.stage) record.stage = 'order';
    if (!record.stage_entered_at) record.stage_entered_at = new Date();
  }
  if (table === 'Inquiries' && !record.status) record.status = 'new';

  const rowIndex = lastDataRow(sheet, headers) + 1;
  if (rowIndex > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  writeRecord(sheet, rowIndex, headers, table, record);

  return findRowById(table, record.id);
}

function updateRow(table, id, data) {
  const existing = findRowById(table, id);
  if (!existing) throw new Error(`${table} id ${id} tidak dijumpai`);

  const sheet = tableSheet(table);
  const headers = getHeaders(sheet);
  const changes = Object.assign({}, data);
  delete changes.id;
  if (headers.indexOf('updated_at') !== -1 && !changes.updated_at) changes.updated_at = new Date();

  writeRecord(sheet, existing._row, headers, table, changes);
  return findRowById(table, id);
}

/** Insert or update by id (used by the website sync). Returns only the id to stay fast. */
function upsertRow(table, data) {
  if (!data || !data.id) throw new Error('upsert perlukan id');
  const existing = findRowById(table, data.id);

  if (existing) {
    const changes = Object.assign({}, data);
    delete changes.id;
    const sheet = tableSheet(table);
    writeRecord(sheet, existing._row, getHeaders(sheet), table, changes);
    return { id: Number(data.id), action: 'updated' };
  }

  const sheet = tableSheet(table);
  const headers = getHeaders(sheet);
  const rowIndex = lastDataRow(sheet, headers) + 1;
  if (rowIndex > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  writeRecord(sheet, rowIndex, headers, table, data);
  return { id: Number(data.id), action: 'inserted' };
}

/** Missing rows are ignored so a sync batch never fails on an already-deleted row. */
function deleteRow(table, id) {
  const existing = findRowById(table, id);
  if (!existing) return { deleted: false, id: Number(id) };
  tableSheet(table).deleteRow(existing._row);
  return { deleted: true, id: existing.id };
}

/**
 * Replace every data row of a table in one write (full sync from the website).
 * Computed (ARRAYFORMULA) columns are left untouched.
 */
function replaceTable(table, rows) {
  const sheet = tableSheet(table);
  const headers = getHeaders(sheet);
  const last = lastDataRow(sheet, headers);
  const needed = rows.length + 1;
  if (needed > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows() + 100);

  // Contiguous runs of writable columns
  const segments = [];
  headers.forEach((key, i) => {
    const def = columnDef(table, key);
    if (!def || def.computed) return;
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.end === i - 1) {
      lastSegment.end = i;
      lastSegment.keys.push(key);
    } else {
      segments.push({ start: i, end: i, keys: [key] });
    }
  });

  segments.forEach((segment) => {
    const width = segment.keys.length;
    if (last >= 2) sheet.getRange(2, segment.start + 1, last - 1, width).clearContent();
    if (rows.length) {
      const matrix = rows.map((row) => segment.keys.map((key) => fromJson(columnDef(table, key), row[key])));
      sheet.getRange(2, segment.start + 1, rows.length, width).setValues(matrix);
    }
  });

  return { table, rows: rows.length };
}

function nextOrderNo() {
  const prefix = 'HX' + Utilities.formatDate(new Date(), APP.timezone, 'yyMM') + '-';
  const sequence = readTable('Orders')
    .map((order) => String(order.order_no || ''))
    .filter((no) => no.indexOf(prefix) === 0)
    .map((no) => parseInt(no.substring(prefix.length), 10) || 0)
    .reduce((max, n) => Math.max(max, n), 0);
  return prefix + String(sequence + 1).padStart(3, '0');
}

/* ------------------------------------------------------------------ */
/* Value conversion                                                    */
/* ------------------------------------------------------------------ */

function toJson(table, key, value) {
  if (value === '' || value === null || value === undefined) return null;
  const def = columnDef(table, key);
  const type = def ? def.type : 'text';

  if (value instanceof Date) {
    return Utilities.formatDate(value, APP.timezone, type === 'date' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss');
  }
  if (type === 'bool') return value === true || value === 'TRUE';
  if (['id', 'int', 'number', 'money', 'percent'].indexOf(type) !== -1) return Number(value);
  return String(value);
}

function fromJson(def, value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return value;

  switch (def.type) {
    case 'date':
    case 'datetime':
      return parseDate(value);
    case 'bool':
      return value === true || value === 'true' || value === 1 || value === '1';
    case 'id':
    case 'int':
    case 'number':
    case 'money':
    case 'percent': {
      const number = Number(value);
      return isNaN(number) ? '' : number;
    }
    default: {
      const text = String(value);
      // Neutralise formula injection from public forms (e.g. inquiries).
      return /^[=+\-@]/.test(text) ? "'" + text : text;
    }
  }
}

/** Parses "2026-10-03" or "2026-10-03 14:20:00" as Malaysia local time. */
function parseDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return '';
  return new Date(+match[1], +match[2] - 1, +match[3], +(match[4] || 0), +(match[5] || 0), +(match[6] || 0));
}

/* ------------------------------------------------------------------ */
/* API token                                                           */
/* ------------------------------------------------------------------ */

function ensureApiToken() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_TOKEN')) props.setProperty('API_TOKEN', Utilities.getUuid() + Utilities.getUuid().slice(0, 8));
  return props.getProperty('API_TOKEN');
}

function showApiToken() {
  SpreadsheetApp.getUi().alert('API token (simpan dalam .env Laravel sebagai GOOGLE_SHEETS_TOKEN):\n\n' + ensureApiToken());
}

function rotateApiToken() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Jana token baru? Token lama akan berhenti berfungsi.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty('API_TOKEN');
  showApiToken();
}

/* ------------------------------------------------------------------ */
/* Web App API                                                         */
/* ------------------------------------------------------------------ */
/*
 * Deploy: Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *
 * GET  {url}?token=...&action=ping
 * GET  {url}?token=...&action=list&table=Orders[&field=stage&value=design]
 * GET  {url}?token=...&action=get&table=Orders&id=5
 * GET  {url}?token=...&action=schema
 *
 * POST {url}  body JSON:
 *   { "token": "...", "action": "insert", "table": "Payments", "data": { "order_id": 5, "amount": 200, ... } }
 *   { "token": "...", "action": "update", "table": "Orders", "id": 5, "data": { "stage": "design" } }
 *   { "token": "...", "action": "upsert", "table": "Orders", "data": { "id": 5, ... } }   (insert or update by id)
 *   { "token": "...", "action": "replace", "table": "Orders", "rows": [ {...}, ... ] }   (full table sync)
 *   { "token": "...", "action": "delete", "table": "Payments", "id": 9 }
 *   { "token": "...", "action": "batch",  "operations": [ { "action": "insert", ... }, ... ] }
 *
 * Response: { "ok": true, "data": ... } or { "ok": false, "error": "..." }
 */

function doGet(e) {
  return respond(() => {
    const params = e.parameter || {};
    authorize(params.token);

    switch (params.action) {
      case 'ping':
        return { app: APP.name, time: Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd HH:mm:ss') };
      case 'schema':
        return Object.keys(SCHEMA).reduce((out, table) => {
          out[table] = SCHEMA[table].columns.map((col) => ({ key: col.key, type: col.type, computed: !!col.computed, options: col.options || null }));
          return out;
        }, {});
      case 'list': {
        let rows = readTable(params.table);
        if (params.field) rows = rows.filter((row) => String(row[params.field]) === String(params.value));
        return rows.map(stripRow);
      }
      case 'get': {
        const row = findRowById(params.table, params.id);
        if (!row) throw new Error('Rekod tidak dijumpai');
        return stripRow(row);
      }
      default:
        throw new Error('action tidak sah');
    }
  });
}

function doPost(e) {
  return respond(() => {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    authorize(body.token);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000); // one writer at a time keeps ids unique
    try {
      if (body.action === 'batch') return (body.operations || []).map(runOperation);
      return runOperation(body);
    } finally {
      lock.releaseLock();
    }
  });
}

function runOperation(op) {
  switch (op.action) {
    case 'insert':
      return stripRow(insertRow(op.table, op.data || {}));
    case 'update':
      return stripRow(updateRow(op.table, op.id, op.data || {}));
    case 'upsert':
      return upsertRow(op.table, op.data || {});
    case 'replace':
      return replaceTable(op.table, op.rows || []);
    case 'delete':
      return deleteRow(op.table, op.id);
    default:
      throw new Error(`action tidak sah: ${op.action}`);
  }
}

function authorize(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected || token !== expected) throw new Error('Unauthorized');
}

function stripRow(row) {
  if (!row) return row;
  const copy = Object.assign({}, row);
  delete copy._row;
  return copy;
}

function respond(fn) {
  let payload;
  try {
    payload = { ok: true, data: fn() };
  } catch (error) {
    payload = { ok: false, error: String(error.message || error) };
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
