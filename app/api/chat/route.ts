import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// מאתחלים את ג'מיני עם המפתח החסוי מהקובץ הסודי
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { message, context } = await req.json();

    // הגדרת המודל יחד עם הוראות מערכת קשוחות (System Instruction)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "אתה עוזר הוראה אקדמי קפדן ודייקן לקורס מתפ 1. התפקיד שלך הוא לענות על שאלות הסטודנט אך ורק על בסיס הטקסט המצורף תחת חומרי הלימוד (Context). אם התשובה לשאלה אינה נמצאת באופן מפורש או משתמע ישירות מהחומר המצורף, עליך לענות במילים האלו בדיוק: 'המידע אינו מופיע בחומרי הלימוד של הקורס'. אל תמציא עובדות, אל תניח הנחות ואל תשתמש בשום ידע חיצוני מהאינטרנט.",
    });

    // הרכבת הפרומפט שכולל את חומרי הלימוד ואת השאלה
    const prompt = `חומרי הלימוד של הקורס (Context):
    ${context || "לא הועלו חומרי לימוד עדיין לקורס זה."}

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