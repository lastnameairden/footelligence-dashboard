# FOOTELLIGENCE DATA

ระบบจัดการข้อมูลนักกีฬาและการฝึกซ้อมของอะคาเดมีฟุตบอล — เว็บ static (HTML + JavaScript ES modules ล้วน ไม่มีขั้นตอน build
ของฝั่งโค้ด) ใช้ Firebase (Auth, Firestore, Storage) เป็น backend และ deploy บน Vercel ที่ `footelligence.com`

- Firebase project: `footelligence-b1ca9`
- 3 ทีม: KHAMPHEE FOOTBALL, THAWEE SC, THAMMASATHIT
- บทบาท: `coach` (จัดการข้อมูลทีมตัวเอง), `executive` (ผู้บริหารทีม ดูอย่างเดียว), `admin` (ผู้ดูแลระบบ เห็น/จัดการทุกทีม
  อนุมัติบัญชี กำหนดรอบ MASC) — ผู้ลงทะเบียนใหม่มีสถานะ `pending` จนกว่าแอดมินจะอนุมัติ

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
| --- | --- |
| `index.html` + `js/app.js` | Dashboard |
| `attendance.html` + `js/attendance.js` | เข้าสู่ระบบ/ลงทะเบียน, หน้าโค้ช (เช็คชื่อ ให้คะแนน รายงาน แผนฝึก) และแผงผู้ดูแลระบบ (ไฟล์ใหญ่สุด) |
| `masc.html` + `js/masc.js`, `js/masc-data.js` | ประเมิน MASC (Motricity / Availability / Smart / Commitment) เป็นรอบ |
| `report-card.html` + `js/report-card.js` | สมุดพกนักกีฬา (แอดมิน) พิมพ์ทั้งชุด |
| `print.html` + `js/print.js` | สรุปผลงานโค้ชสำหรับพิมพ์ A4 |
| `player.html` + `js/player.js`, `development.html` + `js/development.js` | ข้อมูลและพัฒนาการนักกีฬา |
| `js/ui-utils.js` | ฟังก์ชันร่วม: `escapeHtml`, `safeHttpUrl`, query รายเดือน, กฎ "ส่งสาย", โควตารายเดือน, กราฟ SVG |
| `js/icons.js` | ชุดไอคอนเส้น (inline SVG) แทนอิโมจิ — `icon("ชื่อ")` คืน SVG ขนาด `1em` สี `currentColor` (ปรับตามฟอนต์/สีของ element ที่ห่อเอง) |
| `js/firebase-config.js`, `js/firebase-init.js` | ตั้งค่า Firebase (config ฝั่งเว็บเป็นข้อมูลสาธารณะโดยธรรมชาติ ความปลอดภัยอยู่ที่ rules) |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Security rules และ index — deploy ด้วย Firebase CLI |
| `vercel.json` | Security headers รวม CSP |
| `css/styles.css`, `css/tailwind.css` | ดีไซน์ระบบ / Tailwind ที่ build แล้ว (commit ไว้) |
| `tests/` | เทสต์ (ดูด้านล่าง) |

## ข้อมูลใน Firestore

`coaches` (บัญชี/บทบาท/ทีม/รุ่นอายุ), `players`, `sessions`, `attendance`, `trainingReports`, `matchReports`,
`injuryReports`, `trainingPlans`, `executiveNotes`, `adminNotificationReads`, `playerEvaluations` (MASC),
`playerReportCards`, `mascRounds` (รอบ MASC ที่แอดมินกำหนด)

ไฟล์ใน Storage แยกโฟลเดอร์ตามทีม: `players/{team}/…`, `trainingPlans/{team}/…`, `trainingReports/{team}/…`
(รูปรายงานเปิดเฉพาะ THAWEE SC)

## เรื่องที่ต้องรู้ก่อนแก้โค้ช

**Firestore rules กับ query** — rules ที่อ้าง `resource.data.team` จะปฏิเสธ query (list) ที่ไม่มี `where("team", "==", …)`
ทั้ง query ("Missing or insufficient permissions") ทุก query ของโค้ช/ผู้บริหารต้องกรอง `team` เสมอ (แอดมินไม่ถูกจำกัด)
query ที่รวม `team ==` กับช่วง `date` ต้องมี composite index ใน `firestore.indexes.json` (สร้างและรอให้ READY ก่อน
push โค้ดที่ใช้)

**XSS** — ข้อมูลที่ผู้ใช้กรอก (ชื่อ หมายเหตุ ฯลฯ) ที่ใส่ลง `innerHTML` ต้องผ่าน `escapeHtml()` เสมอ ส่วน URL ที่มาจากข้อมูล
(รูป) ผ่าน `safeHttpUrl()`

**CSP** — `script-src` อนุญาตแค่ไฟล์ของเว็บเองกับ `www.gstatic.com` (Firebase SDK) ห้ามเขียน inline handler
(`onclick="…"`) หรือ `<script>` แบบ inline ใช้ `addEventListener` แทน ถ้าเพิ่มบริการภายนอกใหม่ (โดเมนรูป ฟอนต์ API)
ต้องเพิ่มใน `vercel.json`

**Tailwind** — build เป็นไฟล์ static ไม่ได้ใช้ CDN หลังเพิ่ม/เปลี่ยน class ใน HTML หรือ JS ให้สร้าง `css/tailwind.css` ใหม่
แล้ว commit (ต้องมี Node):

```bash
npx tailwindcss@3.4.17 -c tailwind.config.js -i css/tailwind.input.css -o css/tailwind.css --minify
```

ลิงก์ `tailwind.css` ต้องอยู่ท้ายสุดของ `<head>` ทุกหน้า (ลำดับ CSS มีผล) — เทสต์ตรวจให้

**MASC** — โค้ชสร้าง/แก้/ลบการประเมินได้เมื่อมีรอบ (`mascRounds`) ที่ `startDate ≤ วันนี้(UTC) ≤ endDate` เท่านั้น ทั้งในหน้าเว็บ
และ Firestore rules (เอกสารต้องมี `roundId` ชี้รอบนั้น) รอบแก้ไขสำหรับนักกีฬาที่ยังประเมินไม่ครบใช้ label เดิมของรอบเก่า
นักกีฬาถือว่า "ประเมินครบ" เมื่อทั้ง 4 หมวด (M/A/S/C) มีคะแนนครบ 4 ข้อ (`categoryRawScore` ไม่เป็น null)

**รีเฟรชแล้วอยู่หน้าเดิม** — attendance.html สลับหลายจอด้วยการซ่อน/แสดง จึงเก็บจอปัจจุบัน (และวันที่ทีเลือก, โหมดสวมบทบาทของแอดมิน) ไว้ใน URL hash ผ่าน `history.replaceState` (รูปแบบอยู่ที่ `js/screen-route.js`, ผูกกับหน้าที่ `ROUTE_SCREENS` ใน `attendance.js`) ถ้าเพิ่มจอ (section) ใหม่ต้องเพิ่มใน `ROUTE_SCREENS` ด้วย — เทสต์ตรวจให้ ส่วนหน้า MASC จำรุ่นอายุ/นักกีฬาที่เลือกไว้ใน hash (`age`, `player`) ข้อมูลที่กรอกค้างในฟอร์มยังไม่ถูกเก็บ

**การจับคู่โค้ช** — ใช้ `coachName` ไม่ใช่ `coachId` เพราะตอนแอดมินสวมบทบาทเป็นโค้ช `coachId` จะเป็น uid ของแอดมิน

## รันในเครื่อง

เปิดเป็นเว็บ static ธรรมดา (ต้องเปิดผ่าน http ไม่ใช่ไฟล์ตรงๆ เพราะใช้ ES modules) เช่น

```bash
npx serve .
```

ล็อกอินจริงกับ Firebase project จริง — ระวังว่าข้อมูลที่แก้ในเครื่องคือข้อมูลจริง และ Firebase Auth ต้องมี
`localhost` ใน Authorized domains

## Deploy

| อะไร | ทำอย่างไร |
| --- | --- |
| เว็บ (HTML/JS/CSS/`vercel.json`) | `git push` ไป `main` — Vercel deploy production ให้อัตโนมัติ (ย้อนกลับได้ด้วย Instant Rollback ในหน้า Vercel) |
| Firestore rules | `firebase deploy --only firestore:rules --project footelligence-b1ca9` |
| Firestore indexes | `firebase deploy --only firestore:indexes --project footelligence-b1ca9` |
| Storage rules | `firebase deploy --only storage --project footelligence-b1ca9` |

ลองตรวจ rules ก่อน deploy จริงด้วย `--dry-run` (เช็ค compile) ลำดับที่ปลอดภัยเมื่อ rules กับโค้ดผูกกัน: push โค้ดที่
"ทำงานได้กับทั้ง rules เก่าและใหม่" ก่อน แล้วค่อย deploy rules ตามหลัง (เช่น รอบ MASC: โค้ดส่ง `roundId` ก่อน แล้วค่อยบังคับใน rules)

Storage rules อ่านบัญชีโค้ชจาก Firestore ข้ามบริการด้วย `firestore.get()` — ถ้าอัปโหลดไฟล์ขึ้น `storage/unauthorized`
ทั้งที่เป็นโค้ชทีมนั้น ให้ตรวจ role "Firebase Rules Firestore Service Agent" ของ service account Storage ใน Google Cloud
Console → IAM

## เทสต์

ใช้ตัวรันเทสต์ในตัวของ Node (ต้อง Node 22.15 ขึ้นไป) **ไม่ต้องติดตั้งแพ็กเกจใดๆ** และไม่มี `package.json`
(ตั้งใจ — ไม่ให้ Vercel และโฟลเดอร์ Google Drive ต้องมี `node_modules`)

```bash
node --import ./tests/setup.mjs --test "tests/*.test.mjs"
```

| ไฟล์ | ตรวจอะไร |
| --- | --- |
| `tests/ui-utils.test.mjs` | `escapeHtml`/`safeHttpUrl`, query รายเดือนต้องมี `team ==`, กฎ "ส่งสาย", ความเป็นเจ้าของนักกีฬา, ลำดับรุ่นอายุ, อายุ |
| `tests/attendance-save.test.mjs` | บันทึกเช็คชื่อ/คะแนนแบบอัปเดตหน้าจอทันที: แตะเร็วๆ ไม่ทับกัน, คิวเขียนเรียงลำดับต่อนักกีฬา, นับรายการรอส่ง, ล้มเหลวแล้วไม่ค้างคิว |
| `tests/screen-route.test.mjs` | รูปแบบ URL hash ที่จำหน้าจอปัจจุบัน (รีเฟรชแล้วกลับหน้าเดิม): สร้าง/อ่านกลับครบทุกฟิลด์ ตัดค่าที่ไม่ถูกต้องทิ้ง |
| `tests/icons.test.mjs` | `icon("ชื่อ")` คืน SVG จริง, fallback เมื่อชื่อไม่มีจริง, ทุกจุดที่เรียก `icon("...")` ทั่ว `js/*.js` สะกดชื่อถูกต้อง (กันไอคอนเงียบๆ กลายเป็นสามเหลี่ยมเตือน) |
| `tests/masc-data.test.mjs` | สูตรคะแนน MASC / เกรด / ข้อมูลเกณฑ์ครบทุกตำแหน่ง×ช่วงวัย×หมวด |
| `tests/site-integrity.test.mjs` | ทุกหน้าลิงก์ Tailwind ที่ build แล้ว, ไม่มี inline handler (CSP), class ที่ใช้มี CSS ครบ (ลืม build), CSP ไม่หละหลวม, rules ไม่เปิดกว้าง, ไฟล์ index ถูกต้อง |

`tests/setup.mjs` สลับ Firebase SDK (URL จาก gstatic) และ `firebase-init.js` เป็นตัวจำลองใน `tests/stubs/` เพื่อให้ไฟล์ใน `js/`
รันใน Node ได้

**ยังไม่ครอบคลุม** — พฤติกรรมของ Firestore/Storage rules จริง (ใครอ่าน/เขียนอะไรได้) ต้องใช้ Firebase Emulator ซึ่งต้องมี Java
และ `@firebase/rules-unit-testing`; ตอนนี้ตรวจแค่โครงสร้างของไฟล์ rules และต้องทดสอบด้วยบัญชีจริงหลัง deploy ส่วนโค้ดที่ผูกกับหน้าจอ
(`attendance.js`, `masc.js`, `print.js` ฯลฯ) ยังไม่มีเทสต์อัตโนมัติ
