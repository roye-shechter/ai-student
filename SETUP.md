# AI Student Platform - Setup Guide

## 🚀 Quick Start (Phase 1 - Foundation)

This guide will help you set up the AI Student Platform with authentication and database.

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git

### Step 1: Install Dependencies

```bash
cd ai-student
npm install
```

### Step 2: Configure Environment Variables

1. Copy the example environment file:
```bash
copy .env.example .env
```

2. Generate a secure NEXTAUTH_SECRET:
```bash
# On Windows PowerShell:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or online: https://generate-secret.vercel.app/32
```

3. Update `.env` with your values:
```env
# The DATABASE_URL should already be set from prisma init
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=YOUR_API_KEY"

# Add your generated secret here
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<your-generated-secret-here>"

# Add your Gemini API key (get from: https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="your_gemini_api_key_here"
```

### Step 3: Start Local Database

Prisma provides a local PostgreSQL database for development:

```bash
npx prisma dev
```

This will start a local PostgreSQL instance. Keep this terminal open.

### Step 4: Run Database Migrations

In a new terminal, create the database tables:

```bash
npx prisma migrate dev --name init
```

This will:
- Create all tables defined in your Prisma schema
- Generate the Prisma Client
- Prepare the database for use

### Step 5: Seed the Database

Add sample data (test user and courses):

```bash
npx prisma db seed
```

This creates:
- Test user: `yerahmiel` / password: `123456`
- Two sample courses (מתפ 1, מתפ 2)
- Sample enrollments and quiz data

### Step 6: Start the Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

---

## 📝 Test Credentials

After seeding, you can log in with:

- **Username:** `yerahmiel`
- **Email:** `test@example.com`
- **Password:** `123456`

---

## 🗂️ Project Structure

```
ai-student/
├── app/
│   ├── (auth)/
│   │   ├── login/          # Login page
│   │   └── register/       # Registration page
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/  # NextAuth handler
│   │   │   ├── register/       # Registration endpoint
│   │   │   └── session/        # Session check endpoint
│   │   └── chat/           # AI chat endpoint (existing)
│   ├── dashboard/          # Protected dashboard
│   │   ├── layout.tsx      # Auth protection
│   │   ├── page.tsx        # Main dashboard
│   │   └── matap1/         # Course-specific pages
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Redirects to /login
│   └── providers.tsx       # NextAuth SessionProvider
├── components/
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── auth.ts             # NextAuth configuration
│   ├── prisma.ts           # Prisma client instance
│   └── utils.ts            # Utility functions
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.ts             # Database seed script
│   └── migrations/         # Database migrations
├── types/
│   └── next-auth.d.ts      # NextAuth TypeScript definitions
├── .env                    # Environment variables (not in git)
├── .env.example            # Example environment variables
└── package.json
```

---

## 🔧 Common Commands

### Database Management

```bash
# View database in browser
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Create a new migration
npx prisma migrate dev --name <migration-name>

# Re-seed database
npx prisma db seed
```

### Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

---

## 🎯 What's Implemented (Phase 1)

✅ **Database & ORM**
- PostgreSQL database with Prisma
- Complete schema for users, courses, enrollments, etc.
- Database migrations and seeding

✅ **Authentication**
- NextAuth.js with credentials provider
- Secure password hashing with bcrypt
- Session management with JWT
- Protected routes and API endpoints

✅ **User Interface**
- Modern login page (Hebrew RTL)
- Registration page with validation
- Protected dashboard
- Responsive design with Tailwind CSS

✅ **API Endpoints**
- `/api/auth/[...nextauth]` - Authentication
- `/api/auth/register` - User registration
- `/api/auth/session` - Session checking
- `/api/chat` - AI chat (existing)

---

## 🔜 Next Steps (Future Phases)

### Phase 2: Moodle Integration
- Configure Moodle OAuth
- Implement course sync
- Download course materials
- User enrollment sync

### Phase 3: RAG Implementation
- Set up vector database (Pinecone/Qdrant)
- Implement document processing
- Create isolated vector namespaces
- Build semantic search

### Phase 4: AI Tutor Enhancement
- Integrate RAG with AI chat
- Implement quiz generation
- Add conversation history
- Streaming responses

### Phase 5: Analytics & Features
- Progress tracking dashboards
- Learning analytics
- Performance visualizations
- Course recommendations

---

## 🐛 Troubleshooting

### Database Connection Issues

If `npx prisma dev` fails:
1. Make sure no other PostgreSQL instance is running on the same port
2. Try closing and reopening your terminal
3. Check if Windows Firewall is blocking the connection

### Authentication Not Working

1. Verify `NEXTAUTH_SECRET` is set in `.env`
2. Verify `NEXTAUTH_URL` matches your localhost URL
3. Clear browser cookies and try again
4. Check browser console for errors

### Prisma Client Not Found

If you see "Cannot find module '@prisma/client'":
```bash
npx prisma generate
```

### TypeScript Errors

After making changes to Prisma schema:
```bash
npx prisma generate
npm run dev
```

---

## 📚 Documentation Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

---

## 🤝 Need Help?

If you encounter issues:
1. Check this SETUP.md file
2. Review the `.env.example` for required variables
3. Check the console for error messages
4. Verify database is running (`npx prisma studio`)

---

**Last Updated:** June 18, 2026
**Version:** 1.0 (Phase 1 - Foundation Complete)
