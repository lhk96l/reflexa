# تجهيز دومين إيميل احترافي لـ REFLEXA

الوضع الحالي: الإيميلات تُرسل من `onboarding@resend.dev` (دومين تجريبي).
المشكلة: يصل غالباً في Spam ويبدو غير موثوق.

## الحل — 3 خطوات

### 1. احصل على دومين
أرخص الخيارات (سنوياً):
- `reflexa.app` أو `getreflexa.com` أو `reflexa.io`
- مصادر: Namecheap, Cloudflare Registrar, Porkbun (~$10/سنة)

### 2. وثّق الدومين في Resend
1. resend.com → **Domains → Add Domain**
2. أدخل دومينك (مثلاً `reflexa.app`)
3. Resend يعطيك سجلات DNS (SPF + DKIM + DMARC)
4. أضف هذه السجلات في إعدادات DNS لدومينك
5. انتظر التحقق (دقائق إلى ساعة)

### 3. اضبط FROM_EMAIL في Cloudflare Worker
**Workers → reflexa-license → Settings → Environment Variables → Add**

| Variable | Value |
|---|---|
| `FROM_EMAIL` | `REFLEXA <noreply@reflexa.app>` |

(استبدل reflexa.app بدومينك الموثّق)

اضغط Save and Deploy.

## النتيجة
- الإيميلات تصل Inbox مباشرة (ليس Spam)
- تظهر من دومينك الرسمي (احترافية)
- لا حاجة لتعديل أي كود — الـ Worker يقرأ FROM_EMAIL تلقائياً
- إذا لم تضبط FROM_EMAIL، يعود تلقائياً لـ onboarding@resend.dev

## ملاحظة
بدون دومين موثّق، Resend يسمح فقط بـ onboarding@resend.dev
ولا يمكن الإرسال لإيميلات غير إيميلك المسجّل في وضع التجربة.
لإرسال لأي عميل، توثيق الدومين **إلزامي**.
