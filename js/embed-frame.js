// ฝังหน้าเดิม (masc.html = Footelligence Test, report-card.html = สมุดพก) ไว้ในกรอบเมนูของโค้ช แทนการพาออกไปหน้าแยก
// หน้าที่ฝังจะซ่อนหัว/ท้ายหน้าและปุ่มย้อนกลับของตัวเองเมื่ออยู่ใน iframe (ดู class "embedded" ใน styles.css) และปรับความสูงของกรอบให้พอดีเนื้อหา
// เป็นหน้าเดียวกับเว็บ (same-origin) จึงใช้การล็อกอินร่วมกัน — vercel.json อนุญาต frame เฉพาะจากหน้าของเว็บเองเท่านั้น (SAMEORIGIN)

const MIN_HEIGHT_PX = 480;

// URL ของหน้าที่ฝัง: ./masc.html#embed=1&team=... — ตัวเลือกใน hash (หน้าเดิมอ่านค่าจาก hash อยู่แล้ว)
export function embedUrl(page, params = {}) {
  const p = new URLSearchParams({ embed: "1" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  return `./${page}#${p.toString()}`;
}

function stopWatching(frame) {
  frame._observer?.disconnect();
  if (frame._timer) clearInterval(frame._timer);
  frame._observer = null;
  frame._timer = null;
}

// ปรับความสูงกรอบตามเนื้อหาข้างใน (เนื้อหาเปลี่ยนตามการกรอก/เลือกนักกีฬา จึงเฝ้าดูต่อเนื่อง)
function watchHeight(frame) {
  stopWatching(frame);
  let doc = null;
  try {
    doc = frame.contentDocument;
  } catch {
    return;
  }
  if (!doc || !doc.documentElement) return;
  const fit = () => {
    const h = Math.max(doc.documentElement.scrollHeight, MIN_HEIGHT_PX);
    if (frame.style.height !== `${h}px`) frame.style.height = `${h}px`;
  };
  fit();
  if (typeof ResizeObserver === "function") {
    frame._observer = new ResizeObserver(fit);
    frame._observer.observe(doc.documentElement);
    if (doc.body) frame._observer.observe(doc.body);
  }
  frame._timer = setInterval(() => (frame.isConnected && frame.offsetParent !== null ? fit() : null), 1000);
}

// แสดงหน้า page ในกรอบ — key เดิม = ไม่โหลดซ้ำ (คงสถานะที่กรอกค้างไว้) · reload: true = โหลดใหม่ทุกครั้ง (เช่น เปลี่ยนช่วงสมุดพก)
export function showEmbedded(frame, page, params = {}, { reload = false } = {}) {
  const url = embedUrl(page, params);
  frame.classList.remove("hidden");
  if (frame.dataset.url === url && !reload) return;
  frame.dataset.url = url;
  frame.style.height = `${MIN_HEIGHT_PX}px`;
  // ใส่ query กันเบราว์เซอร์มองว่าเป็นหน้าเดิม (เปลี่ยนแค่ hash จะไม่โหลดใหม่) หน้าที่ฝังอ่านค่าจาก hash เท่านั้น
  frame.onload = () => watchHeight(frame);
  frame.src = url.replace("#", `?v=${Date.now()}#`);
}

// ปิดกรอบและล้างเนื้อหา (ไม่ค้างข้อมูลของรอบก่อนไว้หลังช่วงเปิดสมุดพกสิ้นสุด)
export function clearEmbedded(frame) {
  stopWatching(frame);
  frame.onload = null;
  frame.classList.add("hidden");
  delete frame.dataset.url;
  frame.src = "about:blank";
}
