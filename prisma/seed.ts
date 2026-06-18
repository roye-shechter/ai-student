import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./dev.db',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting database seed...')

  // Create test user
  const passwordHash = await bcrypt.hash('123456', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'yerahmiel',
      passwordHash: passwordHash,
      fullName: 'ירחמיאל ליפשיץ',
      role: 'student',
    },
  })

  console.log('✅ Created user:', user.username)

  // Create sample courses
  const course1 = await prisma.course.upsert({
    where: { courseCode: 'matap1' },
    update: {},
    create: {
      courseCode: 'matap1',
      courseName: 'מתפ 1',
      description: 'מבוא ללמידה וניתוח אלגוריתמים',
      instructorName: 'ד"ר משה כהן',
      isActive: true,
    },
  })

  const course2 = await prisma.course.upsert({
    where: { courseCode: 'matap2' },
    update: {},
    create: {
      courseCode: 'matap2',
      courseName: 'מתפ 2',
      description: 'מערכות לומדות ורשתות נוירונים',
      instructorName: 'ד"ר שרה לוי',
      isActive: true,
    },
  })

  console.log('✅ Created courses:', course1.courseName, course2.courseName)

  // Enroll user in courses
  const enrollment1 = await prisma.enrollment.upsert({
    where: { 
      userId_courseId: {
        userId: user.id,
        courseId: course1.id,
      }
    },
    update: {},
    create: {
      userId: user.id,
      courseId: course1.id,
      completionPercentage: 80,
      isActive: true,
    },
  })

  const enrollment2 = await prisma.enrollment.upsert({
    where: { 
      userId_courseId: {
        userId: user.id,
        courseId: course2.id,
      }
    },
    update: {},
    create: {
      userId: user.id,
      courseId: course2.id,
      completionPercentage: 35,
      isActive: true,
    },
  })

  console.log('✅ Created enrollments')

  // Create sample quiz attempts for analytics
  await prisma.quizAttempt.createMany({
    data: [
      {
        userId: user.id,
        courseId: course1.id,
        quizTitle: 'בחן 1 - מבוא',
        scorePercentage: 85,
        totalQuestions: 20,
        correctAnswers: 17,
        timeSpentSeconds: 1200,
      },
      {
        userId: user.id,
        courseId: course1.id,
        quizTitle: 'בחן 2 - אלגוריתמים',
        scorePercentage: 92,
        totalQuestions: 15,
        correctAnswers: 14,
        timeSpentSeconds: 900,
      },
    ],
  })

  console.log('✅ Created quiz attempts')

  // Create sample learning sessions for analytics
  const now = new Date()
  await prisma.learningSession.createMany({
    data: [
      {
        userId: user.id,
        courseId: course1.id,
        sessionStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        sessionEnd: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        durationMinutes: 60,
        activityType: 'reading',
      },
      {
        userId: user.id,
        courseId: course1.id,
        sessionStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        sessionEnd: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        durationMinutes: 90,
        activityType: 'chat',
      },
    ],
  })

  console.log('✅ Created learning sessions')

  console.log('🎉 Seed completed successfully!')
  console.log('\n📝 Test credentials:')
  console.log('   Email: test@example.com')
  console.log('   Username: yerahmiel')
  console.log('   Password: 123456')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
