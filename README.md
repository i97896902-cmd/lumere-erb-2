# Luméré — نظام إدارة الشركة
تطبيق React/Vite عربي RTL لإدارة العملاء والمشاريع والمهام والمعدات، مع Firebase Authentication وFirestore وPWA.

## التشغيل المحلي
المتطلبات: Node.js 20+ وnpm.

```powershell
npm install
npm run dev
```

لإنشاء نسخة الإنتاج والتحقق من TypeScript:

```powershell
npm run lint
npm run build
npm run preview
```

## إعداد Firebase وVercel
يمكن استخدام `firebase-applet-config.json` الافتراضي للتشغيل المحلي، أو تعريف متغيرات Vercel التالية:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (اختياري)
- `VITE_FIRESTORE_DATABASE_ID`

إعدادات Firebase Web ليست أسرار خادم، لكن يجب تقييد API key من Google Cloud حسب HTTP referrers. لا تضع مفاتيح خادم أو service-account داخل المستودع أو متغيرات `VITE_*`.

## النشر على Vercel
- اربط مستودع GitHub.
- Framework: `Vite`.
- Build command: `npm run build`.
- Output directory: `dist`.
- أضف متغيرات Firebase السابقة إلى Production وPreview عند الحاجة.
- `vercel.json` يجهز fallback للـSPA حتى تعمل المسارات المباشرة بدون 404.
- Vercel يوفر HTTPS تلقائيًا، وهو شرط لتثبيت PWA خارج localhost.

## إعداد Google Login
من Firebase Console أضف نطاق Vercel الفعلي إلى `Authentication → Settings → Authorized domains`، وفعّل Google Provider، ثم انشر `firestore.rules`.

## PWA
التطبيق يحتوي على manifest وService Worker وأيقونات 192 و512 وfavicon وApple Touch Icon، مع `display: standalone` وRTL والعربية. Install Prompt يظهر فقط عندما يدعم المتصفح التثبيت، ويختفي في وضع standalone. ظهور prompt يخضع لشروط المتصفح مثل HTTPS وmanifest صالح وService Worker.
"# lumere-erb-2" 
