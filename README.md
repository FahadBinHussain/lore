# 🎬 Lore - Your Ultimate Media Universe Tracker

A beautiful and comprehensive media tracking application built with Next.js that helps you track and organize your entertainment across multiple platforms.

![Lore Banner](https://img.shields.io/badge/Lore-Media%20Tracker-blue?style=for-the-badge&logo=next.js)
![Next.js](https://img.shields.io/badge/Next.js-16.2.1-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat&logo=postgresql)

## ✨ Features

### 🎯 Comprehensive Media Tracking
Track your progress across **10 different media types**:

- 🎬 **Movies** - Track watched films with ratings and reviews
- 📺 **TV Shows** - Follow episodes, seasons, and series progress
- 🎮 **Video Games** - Monitor gaming achievements and completion status
- 📚 **Books** - Keep track of your reading progress and reviews
- 📖 **Comics** - Follow comic series and graphic novels
- 🧩 **Board Games** - Track your board game collection and play sessions
- 🎵 **Soundtracks** - Discover and track music from your favorite media
- 🎙️ **Podcasts** - Stay updated with your favorite podcast episodes
- 🎢 **Theme Parks** - Plan and track your theme park adventures

### 🔐 Authentication & Security
- **Google OAuth** integration for secure login
- **NextAuth.js** for robust authentication
- **Session management** with secure tokens

### 🎨 Modern UI/UX
- **Beautiful interface** built with Tailwind CSS
- **Responsive design** that works on all devices
- **Dark/Light mode** support
- **Smooth animations** and transitions
- **Accessible components** with shadcn/ui

### 📊 Powerful APIs Integration
- **TMDB** - Movies and TV shows data
- **IGDB** - Video games database
- **Open Library** - Books and publications
- **Comic Vine** - Comics and graphic novels
- **BoardGameGeek** - Board games database
- **MusicBrainz** - Music and soundtracks
- **Listen Notes** - Podcasts directory
- **Themeparks.wiki** - Theme parks information

### 🗄️ Database & Backend
- **PostgreSQL** database with connection pooling
- **Drizzle ORM** for type-safe database operations
- **RESTful API** endpoints for all media types
- **Real-time data** synchronization

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- PostgreSQL database (we recommend [Neon](https://neon.tech))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/FahadBinHussain/lore.git
   cd lore
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Configure your `.env.local` file with the required API keys:

   ```env
   # Database
   DATABASE_URL="your-postgresql-connection-string"

   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET="your-secure-random-secret"

   # Google OAuth
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"

   # API Keys
   TMDB_API_KEY="your-tmdb-api-key"
   IGDB_CLIENT_ID="your-igdb-client-id"
   IGDB_CLIENT_SECRET="your-igdb-client-secret"
   COMICVINE_API_KEY="your-comicvine-api-key"
   LISTEN_NOTES_API_KEY="your-listen-notes-api-key"
   BGG_API_KEY="your-bgg-api-key"  # Optional: For board games search
   ```

4. **Set up the database**
   ```bash
   # Generate database schema
   pnpm db:generate

   # Push schema to database
   pnpm db:push
   ```

5. **Run the development server**
   ```bash
   pnpm dev
   ```

6. **Open your browser**
   Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
lore/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboard
│   ├── [media-type]/      # Media-specific pages
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── [feature]/        # Feature-specific components
├── db/                   # Database configuration
│   ├── schema.ts         # Drizzle schema
│   └── migrations/       # Database migrations
├── lib/                  # Utility libraries
│   ├── api/             # External API integrations
│   ├── auth.ts          # Authentication config
│   └── utils.ts         # Helper functions
└── types/                # TypeScript type definitions
```

## 🛠️ Available Scripts

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Database
pnpm db:generate  # Generate Drizzle types
pnpm db:push      # Push schema changes
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio

# Testing
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
```

## 🔑 API Keys Setup

### Required API Keys
1. **TMDB API Key**: Get from [The Movie Database](https://www.themoviedb.org/settings/api)
2. **IGDB API**: Register at [IGDB](https://api-docs.igdb.com/) for client credentials
3. **Comic Vine API**: Sign up at [Comic Vine](https://comicvine.gamespot.com/api/)
4. **Listen Notes API**: Get key from [Listen Notes](https://www.listennotes.com/api/)
5. **Google OAuth**: Set up at [Google Cloud Console](https://console.cloud.google.com/)

### Optional APIs
- **Open Library**: No API key required
- **BoardGameGeek**: API key required (get from [BGG Applications](https://boardgamegeek.com/applications))
- **MusicBrainz**: No API key required
- **Themeparks.wiki**: No API key required

### BoardGameGeek API Configuration
BoardGameGeek requires an API key for their XML API2. Users can configure their own API key directly in the application:
1. Visit the Board Games page
2. If prompted for authentication, click the link to get an API key from BGG
3. Enter your API key in the configuration form
4. The key is stored locally in your browser for future use

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 16.2.1 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Icons**: Lucide React
- **Fonts**: Geist (Vercel)

### Backend
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: NextAuth.js
- **API**: RESTful endpoints

### DevOps
- **Package Manager**: pnpm
- **Linting**: ESLint
- **Code Formatting**: Prettier
- **Database**: Neon (PostgreSQL hosting)

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TMDB** for movie and TV data
- **IGDB** for video game information
- **Open Library** for book data
- **Comic Vine** for comics database
- **BoardGameGeek** for board game data
- **MusicBrainz** for music metadata
- **Listen Notes** for podcast directory
- **Themeparks.wiki** for theme park information

## 📞 Support

If you have any questions or need help:

- Open an [issue](https://github.com/FahadBinHussain/lore/issues) on GitHub
- Check the [documentation](https://github.com/FahadBinHussain/lore/wiki)
- Join our [Discord community](https://discord.gg/lore)

---

**Made with ❤️ by the Lore team**
