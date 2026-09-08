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
Prisma 7 + PostgreSQL (Neon) · NextAuth v4 (Credentials, JWT) ·
Anthropic SDK (צ'אט) · OpenAI SDK (embeddings + תמלול) · Pinecone (וקטורים)

⚠️ ראה AGENTS.md למעלה — גרסת Next.js הזו כוללת breaking changes מול training data.

## ארכיטקטורה — דפוסים לשמור עליהם
- **RAG pipeline** חי ב-`lib/rag/`: `clients.ts` (קליינטים משותפים + ולידציית env),
  `extract-text.ts` (זיהוי סוג קובץ + חילוץ טקסט מ-PDF), `ingest.ts` (חיתוך→embedding→
  Pinecone), `chat.ts` (retrieval→prompt→Claude, כולל `chatStream()` — הגרסה הפעילה,
  streaming NDJSON).
- **העלאת מסמכים** (`app/api/upload/token` + `app/api/upload/finalize`): הקובץ עולה
  ישירות מהדפדפן ל-Vercel Blob (עוקף את מגבלת ה-body של ~4.5MB שיש לפונקציות
  serverless), ולא דרך גוף הבקשה שלנו. `finalize` יוצר `Document` בסטטוס
  `pending` ומחזיר תשובה מיד; חיתוך/embedding/Pinecone רצים ברקע דרך
  `after()` מ-`next/server` (לא חוסם את הלקוח, ולא כפוף למגבלת body). ה-UI
  (`app/dashboard/[courseCode]/page.tsx`) עושה polling על `/api/documents` כל
  שיש `status` של `pending`/`processing`, ומציג אותו דרך `StatusBadge` הקיים.
  **אל תחזירו** להעלאה סינכרונית עם קובץ בגוף הבקשה — זה בדיוק הבאג שתוקן
  (קבצים מעל ~4.5MB נכשלו בשקט ברמת הפלטפורמה, לפני שהקוד שלנו בכלל רץ).
- **Routes דקים**: כל `app/api/**/route.ts` עושה auth → rate-limit → delegate ל-`lib/`,
  לא לוגיקה עסקית ב-route עצמו.
- **בידוד דיירים (tenant isolation)**: כל שאילתת Pinecone מסוננת לפי `{userId, courseId}` —
  זו גבול אבטחה קשיח, לא לשבור אותו אף פעם.
- **UI**: כל הטקסט למשתמש בעברית, RTL.
- Next.js 16: auth gate הוא `proxy.ts` בשורש (**לא** `middleware.ts` הישן).
- Rate limiting: `lib/rate-limit.ts` — `assertUnderDailyLimit(userId, kind)`,
  מכסה יומית per-user לפי `UsageCounter` ב-DB.

## משתני סביבה נדרשים
ראה `.env.example` — `DATABASE_URL`, `NEXTAUTH_SECRET`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `PINECONE_API_KEY`/`PINECONE_INDEX`.

## פקודות נפוצות
`npm run dev` · `npx prisma db push` (⚠️ **לא** `migrate dev` — אין תיקיית
`prisma/migrations` בפרויקט; `migrate dev` עלול לנסות ליצור baseline ולאפס
את הסכמה) · `npx prisma studio`

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
