import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4" dir="rtl">
      <Card className="w-full max-w-md bg-slate-900 text-white border-slate-800 shadow-2xl shadow-cyan-900/20">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            AI Student
          </CardTitle>
          <CardDescription className="text-slate-400 text-lg">
            הזן את פרטי ההתחברות שלך למערכת
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-slate-300 text-md">שם משתמש</Label>
            <Input
              id="username"
              type="text"
              placeholder="yerahmiel lifsitz"
              className="bg-slate-800 border-slate-700 text-white focus-visible:ring-cyan-500 h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300 text-md">סיסמה</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="bg-slate-800 border-slate-700 text-white focus-visible:ring-cyan-500 h-12"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/dashboard" className="w-full">
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white h-12 text-lg font-medium transition-colors">
              התחבר למערכת
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}