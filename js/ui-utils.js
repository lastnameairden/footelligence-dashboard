// เติม data-label ให้แต่ละ <td> อัตโนมัติจากหัวตาราง (thead th) ของ <table> เดียวกัน
// ใช้คู่กับ CSS ใน styles.css ที่แปลงตารางเป็นรูปแบบการ์ดบนจอมือถือ (iOS/Android)
export function applyDataLabels(tbody) {
  if (!tbody) return;
  const table = tbody.closest("table");
  if (!table) return;
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
  Array.from(tbody.children).forEach((tr) => {
    const cells = Array.from(tr.children);
    if (cells.length === 1 && cells[0].hasAttribute("colspan")) return;
    cells.forEach((td, i) => {
      if (headers[i]) td.setAttribute("data-label", headers[i]);
    });
  });
}
