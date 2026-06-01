import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// מאתחלים את ג'מיני עם המפתח החסוי מהקובץ הסודי
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// הטקסט הקשיח שלנו לבדיקה - סיכום על מכפלה וקטורית וסקלרית
const hardcodedContext = `
סיכום נושא: מכפלה סקלרית ומכפלה וקטורית

1. מכפלה סקלרית (Dot Product):
- הגדרה: פעולה אלגברית בין שני וקטורים שמחזירה סקלר (מספר בודד, ללא כיוון).
- נוסחה מתמטית: A · B = |A| * |B| * cos(θ), כאשר θ היא הזווית בין הוקטורים.
- משמעות גיאומטרית: הפעולה משקפת עד כמה שני הוקטורים מקבילים זה לזה. בפועל, מדובר במכפלת הגודל של וקטור אחד בהיטל של הוקטור השני עליו.
- דוגמה פיזיקלית: חישוב שטף חשמלי (מכפלה סקלרית של וקטור השדה החשמלי ווקטור השטח) או עבודה (מכפלה של כוח והעתק).

2. מכפלה וקטורית (Cross Product):
- הגדרה: פעולה בין שני וקטורים שמחזירה וקטור חדש במרחב התלת-ממדי.
- כיוון הוקטור: הוקטור החדש תמיד מאונך (ניצב) למישור שנוצר על ידי שני הוקטורים המקוריים. הכיוון המדויק נקבע על פי "כלל יד ימין".
- גודל הוקטור (נוסחה): |A × B| = |A| * |B| * sin(θ).
- משמעות גיאומטרית: הגודל של הוקטור החדש שווה לשטח המקבילית ששני הוקטורים המקוריים יוצרים.
- דוגמה פיזיקלית: חישוב כוח לורנץ הפועל על מטען חשמלי הנע בשדה מגנטי, או חישוב מומנט כוח (Torque).
`;

export async function POST(req: Request) {
  try {
    // שולפים רק את הודעת המשתמש, מתעלמים מה-context של ה-Frontend כרגע
    const { message } = await req.json();

    // הגדרת המודל יחד עם הוראות מערכת קשוחות (System Instruction)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "אתה עוזר הוראה אקדמי קפדן ודייקן לקורס מתפ 1. התפקיד שלך הוא לענות על שאלות הסטודנט אך ורק על בסיס הטקסט המצורף תחת חומרי הלימוד (Context). אם התשובה לשאלה אינה נמצאת באופן מפורש או משתמע ישירות מהחומר המצורף, עליך לענות במילים האלו בדיוק: 'המידע אינו מופיע בחומרי הלימוד של הקורס'. אל תמציא עובדות, אל תניח הנחות ואל תשתמש בשום ידע חיצוני מהאינטרנט.",
    });

    // הרכבת הפרומפט שכולל את חומרי הלימוד הקשיחים (Hardcoded) ואת השאלה
    const prompt = `חומרי הלימוד של הקורס (Context):
    ${hardcodedContext}

    שאלת הסטודנט:
    ${message}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ text: responseText });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "שגיאה בתקשורת עם ה-AI" }, { status: 500 });
  }
}