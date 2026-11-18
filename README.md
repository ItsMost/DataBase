# Gym Solo — حسابات المدرب

تطبيق موبايل (PWA) للمدرب عشان يتابع حسابات اللاعيبة:

- **القاعدة:** بيانات اللاعيبة (الاسم، والمواليد، والنادي، والمركز، والموبايل...).
- **الاشتراكات:** الباقات ("بتخلص بالحصص" أو "بالشهر")، و"حصة واحدة"، والحضور، والحصص الزيادة، وفلوس الجيم/المكان.
- **التنبيهات:** محتاج يجدد، وحضر زيادة وعليه فلوس، ومش نشط.
- **التقارير:** شهرية (والشهر الحالي بيتقارن بنفس عدد الأيام من الشهر اللي قبله)، ويومية، والمحفظة، والمصروفات بأنواعها.
- **الواتساب:** تذكير بالدفع وإيصال بعد الدفع، والنص بيتعدل من الإعدادات.
- **بيشتغل من غير نت:** كل البيانات محفوظة على الموبايل (Dexie / IndexedDB)، وبتتزامن مع Supabase أول ما النت يرجع.

## التشغيل على جهازك

```bash
npm install
cp .env.example .env.local   # واملا القيم (شوف تحت)
npm run dev
```

| الأمر | بيعمل إيه |
|---|---|
| `npm run dev` | يشغّل التطبيق محليًا |
| `npm test` | اختبارات الحسابات (Vitest) |
| `npm run lint` | فحص الكود |
| `npm run build` | نسخة الإنتاج + الـ service worker |
| `npm run icons` | يعمل أيقونات الـ PWA من `public/favicon.svg` |

## الـ Environment variables

| المتغير | منين |
|---|---|
| `VITE_SUPABASE_URL` | Supabase ← Project Settings ← API ← Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase ← Project Settings ← API ← `anon` `public` key |

- **محليًا:** في ملف `.env.local` (مش بيترفع على GitHub).
- **على Vercel:** Project ← Settings ← Environment Variables. ضيف الاتنين لـ Production و Preview، وبعدها اعمل Redeploy.
- لو المتغيرات مش موجودة، الـ build **بيفشل برسالة واضحة**، فالنسخة الشغالة بتفضل زي ما هي.

> ⚠️ مفتاح `anon` بيبان لأي حد بيفتح الموقع، وده طبيعي. اللي بيحمي البيانات هو **RLS** في Supabase
> (`supabase/migrations/20261118000000_phase1_rls_and_backups.sql`). لازم يكون متنفّذ.

## حساب المدرب

الدخول بكود بس. وراه حساب Supabase Auth واحد، والكود هو الباسورد بتاعه:

1. Supabase ← Authentication ← Users ← **Add user** ← Create new user.
2. الإيميل: `coach@gym-solo.app` (مكتوب في `src/components/LoginScreen.tsx`).
3. الباسورد: كود الدخول اللي تختاره (6 حروف أو أكتر).
4. علّم **Auto Confirm User**.
5. Authentication ← Sign In / Providers: اقفل **Allow new users to sign up**.

علشان تغيّر الكود: غيّر باسورد الحساب ده من نفس المكان.

## ترتيب الكود

```
src/
  lib/          الحسابات والتواريخ والثوابت (من غير React، وعليها اختبارات)
    subscription.ts   دالة الانتهاء الموحدة + فلوس الجيم لكل حصة + الحصص الزيادة
    reports.ts        التقارير الشهرية/اليومية + المقارنة العادلة
    messages.ts       رسايل الواتساب
    constants.ts      أنواع الاشتراكات، وأسماء الشهور، والقيم الافتراضية
    dates.ts          التواريخ
  services/     التخزين والمزامنة
    db.ts             Dexie (البيانات على الموبايل)
    supabaseClient.ts الاتصال بـ Supabase + الجلسة
    sync.ts           طابور المزامنة + عدد اللي مستني + أخطاء المزامنة
    backup.ts         النسخة الأسبوعية + نسخة قبل الاسترجاع
    dailyCleanup.ts   التنضيف اليومي (مرة في اليوم)
  hooks/        الـ state والعمليات
    useAppData        تحميل البيانات + Realtime + التنضيف اليومي
    usePlayers        اللاعيبة، والجروبات، والمصروفات، وقفل الشهر، وسلة المحذوفات
    useSubscriptions  الدفع، والحصص الزيادة، والحضور، والمتوقع اليوم
    useSettings / useWallet / useDataTools
    useActiveSection / useProfileSection   منطق التابين الكبار
  components/   الشاشات
    subscriptions/    أجزاء تاب الاشتراكات
    profile/          أجزاء البروفايل
    modals/ layout/   النوافذ والأجزاء الجانبية
tests/real-data.test.ts   بيقفل أرقام التقارير على داتا حقيقية (الداتا في tests/private ومش بتترفع)
```

## الاختبارات

- `npm test` بيشغّل اختبارات الحسابات: بالحصص "15 من 12"، وبالشهر وفاضل حصص، وحصة واحدة، ودفع الزيادة بس، والتجديد المتأخر من غير تكرار فلوس الجيم، والباقات المخفضة، والمقارنة العادلة.
- **أرقام الداتا الحقيقية:** حط export من جدول `players_sync` في `tests/private/real-players.json`. أول تشغيل بيحفظ الأرقام، وأي تغيير بعد كده الاختبار يفشل. الفولدر ده في `.gitignore`، لأن فيه أسماء وتليفونات وفلوس.
