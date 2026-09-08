@AGENTS.md

# AI Student Platform — הקשר לסוכני Claude Code

## מטרת הפרויקט
פלטפורמת למידה שבה סטודנט מרכז את כל קורסי האוניברסיטה שלו, עם מורה פרטי AI
שמלמד לפי חומרי הקורס, בודק הבנה בפועל (מבחנים), נותן פידבק ממוקד, ועוקב
אחרי התקדמות.

**מפת דרכים נוכחית (בעבודה):**
- Phase 0 — ליבת ה-AI: ניתוב לפי קושי, extended thinking + כלי code-execution
  לבעיות מתמטיקה/הנדסה קשות, streaming (✅ קיים), prompt caching.
- Phase A — מנוע מבחנים: יצירת מבחנים מהחומר המועלה, בדיקה אוטומטית + פידבק,
  זיהוי "נושאים חלשים" שמוזן חזרה לצ'אט.
- Phase B — מעקב התקדמות ואנליטיקה אמיתית (הדשבורד הקיים מציג כרגע נתוני דמו).
- Phase C — קליטת הרצאות אודיו/וידאו (תמלול → אותו RAG pipeline) — עדיפות אחרונה.
- מחוץ לסקופ כרגע: אינטגרציית Moodle (שדות הסכמה נשארים placeholder).

## סטאק
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn/ui ·
Prisma 7 + PostgreSQL/Neon **עם pgvector** (הווקטורים חיים ב-Postgres עצמו,
ראו למטה) · NextAuth v4 (Credentials, JWT) ·
Anthropic SDK (צ'אט) · OpenAI SDK (embeddings + תמלול) · Vercel Blob (קבצים)

⚠️ ראה AGENTS.md למעלה — גרסת Next.js הזו כוללת breaking changes מול training data.

## ארכיטקטורה — דפוסים לשמור עליהם
- **RAG pipeline** חי ב-`lib/rag/`: `clients.ts` (קליינטים משותפים + ולידציית env +
  `toVectorSql()`), `extract-text.ts` (זיהוי סוג קובץ + חילוץ טקסט מ-PDF), `ingest.ts`
  (חיתוך→embedding→pgvector), `chat.ts` (retrieval→prompt→Claude, כולל `chatStream()`
  — הגרסה הפעילה, streaming NDJSON).
- **וקטורים ב-Postgres, לא בשירות חיצוני** (`DocumentChunk` ב-`prisma/schema.prisma`,
  עמודת `embedding` מסוג `Unsupported("vector(1536)")` — Prisma Client לא יכול
  לגעת בה ישירות, כל קריאה/כתיבה עוברת דרך `$queryRaw`/`$executeRaw`). **בידוד
  דיירים** הוא `WHERE "userId" = ? AND "courseId" = ?` רגיל על כל שורה — לא
  לשבור את זה אף פעם. יש אינדקס HNSW (`document_chunks_embedding_hnsw`,
  `vector_cosine_ops`) שנוצר ידנית (Prisma `db push` לא בונה HNSW באופן
  דקלרטיבי בגרסה הזו) — אם ה-schema משתנה בעתיד ודורש push מחדש של הטבלה,
  לוודא שהאינדקס עדיין קיים (`SELECT indexname FROM pg_indexes WHERE
  tablename = 'document_chunks'`), וליצור מחדש אם לא.
  **היסטוריה:** עברנו מ-Pinecone (2026-09) כי התוכנית החינמית שלו מוגבלת ל-100
  namespaces לכל אינדקס, וה-app יצר namespace לכל קורס — קיר שנתקלים בו סביב
  100 קורסים בסך הכול, הרבה לפני "אלפי משתמשים". כל הנתונים (25 מסמכים, 357
  קטעים) הועברו בהצלחה מ-Pinecone (לפני מחיקתו) ל-`document_chunks`.
- **העלאת מסמכים** (`app/api/upload/token` + `app/api/upload/finalize`): הקובץ עולה
  ישירות מהדפדפן ל-Vercel Blob (עוקף את מגבלת ה-body של ~4.5MB שיש לפונקציות
  serverless), ולא דרך גוף הבקשה שלנו. `finalize` יוצר `Document` בסטטוס
  `pending` ומחזיר תשובה מיד; חיתוך/embedding/insert רצים ברקע דרך
  `after()` מ-`next/server` (לא חוסם את הלקוח, ולא כפוף למגבלת body). ה-UI
  (`app/dashboard/[courseCode]/page.tsx`) עושה polling על `/api/documents` כל
  שיש `status` של `pending`/`processing`, ומציג אותו דרך `StatusBadge` הקיים.
  **אל תחזירו** להעלאה סינכרונית עם קובץ בגוף הבקשה — זה בדיוק הבאג שתוקן
  (קבצים מעל ~4.5MB נכשלו בשקט ברמת הפלטפורמה, לפני שהקוד שלנו בכלל רץ).
- **Routes דקים**: כל `app/api/**/route.ts` עושה auth → rate-limit → delegate ל-`lib/`,
  לא לוגיקה עסקית ב-route עצמו.
- **UI**: כל הטקסט למשתמש בעברית, RTL.
- Next.js 16: auth gate הוא `proxy.ts` בשורש (**לא** `middleware.ts` הישן).
- Rate limiting: `lib/rate-limit.ts` — `assertUnderDailyLimit(userId, kind)`,
  מכסה יומית per-user לפי `UsageCounter` ב-DB.

## מועדי בחינות
`ExamDate` (`prisma/schema.prisma`) מחזיק עד שלוש שורות לכל קורס — `midterm`
(בוחן אמצע, אופציונלי), `final_a` ו-`final_b` (מועד א/ב) — עם `@@unique([courseId,
type])`. אלה עובדות **ברמת הקורס, לא לפי משתמש** (כמו הקורסים עצמם — קטלוג
משותף), so כל סטודנט רשום רואה ועורך אותם. `CreateCourseDialog` שואל עליהם
כאשגר יוצרים קורס (עם אפשרות "דלג, אמלא אחר כך"); `ExamDatesCard` בדף הקורס
מאפשר לערוך/למחוק כל שדה בנפרד (`PUT`/`DELETE` implicit דרך `date: null` ב-
`/api/courses/[courseId]/exam-dates`); `DashboardExamCalendar` בדשבורד הראשי
מרכז את כל התאריכים מכל הקורסים של המשתמש (`/api/exam-dates`, דרך
`Enrollment`). כל התאריכים נשמרים כ"YYYY-MM-DD" ומומרים ל-UTC midnight
(`lib/exam-dates.ts`'s `dateOnlyToUTC`/`formatDateOnly*`) — לעולם לא Date עם
שעה אמיתית, כדי שהתאריך שנבחר לא יזוז יום בגלל timezone.

## פרופיל משתמש
`User` (`prisma/schema.prisma`) מחזיק `institution`, `degree`, `studyYear`,
`age` — כולם נשאלים חובה ב-`OnboardingModal` (בכניסה הראשונה, לפני
`onboardingCompleted=true`) ואפשר לערוך אחר כך דרך "הגדרות פרופיל" בדשבורד
הראשי (`ProfileSettingsDialog`, `PATCH /api/me`).

## פאנל ניהול (`/admin`)
דשבורד אנליטיקה למשתמש בלבד (לא מקושר מה-UI הרגיל) — **לא** קשור ל-NextAuth
session; שער נפרד (`lib/admin-auth.ts`): בוחרים שם מתוך שתי זהויות קבועות
(`ADMIN_PROFILES`), מזינים סיסמה משותפת (`ADMIN_PASSCODE` env, ברירת מחדל
"777"), ומקבלים cookie חתום ב-HMAC (`NEXTAUTH_SECRET`). כל route תחת
`app/api/admin/**` בודק את ה-cookie הזה בעצמו (`requireAdmin()`) — לא סומך
על ה-UI.

מעקב פעילות (`ActivityEvent`, `lib/activity-log.ts`'s `logActivity()`) הוא
**גס בכוונה**, לא לוג של כל בקשה — נרשמים רק אירועים משמעותיים: `login`
(כולל IP/User-Agent, מ-`lib/auth.ts`'s `authorize()`), `course_created`,
`document_uploaded`, `quiz_completed`. ספירות "כמה בקשות" בדשבורד מגיעות
מ-`UsageCounter` הקיים (כבר קיים למכסות יומיות, לא טבלה חדשה). זמן למידה
מגיע מ-`LearningSession` הקיים. הטבלה `ActivityEvent` נגזמת אוטומטית
(`logActivity` מוחק שורות מעל 90 יום ב-~5% מהכתיבות) כדי להישאר קטנה ב-DB
החינמי — **אל תוסיפו** לוג לכל הודעת צ'אט/בקשת API, רק אבני דרך.

## משתני סביבה נדרשים
ראה `.env.example` — `DATABASE_URL`, `NEXTAUTH_SECRET`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`. (אין יותר מפתח וקטור-DB נפרד —
הווקטורים ב-Postgres עצמו, ראו מעלה.)

## פקודות נפוצות
`npm run dev` · `npx prisma db push` (⚠️ **לא** `migrate dev` — אין תיקיית
`prisma/migrations` בפרויקט; `migrate dev` עלול לנסות ליצור baseline ולאפס
את הסכמה) · `npx prisma studio`

⚠️ ה-`extensions = [vector]` ב-`datasource` וה-`previewFeatures =
["postgresqlExtensions"]` ב-`generator` הכרחיים ל-`db push` — בלעדיהם
Prisma זורק שגיאה על עמודת ה-`embedding`. אל תסירו אותם.

## עבודה במקביל (כמה סשנים/סוכנים)
`app/api/chat/route.ts` ו-`lib/rag/chat.ts` הם קבצים "חמים" בשיתוף — לתאם
בעלות לפני עריכה כדי למנוע קונפליקטים. יש לבדוק `git status` בתוך
`ai-student/` (יש לה `.git` נפרד מהריפו החיצוני ב-`STUDENT-AI/`) לפני
תחילת עבודה.

## כלים והרשאות לסוכני Claude Code בפרויקט הזה
מותר ללא אישור נוסף: קריאה/כתיבה/עריכה של קוד, `npx prisma db push` (סביבת
פיתוח מקומית), `npm install`, הרצת בדיקות/lint, יצירת commit מקומי.

**דורש אישור מפורש מהמשתמש בצ'אט לפני ביצוע:** `git push`, כל פעולה מול DB
פרודקשן (Neon), `prisma migrate deploy`, מחיקת נתונים, שינוי/רוטציה של
מפתחות API, פתיחת/עדכון PR, כל דבר שנוגע ל-Vercel deployment.
