# NiggaFlex Global

An OTT (over-the-top) streaming platform where an admin can publish movies and series — including content hosted on Internet Archive — and any visitor can watch them.

## Key Technologies

- **Frontend**: Vanilla HTML/CSS/JavaScript (`index.html`)
- **Backend**: Netlify Functions (TypeScript) for catalog CRUD and admin authentication
- **Database**: Netlify Database (managed Postgres via Drizzle ORM) for persistent, shared catalog storage
- **Video Playback**: Automatic detection of Internet Archive URLs, rendered as embedded iframes for reliable playback

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local dev server with Netlify CLI (required for functions and database):
   ```bash
   netlify dev
   ```

3. Open [http://localhost:8888](http://localhost:8888)

## Admin Access

Click **Admin Portal** in the header and enter the admin key. The key defaults to `rafaqat-utra1` but can be overridden by setting the `ADMIN_KEY` environment variable in your Netlify site settings.

## Internet Archive Videos

Paste any `archive.org/download/IDENTIFIER/file.mp4` URL — the player will automatically use the archive.org embed player for reliable cross-device playback.
