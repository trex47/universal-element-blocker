# Universal Element Blocker

Chrome Extension (Manifest V3) สำหรับซ่อนหรือลบ element บนเว็บไซต์ทั่วไปด้วยกฎแบบข้อความ URL/attribute หรือ CSS selector

## ติดตั้ง

1. เปิด `chrome://extensions/`
2. เปิด **Developer mode**
3. กด **Load unpacked**
4. เลือกโฟลเดอร์นี้

## ใช้งาน

### คลิกขวา (วิธีที่เร็วที่สุด)

1. คลิกขวาที่ element บนหน้าเว็บ
2. เปิดเมนู **Universal Element Blocker**
3. เลือก **ซ่อน element นี้ทุกครั้ง** หรือ **ลบ element นี้ทุกครั้ง**

Extension จะสร้าง CSS selector และบันทึกกฎให้อัตโนมัติ กฎสามารถลบภายหลังได้จาก popup

### เพิ่มกฎเอง

1. เปิดเว็บไซต์ที่ต้องการ
2. กดไอคอน Extension
3. เพิ่มกฎ:
   - **ข้อความใน URL/attribute** เช่น `ibit.ly` เพื่อตรวจ `href`, `src`, `onclick` และ attribute ที่ใช้กับ URL อื่น ๆ
   - **CSS selector** เช่น `.popup-ad`, `#banner` หรือ `iframe[src*="example.com"]`
4. เลือก **ลบ element** หรือ **ซ่อน element**
5. ใช้สวิตช์ด้านบนเพื่อปิดการทำงานเฉพาะเว็บไซต์ปัจจุบัน

กฎมีผลกับทุกเว็บไซต์และทุก frame ที่ Chrome อนุญาต กฎเริ่มต้นยังคงลบ element ที่มี `ibit.ly/ufabomb`

## ข้อจำกัด

- Chrome ไม่อนุญาตให้ content script ทำงานบนหน้าภายใน เช่น `chrome://`, Chrome Web Store และหน้าบางประเภทของเบราว์เซอร์
- สำหรับ `file://` ต้องเปิด **Allow access to file URLs** ในหน้ารายละเอียดของ Extension ก่อน
- การลบ element ย้อนกลับไม่ได้จนกว่าจะโหลดหน้าใหม่ ส่วนการซ่อนจะคืนค่าได้ทันทีเมื่อปิด Extension สำหรับเว็บไซต์นั้น
- Extension นี้จัดการ DOM เท่านั้น ยังไม่ได้บล็อก network request ก่อนดาวน์โหลด
