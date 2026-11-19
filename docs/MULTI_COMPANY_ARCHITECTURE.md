# Lumere Group — Multi-Company Enterprise ERP Architecture & Operations Runbook

## 1. الهيكل المؤسسي للشركات (Corporate Hierarchy)

يعمل النظام على مشروع Firebase واحد (`empirical-advice-8l2lq`) مع عزل منطقي وأمني صارم على مستوى `companyId` لكل شركة:

| Company ID | الاسم | النوع | الشركة الأم | القطاع |
| --- | --- | --- | --- | --- |
| `lumere-group` | **LUMERE GROUP** | `parent` | `null` | الإدارة المركزية القابضة |
| `lumere` | **LUMERE** | `subsidiary` | `lumere-group` | الإعلام، التسويق، الإعلان والتصوير (تُرحّل إليها جميع البيانات السابقة) |
| `nex-aura` | **NEX AURA** | `subsidiary` | `lumere-group` | تطوير البرمجيات والتكنولوجيا |
| `ordark` | **ORDARK** | `subsidiary` | `lumere-group` | التوصيل والخدمات اللوجستية |

> يدعم النظام إضافة شركات تابعة جديدة ديناميكيًا، وتعديل بياناتها وهويتها وشعارها، وتفعيلها أو تعطيلها بدون حذف تدميري (`allow delete: if false` في قواعد Firestore).

---

## 2. مصفوفة الصلاحيات الرباعية (4-Tier RBAC + Custom Claims)

تُطبَّق الصلاحيات على ثلاث طبقات متزامنة:
1. **Firebase Auth Custom Claims** (`{ role, companyId }`) عبر Cloud Functions v2 (`/functions/src/index.ts`).
2. **Firestore & Storage Security Rules** (`/firestore.rules`, `/storage.rules`) مع دعم التحقق من الحساب المؤسس (`lumerecompany@gmail.com`) كـ Bootstrap `SUPER_ADMIN`.
3. **حراس المنطق والواجهة** (`/src/utils/rbac.ts`, `/src/context/AuthContext.tsx`, `/src/context/CompanyContext.tsx`).

| الصلاحية / الإجراء | `SUPER_ADMIN` | `COMPANY_ADMIN` | `MANAGER` | `EMPLOYEE` |
| --- | :---: | :---: | :---: | :---: |
| لوحة قيادة المجموعة (`LUMERE GROUP`) | ✅ | ❌ | ❌ | ❌ |
| التبديل بين الشركات التابعة (`CompanySwitcher`) | ✅ | ❌ | ❌ | ❌ |
| إنشاء / تعديل / تفعيل / تعطيل الشركات | ✅ | ❌ | ❌ | ❌ |
| إدارة موظفي الشركة وطلبات الانضمام | جميع الشركات | شركته فقط | ❌ | ❌ |
| إسناد الأدوار المسموحة | جميع الأدوار الأربعة | `MANAGER`, `EMPLOYEE` فقط | ❌ | ❌ |
| إدارة الأقسام | جميع الشركات | شركته فقط | قراءة فقط | قراءة فقط |
| إدارة العملاء والمشاريع والمعدات | جميع الشركات | شركته فقط | شركته فقط | قراءة فقط |
| إنشاء المهام وإسنادها ومراجعتها | أي شركة تابعة | شركته فقط | شركته فقط | ❌ (تحديث مهامه فقط) |
| حذف المهام / المشاريع / العملاء | جميع الشركات | شركته فقط | ❌ | ❌ |
| التقارير وسجل النشاط | جميع الشركات | شركته فقط | شركته فقط | ❌ |

> **مبدأ عزل التبديل (`CompanySwitcher`)**: عند تبديل `SUPER_ADMIN` بين الشركات، يتغير سياق العرض (`activeCompanyId`) في `CompanyContext` فقط دون تعديل `currentUser.companyId` في قاعدة البيانات.

---

## 3. نموذج البيانات والفهارس (Firestore Collections & Indexes)

تحمل جميع المستندات التشغيلية حقل `companyId` إلزاميًا:
- `companies/{companyId}`
- `users/{uid}`
- `departments/{departmentId}`
- `clients/{clientId}`
- `projects/{projectId}`
- `tasks/{taskId}` + `tasks/{taskId}/comments/{commentId}`
- `notifications/{notificationId}`
- `activity_logs/{logId}` (غير قابل للتعديل أو الحذف)
- `equipment/{equipmentId}` + `equipmentHistory/{historyId}` (غير قابل للتعديل أو الحذف)
- `reports/{reportId}`

الفهارس المركبة (`companyId` + `createdAt`/`updatedAt`/`status`/`userId`) معرّفة بالكامل في `/firestore.indexes.json`.

مسارات التخزين السحابي المعزولة في `/storage.rules`:
- `companies/{companyId}/logos/{fileName}`
- `companies/{companyId}/tasks/{taskId}/{fileName}`
- `companies/{companyId}/projects/{projectId}/{fileName}`
- `companies/{companyId}/avatars/{userId}/{fileName}`

---

## 4. خطوات الترحيل والنشر الآمن للإنتاج (Zero-Downtime Migration & Deployment)

> **تحذير مهم**: لا تنشر القواعد الجديدة قبل ترحيل البيانات السابقة لإضافة `companyId: 'lumere'`، وإلا ستُرفض قراءة المستندات القديمة التي لا تحتوي على `companyId`.

### الخطوة 1: تجهيز الاعتمادات الإدارية
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export FIREBASE_PROJECT_ID="empirical-advice-8l2lq"
export FIRESTORE_DATABASE_ID="ai-studio-f456e639-5da6-4974-8a16-b2d2bbdd4686"
```

### الخطوة 2: نسخ احتياطي كامل قبل أي تعديل
```bash
npx tsx scripts/migration/backupFirestore.ts
```
سينتج ملف `manifest.json` داخل مجلد النسخ الاحتياطي (مثلاً `backups/2026-.../manifest.json`).

### الخطوة 3: محاكاة الترحيل بدون كتابة (Dry-Run)
```bash
npx tsx scripts/migration/migrateToMultiCompany.ts --dry-run
```
راجع التقرير وتأكد من عدد المستندات التي سيضاف لها `companyId: 'lumere'`، وترقية حسابات `ADMIN` القديمة إلى `SUPER_ADMIN`، وإنشاء الشركات الأساسية والأقسام الافتراضية دون استبدال البيانات القائمة.

### الخطوة 4: تطبيق الترحيل الفعلي (Idempotent)
```bash
npx tsx scripts/migration/migrateToMultiCompany.ts --apply --backup-manifest=backups/<TIMESTAMP>/manifest.json
```

### الخطوة 5: التحقق الآلي من سلامة البيانات بعد الترحيل
```bash
npx tsx scripts/migration/verifyMigration.ts
```
يتحقق السكربت من وجود الشركات الأربع، وخلو جميع المجموعات من مستندات بدون `companyId`، ومطابقة `companyId` لكل مهمة مع الموظف المسند إليه والمشروع المرتبط.

### الخطوة 6: بناء ونشر Cloud Functions وقواعد الأمان والفهارس
```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions,firestore:indexes,firestore:rules,storage --project empirical-advice-8l2lq
```

### الخطوة 7: مزامنة Custom Claims واختبار الحسابات الحقيقية
1. سجّل الدخول بحساب `SUPER_ADMIN` (سيستدعي تلقائيًا `syncMyClaims` أو يمكنك تحديث رمز الجلسة).
2. اختبر 4 حسابات حقيقية منفصلة (`SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `EMPLOYEE`) وتأكد من:
   - رؤية `SUPER_ADMIN` للوحة قيادة المجموعة وقدرته على التبديل بين `LUMERE`, `NEX AURA`, `ORDARK`.
   - منع `COMPANY_ADMIN` / `MANAGER` / `EMPLOYEE` من قراءة أو تعديل أي مستند ينتمي لشركة أخرى.
   - إضافة نطاق الإنتاج ونطاق المعاينة إلى **Firebase Authentication → Settings → Authorized domains** لتفعيل تسجيل الدخول عبر Google بدون خطأ `auth/unauthorized-domain`.

### التراجع في حالة الطوارئ (Rollback)
```bash
npx tsx scripts/migration/rollbackMigration.ts --manifest=backups/<TIMESTAMP>/manifest.json --confirm
```
