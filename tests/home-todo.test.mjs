import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTodoItems, todoIndex, todoCountText, todoCarouselHtml } from "../js/home-todo.js";

const note = { id: "n1", refLabel: "MASC 2/2569", message: "เริ่มรอบประเมิน", type: "masc_round", createdBy: "แอดมิน", postedAt: "23 พ.ย. 2569" };

test("buildTodoItems: order is daily → Event → meeting tasks → unread notes", () => {
  const items = buildTodoItems({
    daily: ["report", "checkin"],
    event: { monthLabel: "ธันวาคม 2569", deadlineLabel: "25 พ.ย.", leftText: "เหลืออีก 2 วัน" },
    meetingTasks: [{ dateLabel: "19 พ.ย.", deadlineLabel: "28 พ.ย.", leftText: "เหลือ 5 วัน", overdue: false }],
    notes: [note]
  });
  assert.deepEqual(items.map((i) => i.key), ["daily-report", "daily-checkin", "event", "meeting-0", "note-n1"]);
});

test("buildTodoItems: nothing pending → no items; unknown daily keys are ignored", () => {
  assert.deepEqual(buildTodoItems(), []);
  assert.deepEqual(buildTodoItems({ daily: ["nope"] }), []);
});

test("buildTodoItems: Event and meeting wording", () => {
  const [ev, mt, od] = buildTodoItems({
    event: { monthLabel: "ธันวาคม 2569", deadlineLabel: "25 พ.ย.", leftText: "เหลืออีก 2 วัน" },
    meetingTasks: [
      { dateLabel: "19 พ.ย.", deadlineLabel: "28 พ.ย.", leftText: "เหลือ 5 วัน", overdue: false },
      { dateLabel: "5 พ.ย.", deadlineLabel: "28 พ.ย.", leftText: "เหลือ 5 วัน", overdue: true }
    ]
  });
  assert.equal(ev.title, "ยังไม่ได้แจ้ง Event ของเดือนธันวาคม 2569");
  assert.equal(ev.detail, "กรอกภายใน 25 พ.ย. · เหลืออีก 2 วัน");
  assert.equal(mt.detail, "ยังไม่ส่ง · เหลือ 5 วัน (ส่งได้ถึง 28 พ.ย.)");
  assert.match(od.detail, /เลยกำหนดแล้ว/);
  assert.deepEqual(mt.actions, [{ label: "ไปกรอกเลย →", go: "meeting" }]);
});

test("buildTodoItems: only MASC notes get a go-to-evaluate action; every note can be marked read", () => {
  const [masc, plain] = buildTodoItems({ notes: [note, { id: "n2", message: "ข้อความทั่วไป", type: "coach" }] });
  assert.deepEqual(masc.actions.map((a) => a.go ?? `read:${a.readId}`), ["masc", "read:n1"]);
  assert.deepEqual(plain.actions.map((a) => a.go ?? `read:${a.readId}`), ["read:n2"]);
  assert.equal(plain.title, "ข้อความจากผู้ดูแลระบบ");
  assert.match(plain.meta, /^จาก ผู้ดูแลระบบ/);
});

test("todoIndex / todoCountText: nearest card, clamped", () => {
  assert.equal(todoIndex(0, 300, 5), 0);
  assert.equal(todoIndex(160, 300, 5), 1);
  assert.equal(todoIndex(5000, 300, 5), 4);
  assert.equal(todoIndex(-20, 300, 5), 0);
  assert.equal(todoIndex(100, 0, 5), 0);
  assert.equal(todoIndex(100, 300, 0), 0);
  assert.equal(todoCountText(0, 6), "1 / 6");
});

test("todoCarouselHtml: empty = all-done message; one card = no arrows/dots; several = counter, arrows, dots", () => {
  assert.match(todoCarouselHtml([]), /ทำครบแล้ว ไม่มีงานค้าง/);
  const one = todoCarouselHtml(buildTodoItems({ daily: ["checkin"] }));
  assert.doesNotMatch(one, /data-todo-step|data-todo-dots|data-todo-count/);
  assert.match(one, /todo-card-single/);
  const many = todoCarouselHtml(buildTodoItems({ daily: ["checkin", "plan", "report"] }));
  assert.match(many, /1 \/ 3/);
  assert.equal((many.match(/data-todo-step/g) || []).length, 2);
  assert.equal((many.match(/class="todo-dot[ "]/g) || []).length, 3);
});

test("todoCarouselHtml: escapes message text", () => {
  const html = todoCarouselHtml(buildTodoItems({ notes: [{ id: "x", refLabel: "<b>a</b>", message: "<img src=x onerror=1>", type: "coach" }] }));
  assert.doesNotMatch(html, /<img|<b>/);
});
