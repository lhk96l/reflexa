# REFLEXA Worker — دليل الإعداد الكامل

## المتطلبات
- حساب Cloudflare (مجاني)
- حساب LemonSqueezy (لاستقبال المدفوعات)
- حساب Resend (mails) — مجاني حتى 3,000 إيميل/شهر

---

## الخطوة 1: إنشاء KV Namespace

```bash
cd worker
npx wrangler login
npx wrangler kv:namespace create LICENSES
# سيظهر ID — انسخه
npx wrangler kv:namespace create LICENSES --preview
# سيظهر preview ID — انسخه
```

افتح `wrangler.toml` وضع الـ IDs في أماكنها.

---

## الخطوة 2: إعداد الأسرار (Secrets)

```bash
# السر الرئيسي — اصنع نصاً عشوائياً طوله 48 حرف على الأقل
npx wrangler secret put RXFLX_SECRET
# مثال: Rfx3_K9p#mZw!vQ@2025_LicenseSecretKey_NEVER_SHARE_48chars

# سر LemonSqueezy Webhook
npx wrangler secret put LS_SIGNING_SECRET
# تجده في: LemonSqueezy → Settings → Webhooks → Signing Secret

# مفتاح Resend API
npx wrangler secret put RESEND_API_KEY
# تجده في: resend.com → API Keys → Create API Key
```

⚠️ **مهم جداً:** نفس قيمة `RXFLX_SECRET` يجب أن تُطبّق في `src/license.js`
   (في الدالة `_S()`) قبل البناء. هذا هو الشيء الوحيد الذي يجمع بين الـ Worker والـ Client.

---

## الخطوة 3: إعداد LemonSqueezy

1. سجّل في [lemonsqueezy.com](https://lemonsqueezy.com)
2. أنشئ Store باسم REFLEXA
3. أنشئ منتجين:
   - **REFLEXA Pro Monthly** — $4.99/شهر
   - **REFLEXA Pro Annual**  — $39.99/سنة
4. اذهب إلى **Settings → Webhooks → Add Webhook**:
   - URL: `https://reflexa-license.YOUR-SUBDOMAIN.workers.dev/webhook/lemonsqueezy`
   - Events: `order_created`, `subscription_created`, `subscription_payment_success`
   - انسخ Signing Secret → ضعه في `LS_SIGNING_SECRET`

---

## الخطوة 4: إعداد Resend

1. سجّل في [resend.com](https://resend.com)
2. أنشئ API Key
3. أضف دومين (أو استخدم `onboarding@resend.dev` للتجربة)
4. في `worker/src/email.js` عدّل:
   ```javascript
   from: 'REFLEXA <noreply@YOUR_DOMAIN.com>',
   ```

---

## الخطوة 5: نشر الـ Worker

```bash
cd worker
npx wrangler deploy
```

ستحصل على URL مثل:
`https://reflexa-license.YOUR_SUBDOMAIN.workers.dev`

---

## الخطوة 6: اختبار دورة كاملة

```bash
# اختبار health endpoint
curl https://reflexa-license.YOUR_SUBDOMAIN.workers.dev/api/health

# اختبار webhook محلياً
npx wrangler dev
# ثم في terminal آخر:
curl -X POST http://localhost:8787/webhook/lemonsqueezy \
  -H "Content-Type: application/json" \
  -H "X-Event-Name: order_created" \
  -d '{"data":{"id":"test-123","attributes":{"user_email":"test@example.com","product_name":"REFLEXA Pro Monthly"}}}'
```

---

## البنية المعمارية

```
المستخدم يشتري على LemonSqueezy
          ↓
LemonSqueezy يُرسل Webhook POST (موقّع بـ HMAC)
          ↓
Cloudflare Worker يتحقق من التوقيع
          ↓
Worker يولّد مفتاح RXFLX-XXXXXX-XXXXXX-XX-XXXXXXXX
          ↓
Worker يحفظ في KV: key:→ metadata, order:→ key, email:→ key
          ↓
Resend يرسل إيميل جميل بالمفتاح
          ↓
المستخدم يُدخل المفتاح في REFLEXA
          ↓
REFLEXA يتحقق بـ HMAC-SHA256 محلياً (بدون سيرفر)
          ✅ Pro مفعّل
```

---

## أمان المفاتيح

| الميزة | التفاصيل |
|---|---|
| الخوارزمية | HMAC-SHA256 |
| التحقق | محلي (client) + سيرفر (Worker) |
| ربط البريد | كل مفتاح مرتبط بـ SHA-256 أول 6 chars من الإيميل |
| مقاومة المشاركة | إذا استخدم شخصان نفس المفتاح، يُكشف عبر KV |
| الانتهاء | مضمّن في المفتاح نفسه (base-36 timestamp) |
| الإلغاء | عبر `LICENSES.put('key:XXXX', {..., active: false})` |
