// ---------- ข้อมูลเกณฑ์การประเมิน MASC (Motricity / Availability / Smart / Commitment) ----------
// ดึงมาจากระบบประเมิน MASC เดิมที่ใช้อยู่แล้วจริงในสนาม (ทุกทีมใช้เกณฑ์ชุดเดียวกัน ต่างกันแค่สี/โลโก้)
// เป็นข้อมูลอ้างอิงคงที่ (ไม่ต้องแก้ไขผ่านแอป) แยกไว้เป็นไฟล์เดียวเพื่อไม่ให้ปนกับ logic ของหน้าฟอร์ม
// โครงสร้าง CRITERIA[position][ageBracket][category] = [[ไทย, English], ...] รายการแรกของแต่ละหมวด (index 0)
// คือเกณฑ์ CORE (ถ่วงน้ำหนัก 40%) ที่เหลืออีก 3 รายการเป็นเกณฑ์ SUP (Support ถ่วงน้ำหนักข้อละ 20%)

/* ===== meta ===== */
export const AGES = {
  "U6-8":{th:"ยึดตัวเองเป็นศูนย์กลาง",en:"Egocentric"},
  "U9-12":{th:"สะสมทักษะรายบุคคล",en:"Summative"},
  "U13-14":{th:"เชื่อมรายบุคคลสู่การเล่นเป็นทีม",en:"Summative to Collective"},
  "U15-18":{th:"การเล่นเพื่อส่วนรวม / ทีม",en:"Collective"}
};
export const POS = {
  GK:{th:"ผู้รักษาประตู",en:"Goalkeeper",marks:[[0.5,0.93]]},
  CB:{th:"กองหลังตัวกลาง",en:"Center Back",marks:[[0.5,0.80]]},
  "FB/WB":{th:"แบ็ก / วิงแบ็ก",en:"Fullback / Wingback",marks:[[0.16,0.78],[0.84,0.78]]},
  CM:{th:"กองกลาง",en:"Central Midfielder",marks:[[0.5,0.52]]},
  WG:{th:"ปีก",en:"Winger",marks:[[0.16,0.26],[0.84,0.26]]},
  ST:{th:"กองหน้าตัวเป้า",en:"Striker",marks:[[0.5,0.12]]}
};
export const SECT = {
  M:{nm:"MOTRICITY",th:"สมรรถภาพ & การเคลื่อนไหว"},
  A:{nm:"AVAILABILITY",th:"ความสัมพันธ์กับลูกบอล"},
  S:{nm:"SMART",th:"การอ่านเกม & การรับรู้"},
  C:{nm:"COMMITMENT",th:"ทัศนคติ & ความทุ่มเท"}
};
export const SB = [["มาเรียนสม่ำเสมอ / ตรงต่อเวลา","Attendance & Punctuality"],
  ["ระเบียบวินัย / มารยาท","Discipline & Manners"],
  ["ทัศนคติ / รับฟังและปรับปรุง","Attitude & Coachability"]];

/* ===== DATA  [Thai, English]; index0 = Core ===== */
export const CRITERIA = {
ST:{
"U6-8":{M:[["ปฏิกิริยาตอบสนองต่อลูกบอล","Reaction to the ball"],["การวิ่งสปรินต์ทางตรง","Straight-line sprint"],["การทรงตัวเมื่อเตะบอล","Balance when kicking"],["การกระโดดพื้นฐาน","Basic jumping"]],
A:[["การเตะบอลไปข้างหน้า (Basic Shooting)","Forward kick / basic shot"],["การหยุดบอล","Stopping the ball"],["การเลี้ยงบอลตรงๆ","Dribbling straight"],["แตะบอลด้วยข้างเท้าด้านใน","Inside-foot touch"]],
S:[["การรู้ตำแหน่งประตูคู่แข่ง","Knowing the opponent goal"],["การมองเห็นลูกบอลตลอด","Always watching the ball"],["การรู้ทิศทางการบุก","Sense of attacking direction"],["แยกแยะสีเสื้อเพื่อนร่วมทีม","Recognising teammates"]],
C:[["ความกระหายอยากทำประตู","Hunger to score"],["วิ่งไล่ตามลูกบอล","Chasing the ball"],["ลุกขึ้นไวเมื่อล้ม","Quick to get up"],["ความสนุกในการเล่น","Enjoyment of playing"]]},
"U9-12":{M:[["ความเร็วระยะสั้น 5-10 เมตร","Short speed 5-10m"],["การบังบอลพิงคู่แข่ง","Shielding the ball"],["การเปลี่ยนทิศทางกะทันหัน","Sudden change of direction"],["การกระโดดโหม่งเบื้องต้น","Basic jump heading"]],
A:[["การยิงประตูเมื่อมีโอกาส","Shooting when there's a chance"],["การจับบอลแรกให้อยู่","First-touch control"],["การเลี้ยงดวล 1v1","1v1 dribbling"],["การจ่ายบอลสั้นให้เพื่อน","Short pass to teammate"]],
S:[["การหาพื้นที่ว่างหน้าประตู","Finding space in front of goal"],["การมองหาช่องว่าง","Looking for gaps"],["ถอยมารับบอลเมื่อเพื่อนตัน","Drop to receive when blocked"],["เตรียมพร้อมซ้ำดาบสอง","Ready for the second ball"]],
C:[["วิ่งไล่กดดันเมื่อคู่แข่งเริ่มเขี่ยบอล","Press when opponent gets the ball"],["กล้าตัดสินใจยิง","Brave to shoot"],["ไม่ท้อเมื่อยิงพลาด","Not discouraged after a miss"],["ช่วยเพื่อนเล่นเกมรับแดนบน","Help defend high up"]]},
"U13-14":{M:[["สปีดต้นในระยะสั้นกรอบเขตโทษ","Initial speed in the box"],["ความแข็งแกร่งในการบังบอลพื้นฐาน","Strength in shielding"],["การเบรกฉีกหนีตัวประกบ","Breaking away from marker"],["การเทกตัวสู้ลูกกลางอากาศ","Aerial duels (Basic)"]],
A:[["การทำประตูเมื่อมีโอกาส","Finishing (Basic)"],["การพักบอลให้เพื่อนเติม","Hold-up play"],["การโหม่งทำประตูเบื้องต้น","Heading to score"],["รับบอลเมื่อมีคนกดดัน","Receiving under pressure"]],
S:[["อ่านจุดตกของบอลในกรอบ","Reading ball drop"],["การวิ่งฉีกแนวรับเบื้องต้น","Run to break the line"],["การดึงตัวประกบให้ตามมา","Dragging markers away"],["เลือกมุมยิงที่เหมาะสม","Choosing the right angle"]],
C:[["ความพยายามในการแย่งบอลในกรอบ","Box effort"],["สมาธิในการเป็นเป้าหมายแดนหน้า","Focus as focal point"],["ความดุดันในการปะทะ","Aggressive in box duels"],["การเพรสซิ่งไลน์แรกร่วมกับทีม","Coordinated front press"]]},
"U15-18":{M:[["ความไวระดับระเบิดพลังชิงจังหวะเสี้ยววินาทีในกรอบ","Box explosiveness"],["ความแข็งแกร่งพิงบังบอลปะทะเซนเตอร์แบ็กตัวใหญ่","Hold-up strength vs CBs"],["การสลัดหลุดตัวประกบในพื้นที่แคบด้วยการขยับหลอก","Separation capacity"],["จัดระเบียบร่างกายและลอยตัวค้างเพื่อโหม่งชิงจังหวะ","Aerial coordination & hang time"]],
A:[["จบสกอร์ด้วยจังหวะที่น้อยที่สุดและแม่นยำสูง","Minimal-touch finishing"],["เก็บบอลบนพื้นเชื่อมเกมและชิ่ง 1-2 ในพื้นที่สุดท้าย","Link-up under pressure"],["โหม่งกดลงพื้นหรือโหม่งเช็ดเปลี่ยนทางอย่างมีประสิทธิภาพ","Attacking heading execution"],["จับบอลแรกในกรอบที่ถูกรุมล้อมพร้อมง้างยิงทันที","Box receiving in tight spaces"]],
S:[["สัญชาตญาณอ่านบอลจังหวะสองและพื้นที่ว่างในกรอบ","Box anticipation"],["ขยับวิ่งทำลายโครงสร้างแนวรับให้เซนเตอร์สับสน","Disorganize defensive lines"],["วิ่งหลอกสร้างพื้นที่ว่างขนาดใหญ่ให้เพื่อนสอดขึ้นมา","Decoy advantages"],["ยืนรักษาตำแหน่งมุมอับ (Blind side) เตรียมรับบอลลึก","Threat continuity"]],
C:[["ความกระหายอย่างบ้าคลั่งในการทำประตูทุกวิถีทาง","Goal hunger"],["รับแรงกดดันเป็นความหวังจบสกอร์และศูนย์กลางทีม","Offensive reference focus"],["ความเด็ดขาดพุ่งเข้าหาบอลแม้ต้องปะทะรุนแรง","Ruthless box domination"],["เป็นผู้นำกำหนดจังหวะและทิศทางการเพรสซิ่งแดนบน","First-line pressing leadership"]]}
},
WG:{
"U6-8":{M:[["ความเร็วในการวิ่งสปรินต์","Sprinting speed"],["ความคล่องตัวพื้นฐาน","Basic agility"],["การหยุดกะทันหัน","Sudden stopping"],["การกระโดดพื้นฐาน","Basic jumping"]],
A:[["เลี้ยงบอลตรงไปข้างหน้า","Dribble straight forward"],["การหยุดบอล","Stopping the ball"],["การเขี่ยบอลเปลี่ยนทิศทาง","Nudge to change direction"],["การแตะบอลพาเข้าหาเป้าหมาย","Touch toward target"]],
S:[["รู้จักพื้นที่ด้านข้างสนาม","Knowing the wide areas"],["มองไปข้างหน้าขณะเลี้ยง","Look forward while dribbling"],["รู้ว่าจะไปทางไหน","Knowing where to go"],["รู้จักเส้นขอบสนาม","Knowing the touchline"]],
C:[["กล้าเลี้ยงบอลหลบคู่แข่ง","Brave to dribble past"],["ลุกขึ้นเมื่อโดนแย่ง","Get up after being beaten"],["อยากได้บอลเสมอ","Always wanting the ball"],["วิ่งขึ้นหน้าด้วยความมั่นใจ","Run forward with confidence"]]},
"U9-12":{M:[["การเปลี่ยนความเร็วช้า-เร็ว","Change of pace slow-fast"],["สมดุลในการเลี้ยงกินตัว","Balance dribbling past"],["การวิ่งซิกแซก","Zig-zag running"],["ความทนทานริมเส้น","Wide-area endurance"]],
A:[["การเลี้ยงดวล 1v1","1v1 dribbling"],["เตะบอลเข้ากลาง (Basic Cross)","Basic crossing"],["การเลี้ยงตัดเข้าใน","Cutting inside"],["จับบอลแรกขณะวิ่ง","First touch on the move"]],
S:[["ถ่างออกริมเส้นเพื่อรับบอล","Stay wide to receive"],["มองหาพื้นที่ว่างด้านหน้า","Look for space ahead"],["รู้จังหวะควรเลี้ยงหรือส่ง","Know when to dribble or pass"],["โผเข้าประตูเมื่อบอลอยู่อีกฝั่ง","Far-post run on switches"]],
C:[["มุ่งมั่นทวงบอลคืนจากตัวประกบ","Determined to win the ball back"],["กล้าดวล 1v1 ไม่กลัวเสีย","Brave in 1v1, fearless"],["ช่วยเพื่อนไล่กดดัน","Help teammates press"],["วิ่งสุดสปีดเสมอ","Always sprinting full speed"]]},
"U13-14":{M:[["สปีดต้นในการวิ่งริมเส้น","Flank acceleration"],["การรักษาสมดุลขณะเลี้ยงบอล","Dribbling balance"],["การเปลี่ยนความเร็วช้าไปเร็ว","Pace change (Basic)"],["จัดระเบียบร่างกายขณะวิ่งเร็ว","Coordination at speed"]],
A:[["การเลี้ยงบอลผ่านคู่แข่ง 1v1 เบื้องต้น","1v1 basic dribbling"],["การเปิดบอลจากริมเส้น","Basic crossing"],["การตัดเข้าในมาง้างยิงประตู","Diagonal finishing (Basic)"],["การรับบอลในมุมอับสายตากองหลัง","Blind-side receiving"]],
S:[["จับจังหวะวิ่งสอดหลังไลน์แนวรับ","Time runs behind"],["หาพื้นที่ดวล 1v1 ที่ได้เปรียบ","Find 1v1 zones"],["คุกคามเกมรุกอย่างต่อเนื่อง","Attacking presence"],["ขยับเข้ากรอบเมื่อบอลอยู่ฝั่งตรงข้าม","Basic box positioning"]],
C:[["ความมุ่งมั่นท้าดวลตัวประกบเสมอ","Offensive intent"],["ถอยช่วยแบ็กเล่นเกมรับ","Track back to help"],["สมาธิในการหาโอกาสจบสกอร์","Focus on finishing"],["การขยับกดดันแนวรับฝั่งตรงข้าม","Effort in pressing"]]},
"U15-18":{M:[["การระเบิดพลังทิ้งห่างตัวประกบในระยะ 5-10 เมตรแรก","Explosive acceleration 5-10m"],["สมดุลต้านทานการปะทะขณะเลี้ยงบอลความเร็วสูง","Contact resistance at speed"],["เบรกและกระชากเปลี่ยนจังหวะฉับพลันจนกองหลังเสียสมดุล","Unpredictable pace change"],["ความคล่องตัวพับข้อเท้าเปลี่ยนทิศทางขณะสปริ้นต์","High-speed agility"]],
A:[["ดวล 1v1 สร้างโอกาสทำประตูหรือเปิดบอลอย่างเด็ดขาด","1v1 execution for final action"],["เปิดบอลโด่ง พุ่งเสียบ หรือตบกลับหลังด้วยน้ำหนักแม่นยำ","Dynamic crossing & cut-backs"],["วิ่งตัดเข้าในและจบสกอร์ด้วยความเฉียบขาด","Clinical diagonal finishing"],["รับบอลแรกพร้อมพลิกเข้าทำทันทีในพื้นที่จำกัด","Half-turn receiving out wide"]],
S:[["วิ่งสอดทะลุช่องทำลายโครงสร้างแนวรับอย่างสมบูรณ์","Exploiting defensive unbalance"],["อ่านพื้นที่เพื่อดึงตัวเองไปดวล 1v1 เชิงเดี่ยว (Isolation)","Identify isolated 1v1s"],["ตัดสินใจเฉียบขาดในพื้นที่สุดท้าย (ยิง จ่าย หรือเลี้ยง)","Final-third decision making"],["อ่านจุดตกและสอดเข้าเสาสองเพื่อแท็บอิน","Far-post anticipation"]],
C:[["ความดุดันและมั่นใจเอาชนะตัวประกบเพื่อทำลายแนวรับ","Offensive duel domination"],["สปิริตลงช่วยแบ็กซ้อนแบบ 2v1 หรือปิดพื้นที่ริมเส้น","Tracking back solidarity"],["สมาธิและความกระหายในการไปอยู่จุดจบสกอร์ในกรอบ","Box positioning focus"],["ใช้ความเร็วบีบกดดันแนวรับคู่แข่งอย่างดุดัน","High-press intensity"]]}
},
CM:{
"U6-8":{M:[["การเบรกและออกตัว","Braking and accelerating"],["ความคล่องตัวทั่วไป","General agility"],["การหมุนตัว","Turning"],["การวิ่งสลับทิศทาง","Running, changing direction"]],
A:[["เลี้ยงบอลหลบคู่แข่ง","Dribble past opponents"],["การจับบอล","Controlling the ball"],["การเตะบอลส่งให้เพื่อน","Passing to a teammate"],["การใช้เท้าทั้งสองข้าง","Using both feet"]],
S:[["มองหาลูกบอลเสมอ","Always watching the ball"],["รู้ตัวเองอยู่ตรงกลาง","Knowing you're central"],["รู้จักแดนตัวเองและแดนคู่แข่ง","Knowing own & opponent halves"],["มองหาพื้นที่ที่ไม่มีคน","Looking for empty space"]],
C:[["กระตือรือร้นไล่บอล","Eager to chase the ball"],["สนุกกับการมีบอล","Enjoy having the ball"],["ลุกขึ้นสู้เมื่อโดนเบียด","Stand up when bumped"],["ฟังเสียงเพื่อน","Listen to teammates"]]},
"U9-12":{M:[["ความคล่องตัวในการหมุนตัว","Agility in turning"],["การพิงบังบอลเบื้องต้น","Basic shielding"],["ความฟิตในการวิ่งทั่วสนาม","Fitness to cover the pitch"],["การวิ่งเพื่อหนีตัวประกบ","Running to escape the marker"]],
A:[["การจ่ายบอลสั้นแม่นยำ","Accurate short passing"],["รับบอลจังหวะแรก","First-touch receiving"],["เลี้ยงบอลหาพื้นที่","Dribble to find space"],["การเตะบอลสาดยาว","Long diagonal pass"]],
S:[["มองรอบตัวก่อนรับบอล (Basic Scan)","Scan before receiving"],["หาพื้นที่ว่างตรงกลาง","Find central space"],["รู้ว่าควรเร่งหรือเลี้ยง","Know when to speed up"],["ยืนเชื่อมระหว่างหลังกับหน้า","Link defense and attack"]],
C:[["ช่วยทั้งรุกและรับ","Help in attack and defense"],["อยากได้บอลมาปั่นเกม","Want the ball to drive play"],["ช่วยเพื่อนแย่งบอล","Help win the ball"],["สื่อสารกับเพื่อนร่วมทีม","Communicate with teammates"]]},
"U13-14":{M:[["ความคล่องตัวในการพลิกตัวพื้นที่แคบ","Agility in tight spaces"],["การเอาตัวบังบอลเมื่อมีคู่แข่งเข้ามาใกล้","Basic shielding"],["ความฟิตครอบคลุมพื้นที่แดนกลาง","Midfield endurance"],["การขยับซ้าย-ขวาเพื่อหาช่องรับบอล","Pivot movement"]],
A:[["การจับบอลแรกด้วยท่าฮาล์ฟเทิร์น","Half-turn receiving"],["การครองบอลไม่ให้เสียในพื้นที่แคบ","Basic retention"],["การพยายามจ่ายบอลไปข้างหน้า","Forward passing"],["การวางบอลเปลี่ยนฝั่งเมื่อมีพื้นที่","Switching play (Basic)"]],
S:[["การหันมองรอบตัวก่อนรับบอล","Basic scanning"],["การหาพื้นที่ว่างเพื่อรับบอล","Finding space"],["การรู้ว่าตอนไหนควรเลี้ยงหรือจ่าย","Tempo control (Basic)"],["การเลือกจ่ายบอลขึ้นหน้า","Basic progressive decision"]],
C:[["ความมุ่งมั่นในการเสนอตัวขอบอลเสมอ","Always offer for the ball"],["การวิ่งกดดันคู่แข่งในแดนกลาง","Basic pressing"],["การขยับไปเก็บตกบอลจังหวะสอง","Second ball effort"],["การวิ่งไล่บอลเมื่อเสียการครอบครอง","Defensive transition"]]},
"U15-18":{M:[["เบรกและออกตัวเร็วฉีกหนีตัวเพรสซิ่งในแดนกลาง","Stop / start capacity"],["ความแข็งแกร่งพิงบังบอลเมื่อถูกกระแทกรุนแรง","Shielding strength under contact"],["ความสามารถทำงานหนักทั้งรุกและรับในระดับสูง","High-intensity central stamina"],["หมุนพลิกตัว 180 องศาด้วยความรวดเร็วและสมดุล","Explosive pivoting"]],
A:[["จับบอลแรกพลิกเอาชนะตัวประกบและพาบอลขึ้นหน้าทันที","Progressive first touch"],["เล่นบอล 1-2 จังหวะแก้เพรสซิ่งในพื้นที่ถูกบีบอัดสูง","Tight-area execution"],["จ่ายบอลน้ำหนักพอดีทะลุไลน์แนวรับหรือแดนกลางคู่แข่ง","Line-breaking passing"],["วางบอลยาวแม่นยำโจมตีพื้นที่อ่อนแอของคู่แข่งทันที","Switching point of attack"]],
S:[["กวาดสายตาอัปเดตข้อมูลต่อเนื่องและเป็นธรรมชาติ","360° scanning continuity"],["หาช่องโหว่ระหว่างไลน์ (Pocket of space) เพื่อทำลายโครงสร้าง","Space unbalance identification"],["คุมจังหวะช้า-เร็วของเกม รักษาสมดุลตามสถานการณ์","Tempo dictation"],["เลือกทางเลือกที่สร้างความได้เปรียบสูงสุดในเสี้ยววินาที","Progressive advantages"]],
C:[["สมาธิและความกล้าเป็นศูนย์กลางคุมจังหวะเกมตลอดเวลา","Dictation focus"],["เพรสซิ่งอย่างพร้อมเพรียงและเป็นระบบร่วมกับทีม","Pressing solidarity"],["ความดุดันและอ่านขาดเข้าถึงบอลจังหวะสองเป็นคนแรก","Aggressive second-ball duels"],["ไหวพริบชะลอเกมสวนกลับ (ตัดฟาวล์แทคติกเมื่อจำเป็น)","Tactical foul & transition delay"]]}
},
"FB/WB":{
"U6-8":{M:[["การวิ่งทางตรงริมเส้น","Straight running on the flank"],["การวิ่งไม่ให้ล้ม","Running without falling"],["การกระโดด","Jumping"],["การทรงตัวเมื่อเตะ","Balance when kicking"]],
A:[["เตะบอลไปข้างหน้าตามริมเส้น","Kick forward along the line"],["การหยุดบอลไม่ให้ออก","Keeping the ball in"],["ทุ่มบอล","Throw-in"],["การเลี้ยงบอลตรงๆ","Dribble straight"]],
S:[["รู้จักแนวเขตริมเส้น (ไม่เข้ากลาง)","Knowing the wide zone"],["รู้ว่าฝั่งตัวเองอยู่ไหน","Knowing your side"],["มองหาลูกบอล","Watching the ball"],["รู้จักเส้นขอบสนาม","Knowing the touchline"]],
C:[["ขยันวิ่งขึ้น-ลง","Work-rate up and down"],["กล้าเตะบอลทิ้ง","Brave to clear"],["อยากมีส่วนร่วม","Wanting to be involved"],["วิ่งตามคู่แข่ง","Tracking opponents"]]},
"U9-12":{M:[["ความทนทานวิ่งขึ้นลงซ้ำๆ","Repeated up-down running"],["ความเร็วริมเส้น","Speed on the flank"],["การทรงตัวเปลี่ยนทิศ","Balance changing direction"],["การออกตัวเร็ว","Quick acceleration"]],
A:[["เตะบอลเข้ากลาง (Basic Cross)","Basic crossing"],["การตัดบอล","Interception"],["จ่ายบอลสั้นให้ปีก","Short pass to the winger"],["จับบอลให้อยู่","Controlling the ball"]],
S:[["เติมเกมรุกเมื่อเพื่อนมีบอล","Overlap when teammate has ball"],["ถอยรับเมื่อเสียบอล","Drop back when ball is lost"],["ยืนประกบปีกคู่แข่ง","Mark the opposing winger"],["มองหาเพื่อนก่อนส่ง","Scan before passing"]],
C:[["รับผิดชอบแนวเมื่อเสียบอล","Responsible defending"],["ไม่ยอมให้ใครผ่านง่ายๆ","Don't let anyone pass easily"],["ช่วยเพื่อนรุมแย่งบอล","Help win the ball"],["วิ่งสุดแรงเสมอ","Always run hard"]]},
"U13-14":{M:[["ความอดทนในการวิ่งขึ้น-ลงริมเส้น","High-intensity stamina"],["ความเร็วในการวิ่งเติมเกมริมเส้น","Flank speed 15-30m"],["การจัดระเบียบร่างกายในการสไลด์รับด้านข้าง","Lateral coordination"],["การรักษาสมดุลขณะวิ่งพาบอล","Balance when running"]],
A:[["การเปิดบอลจากด้านข้างเข้าพื้นที่อันตราย","Basic crossing"],["การจับบอลแรกเมื่อมีพื้นที่ว่างด้านข้าง","Receiving in space"],["การต่อบอล 1-2 สั้นๆ โครงสร้างริมเส้น","Wide combination play"],["การแหย่เท้าสกัดหรือตัดบอลด้านข้าง","Basic interception"]],
S:[["การกะจังหวะวิ่งสอดเติมเกมด้านนอก","Overlap timing"],["การรู้ตำแหน่งที่ต้องวิ่งกลับมาตั้งรับ","Basic recovery position"],["การขยับไปรับบอลเพื่อสร้างทางเลือกให้เพื่อน","Wide support"],["การมองหาเป้าหมายก่อนเปิดบอล","Scanning before crossing"]],
C:[["ความพยายามในการเล่นเกมรับ 1v1","1v1 defensive effort"],["ความมุ่งมั่นในการสปริ้นต์ลงมารับ","Tracking back"],["สมาธิในการคุมพื้นที่ริมเส้นไม่ให้หลุด","Wide security focus"],["การเสนอตัวช่วยเกมรุก","Attacking support"]]},
"U15-18":{M:[["ความสามารถทำความเร็วสูงสุดซ้ำๆ ตลอดเกม","Repeated sprint ability (RSA)"],["สปีดต้นระเบิดพลังฉีกหนีตัวประกบด้านข้าง","Explosive overlapping"],["ความคล่องตัวถอย/สไลด์ข้างรับมือปีกความเร็วสูง","High-speed lateral defense"],["สมดุลควบคุมลูกครอสขณะวิ่งความเร็วสูงสุด","Crossing balance at top speed"]],
A:[["ครอสโด่ง พุ่ง หรือตบกลับ (Cut-back) ได้แม่นยำตามสถานการณ์","Crossing variety & execution"],["จับบอลแรกอย่างเนียนตาขณะวิ่งสอดทะลุช่อง","Receiving on the run"],["มีส่วนร่วมการทำชิ่ง 3 คนเพื่อหลุดเพรสซิ่งริมเส้น","Third-man runs"],["ตัดบอลและเปลี่ยนเป็นเกมรุก (Transition) ได้ทันที","Interception under pressure"]],
S:[["อ่านเกมเลือกว่าจะสอดด้านนอกหรือตัดเข้าด้านใน","Overlap / underlap decision"],["ประเมินความเสี่ยงยืนตำแหน่งรองรับเผื่อโดนสวนกลับ","Rest defense priority"],["หาพื้นที่ดวล 1v1 เชิงโครงสร้างหรือสร้าง Overload ริมเส้น","Generate wide advantages"],["อ่านช่องว่างในกรอบเขตโทษเพื่อเลือกประเภทการครอส","Final-third awareness"]],
C:[["ความดุดันและเอาชนะการดวล 1v1 ไม่ให้ปีกผ่านไปได้","1v1 wide duel domination"],["สปริ้นต์ลงรับสุดชีวิตพร้อมจัดระเบียบเข้าโซนป้องกันทันที","Defensive recovery focus"],["ความเชื่อมโยงและการซ้อนเพื่อน (เซนเตอร์/ปีก) ตลอดเวลา","Solidarity with CB / WG"],["ความทุ่มเทเป็นตัวขับเคลื่อนเกมริมเส้นตลอด 90 นาที","Continuous flank engine"]]}
},
CB:{
"U6-8":{M:[["การวิ่งถอยหลังเบื้องต้น","Basic backward running"],["การวิ่งสปรินต์","Sprinting"],["การกระโดด","Jumping"],["การทรงตัวเมื่อเตะ","Balance when kicking"]],
A:[["เตะบอลทิ้งไกลจากหน้าประตู","Clear far from goal"],["การหยุดบอล","Stopping the ball"],["เตะบอลออกข้าง","Clear to the side"],["แย่งบอลจากหน้าคู่แข่ง","Win the ball from opponent"]],
S:[["ยืนระหว่างหน้าลูกบอลกับประตู","Stay between ball and goal"],["รู้ฝั่งตัวเองอยู่ไหน","Knowing your side"],["มองดูลูกบอลตลอด","Always watching the ball"],["ไม่ยืนทับแนวเพื่อน","Don't overlap teammates"]],
C:[["ไม่กลัวลูกปะทะ","Not afraid of contact"],["วิ่งเข้าไปสกัด","Run in to tackle"],["ดึงตัวเองกลับให้ไว","Recover position quickly"],["ช่วยเพื่อนแย่งบอล","Help win the ball"]]},
"U9-12":{M:[["จัดระเบียบร่างกายตอน 1v1","Body shape in 1v1"],["ความเร็วระยะสั้น","Short speed"],["การกระโดดโหม่งเบื้องต้น","Basic jump heading"],["การเบรกหยุดวิ่ง","Braking to stop"]],
A:[["จ่ายบอลสั้นขึ้นหน้า","Short forward pass"],["จับบอลแรกให้อยู่","First-touch control"],["เตะสกัดเมื่ออันตราย","Clear when in danger"],["เตะทิ้งให้ไกล","Clear far"]],
S:[["ประกบตัวที่อยู่ใกล้ที่สุด","Mark the nearest man"],["รักษาระยะห่างกับเพื่อน","Keep spacing with partner"],["ยืนซ้อนเพื่อนเมื่อเพื่อนถูกผ่าน","Cover when partner is beaten"],["มองหาเพื่อนก่อนเคลียร์บอล","Scan before clearing"]],
C:[["ดุดันในการสกัดบอล","Aggressive tackling"],["กล้าโหม่งบอล","Brave to head"],["ตะโกนบอกเพื่อน","Communicate with teammates"],["สมาธิจดจ่อกับบอล","Concentration on the ball"]]},
"U13-14":{M:[["การจัดระเบียบร่างกายเข้าหาทิศทางบอล","Coordination toward the ball"],["สมดุลร่างกายในการเบียดแย่งบอล","Basic duel strength"],["สปีดการวิ่งกลับตำแหน่ง 15-20 เมตร","Recovery run speed"],["การยืนย่อตัวเตรียมพร้อมรับมือตัวรุก","Body shape in defending"]],
A:[["การเตะสกัดทิ้งโดยไม่เสียสมดุล","Safe clearance"],["การจับบอลแรกเพื่อหนีตัวเพรสซิ่งเบื้องต้น","First touch to protect"],["การโหม่งสกัดบอลโด่งเบื้องต้น","Defensive heading"],["การต่อบอลสั้นกับเพื่อนร่วมทีมแดนหลัง","Short ground passing"]],
S:[["การจับตาดูคู่แข่งที่อยู่ในพื้นที่รับผิดชอบ","Basic marking"],["การรักษาไลน์และระยะห่างร่วมกับคู่เซนเตอร์","Defensive line sync"],["การรู้ว่าเพื่อนอยู่ตำแหน่งไหน","Basic spatial awareness"],["การตอบสนองเมื่อทีมเสียบอล","Reaction to ball loss"]],
C:[["สมาธิและการไม่หลุดจากตำแหน่งรับผิดชอบ","Task focus"],["ความพยายามในการเบียดแย่งบอล 50/50","Effort in duels"],["การวิ่งประคองเพื่อนในแนวรับ","Team support"],["การวิ่งไล่ตามคู่แข่งจนสุดจังหวะ","Never giving up"]]},
"U15-18":{M:[["พลังในการเทกตัวและการปะทะอย่างรุนแรง","Aerial & ground power"],["ความสามารถเอาชนะการปะทะจากกองหน้าตัวใหญ่","Advanced contact strength"],["สปีดต้นเปลี่ยนจากรุกเป็นรับอย่างฉับพลัน","Transition explosiveness"],["ความสามารถในการเบรกและเปลี่ยนทิศทางกะทันหัน","Capacity to stop / change direction"]],
A:[["สกัดบอลได้อย่างเด็ดขาดและบอลไปตกในพื้นที่เป้าหมาย","Clearance without ball inertia"],["จับบอลแรกเพื่อพร้อมเซ็ตเกมรุกต่อทันที","First touch for advantage"],["โหม่งสกัดในระดับความสูงที่ต่างกันและบังคับทิศทางได้","Directional heading"],["จ่ายบอลแนวลึกทะลุไลน์เพรสซิ่งแรกของคู่แข่ง","Line-breaking passing"]],
S:[["จัดลำดับความสำคัญรับมือคู่แข่งที่อันตรายที่สุดในกรอบ","Prioritize dangerous man"],["อ่านจังหวะซ้อนเพื่อนและระบุพื้นที่เสียสมดุลล่วงหน้า","Cover & balance"],["ดึงจังหวะหรือจ่ายบอลสร้างความได้เปรียบให้แดนกลาง","Generate advantage via passing"],["ความต่อเนื่องในการอ่านเกมแม้บอลหลุดจากโซนตัวเอง","Continuity in competition"]],
C:[["การแสดงความเป็นผู้นำและการสั่งการแผงแนวรับ","Defensive leadership"],["ความดุดันและความเด็ดขาดในการเข้าปะทะขั้นเด็ดขาด","Aggression in duels"],["ความเป็นน้ำหนึ่งใจเดียวกัน ยอมเจ็บตัวเพื่อบล็อกลูกยิง","Solidarity"],["ความกระหายเอาชนะการดวลทุกจังหวะและไม่ยอมแพ้","Winning mentality"]]}
},
GK:{
"U6-8":{M:[["กระโดดและล้มตัวพื้นฐาน","Basic diving & falling"],["การวิ่งระยะสั้น","Short-distance running"],["ปฏิกิริยาตอบสนอง","Reaction response"],["การทรงตัว","Balance"]],
A:[["ใช้มือรับหรือหยุดบอล","Use hands to catch / stop"],["เตะบอลจากมือ","Kicking from hands"],["โยนบอลให้เพื่อน","Throwing to a teammate"],["ใช้เท้าเตะบอล","Kicking with the feet"]],
S:[["รู้ว่าต้องยืนเฝ้าหน้าประตู","Knowing to guard the goal"],["มองดูลูกบอลเสมอ","Always watching the ball"],["รู้ว่ากรอบเขตโทษอยู่ไหน","Knowing where the box is"],["รู้ทิศทางคู่แข่ง","Sensing opponent direction"]],
C:[["กล้าเอาตัวขวางบอล","Brave to block the ball"],["ไม่กลัวลูกยิง","Not afraid of shots"],["ลุกขึ้นไว","Quick to get up"],["สนุกกับการเซฟ","Enjoy making saves"]]},
"U9-12":{M:[["ท่าทางพุ่งเซฟ (Diving)","Diving technique"],["การเซ็ตท่าเตรียมรับมือ","Setting the ready stance"],["ความเร็วออกไปตัดบอล","Speed to come out & intercept"],["การกระโดดขึ้นสูง","Jumping high"]],
A:[["รับบอลเข้าอก (Handling)","Handling to the chest"],["เตะเปิดเกมจากพื้น","Playing out from the back"],["ขว้างบอลสวนกลับ","Throwing for the counter"],["ปัดบอลข้ามคาน","Tipping over the bar"]],
S:[["ขยับตามทิศทางลูกบอล (Angle)","Adjusting to the ball angle"],["อ่านบอลโยนยาว","Reading long balls"],["ออกมาตัดบอล","Coming out to intercept"],["เลือกจ่ายเพื่อนที่ปลอดภัย","Choose the safe option"]],
C:[["กล้าตะโกนสื่อสารกับกองหลัง","Brave to command defenders"],["สมาธิเวลาบอลอยู่ไกล","Focus when the ball is far"],["กล้าพุ่ง 1v1","Brave in 1v1"],["เป็นผู้นำแดนหลัง","Leader of the back line"]]},
"U13-14":{M:[["ความเร็วและสมดุลในการเซ็ตตำแหน่งขั้นต้น","Set position speed"],["การกะจังหวะเทกตัวรับบอลกลางอากาศ","Aerial coordination"],["ความคล่องตัวในการเคลื่อนที่ข้ามฝั่งในกรอบ","Mobility in the box"],["การรักษาสมดุลเมื่อมีการปะทะเบาบาง","Basic contact balance"]],
A:[["ความแน่นอนในการรับหรือปัดบอลพื้นฐาน","Handling consistency"],["การจับและจ่ายบอลสั้นบนพื้นได้อย่างปลอดภัย","Basic ground build-up"],["การเตะสกัดทิ้งเพื่อความปลอดภัยโดยไม่เตะวืด","Safe clearance"],["การออกบอลระยะกลางให้เพื่อนที่ว่าง","Medium distribution"]],
S:[["การยืนตำแหน่งปิดมุมยิงเบื้องต้น","Angle positioning"],["การจับตาดูทิศทางบอลที่เจาะหลังแนวรับ","Tracking the ball"],["การเลือกเป้าหมายจ่ายบอลที่ใกล้และปลอดภัย","Safe passing choices"],["การตื่นตัวเมื่อบอลอยู่ในแดนตัวเอง","Basic awareness"]],
C:[["สมาธิในการปกป้องประตูพื้นฐาน","Task focus"],["การส่งเสียงเรียกเพื่อนหรือขอบอล","Basic communication"],["ความกล้าในการเข้าหาบอลจังหวะ 1v1","Brave approach"],["ความพยายามในการป้องกันพื้นที่กรอบ 6 หลา","Protecting the zone"]]},
"U15-18":{M:[["ปฏิกิริยาตอบสนองและการพุ่งเซฟแบบระเบิดพลัง","Explosive reactions"],["ความแข็งแกร่งในการปะทะกลางอากาศ","Aerial power"],["สปีดต้นพุ่งออกมาตัดบอลนอกกรอบ 15-20 ม.","Sweeping acceleration"],["ความดุดันและแข็งแกร่งเมื่อถูกปะทะในกรอบ 6 หลา","Box contact strength"]],
A:[["จัดการลูกยิงที่ซับซ้อน/เปลี่ยนทางด้วยความแม่นยำ","Execution under pressure"],["แกะเพรสซิ่งและเซ็ตเกมด้วยเท้าเมื่อโดนบีบเร็ว","Build-up under high press"],["เตะสกัดทิ้งไปยังพื้นที่ปลอดภัยหรือเป้าหมายที่ได้เปรียบ","Targeted clearance"],["การออกบอลข้ามไลน์เพรสซิ่งด้วยความแม่นยำ","Line-breaking distribution"]],
S:[["อ่านใจคนยิงและบีบมุมให้คู่แข่งยิงยากที่สุด","Anticipation & angle manipulation"],["อ่านจังหวะล่วงหน้าเพื่อออกมาตัดบอลทะลุช่อง","Reading through-balls"],["เลือกเป้าหมายเซ็ตเกมเพื่อสร้างความได้เปรียบเชิงโครงสร้าง","Build-up orchestration"],["ตื่นตัวและขยับตำแหน่งต่อเนื่องแม้บอลอยู่ไกลตัว","Out-of-possession continuity"]],
C:[["ความนิ่งและสมาธิระดับสูง ไม่หลุดหลังเสียประตู","Mental resilience"],["สื่อสารสั่งการและจัดระเบียบแผงแบ็กโฟร์แบบเด็ดขาด","Defensive commanding"],["ความดุดันและปิดโอกาสในจังหวะดวล 1v1 เดี่ยวๆ","Aggressive 1v1 domination"],["การยึดครองพื้นที่กรอบเขตโทษอย่างเบ็ดเสร็จ","Box ownership"]]}
}
};

// ---------- คำนวณคะแนน/เกรด ----------
export const SCORE_VALUES = [1, 3, 7, 9];

// คะแนนถ่วงน้ำหนักของหมวดหนึ่ง (0.4 * CORE + 0.2 * (SUP1+SUP2+SUP3)) คืนค่า null ถ้ายังให้คะแนนไม่ครบ 4 ข้อ
export function categoryRawScore(values) {
  if (!values || values.some((v) => v == null)) return null;
  return 0.4 * values[0] + 0.2 * (values[1] + values[2] + values[3]);
}

// แปลงคะแนนถ่วงน้ำหนัก (1-9) เป็นเกรด 1/3/7/9: ≤2.00→1 · ≤5.00→3 · ≤8.00→7 · มากกว่านั้น→9
export function scoreToGrade(rawScore) {
  if (rawScore == null) return null;
  if (rawScore <= 2.0) return 1;
  if (rawScore <= 5.0) return 3;
  if (rawScore <= 8.0) return 7;
  return 9;
}
