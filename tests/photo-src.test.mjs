import { test } from "node:test";
import assert from "node:assert/strict";
import { photoPathsOf, photoSrc, thumbPathFor, thumbSize } from "../js/photo-src.js";

test("thumbSize: long side capped at 320, aspect kept, never enlarged", () => {
  assert.deepEqual(thumbSize(4000, 3000), { width: 320, height: 240 });
  assert.deepEqual(thumbSize(3000, 4000), { width: 240, height: 320 });
  assert.deepEqual(thumbSize(200, 100), { width: 200, height: 100 });
  assert.deepEqual(thumbSize(5000, 1), { width: 320, height: 1 });
});

test("thumbPathFor: same folder, thumb_ prefix, .jpg extension", () => {
  assert.equal(thumbPathFor("players/THAWEE SC/1700_a.png"), "players/THAWEE SC/thumb_1700_a.jpg");
  assert.equal(thumbPathFor("coachPhotos/u1/1700_x.y.jpeg"), "coachPhotos/u1/thumb_1700_x.y.jpg");
  assert.equal(thumbPathFor("coachPhotos/u1/noext"), "coachPhotos/u1/thumb_noext.jpg");
});

test("photoSrc: thumbnail first, full photo for older records, only https", () => {
  assert.equal(photoSrc({ photoUrl: "https://x/full.jpg", photoThumbUrl: "https://x/t.jpg" }), "https://x/t.jpg");
  assert.equal(photoSrc({ photoUrl: "https://x/full.jpg" }), "https://x/full.jpg");
  assert.equal(photoSrc({ photoUrl: "https://x/full.jpg", photoThumbUrl: null }), "https://x/full.jpg");
  assert.equal(photoSrc({ photoUrl: "javascript:alert(1)", photoThumbUrl: "http://insecure/t.jpg" }), "");
  assert.equal(photoSrc(null), "");
});

test("photoPathsOf: original and thumbnail are both removed together", () => {
  assert.deepEqual(photoPathsOf({ photoPath: "a/b.jpg", photoThumbPath: "a/thumb_b.jpg" }), ["a/b.jpg", "a/thumb_b.jpg"]);
  assert.deepEqual(photoPathsOf({ photoPath: "a/b.jpg" }), ["a/b.jpg"]);
  assert.deepEqual(photoPathsOf({}), []);
});
