// พิมพ์เฉพาะ .print-sheet: ใส่ class ให้ body ชั่วคราว (CSS @media print ซ่อนส่วนอื่น) + ตั้งขนาดกระดาษผ่าน <style> ชั่วคราว แล้วคืนค่าเมื่อพิมพ์เสร็จ
// pageCss เช่น "size: A4 landscape; margin: 7mm;" — ใช้ร่วมกันทุกหน้าที่พิมพ์แบบฟอร์ม/รายงาน (Match Data, Physical Test)
export function printSheet(pageCss) {
  const style = document.createElement("style");
  style.textContent = `@page { ${pageCss} }`;
  document.head.appendChild(style);
  document.body.classList.add("printing-sheet");
  const cleanup = () => {
    document.body.classList.remove("printing-sheet");
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
