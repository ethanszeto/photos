# Photo App

Mobile-first private photo app PWA built with Next.js App Router, direct-to-S3 uploads, and a 6-digit passcode lock screen.

## Features

- iOS-style 6-digit passcode lock with session cookie auth
- Presigned PUT uploads (files never pass through the Next.js server)
- Apple Photos–inspired dark gallery with virtualized grid
- Installable PWA (manifest + service worker)

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy the example file and fill in values:

```bash
cp .env.example .env.local
```

| Variable                | Required   | Description                                                       |
| ----------------------- | ---------- | ----------------------------------------------------------------- |
| `PHOTO_APP_PASSCODE`    | Yes        | 6-digit numeric passcode (e.g. `123456`)                          |
| `SESSION_SECRET`        | Yes (prod) | Long random string used to sign session JWT cookies               |
| `AWS_REGION`            | Yes        | S3 region (e.g. `us-east-1`)                                      |
| `AWS_ACCESS_KEY_ID`     | Yes        | IAM access key                                                    |
| `AWS_SECRET_ACCESS_KEY` | Yes        | IAM secret key                                                    |
| `S3_BUCKET_NAME`        | Yes        | Private S3 bucket name                                            |
| `S3_USE_PRESIGNED_VIEW` | No         | Default `true`. Set `false` only if objects are publicly readable |

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your passcode, then use the gallery upload button.

## AWS S3 CORS configuration

Apply this CORS configuration on your **private** bucket (replace origin with your production URL):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

- **PUT** is required for browser direct uploads via presigned URLs.
- **GET/HEAD** are required if you disable presigned view URLs and serve public object URLs, or for debugging.
- With presigned GET URLs (default), the browser loads images from `*.amazonaws.com`; CORS on GET still applies for canvas/cross-origin use.

## IAM permissions

Attach a policy like this to the IAM user whose keys you use (tighten `Resource` to your bucket ARN):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PhotoVaultS3",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::YOUR_BUCKET_NAME", "arn:aws:s3:::YOUR_BUCKET_NAME/originals/*"]
    }
  ]
}
```

The app stores originals at `originals/{uuid}.{ext}`.

## Optional: public direct S3 URLs

By default the gallery uses **presigned GET URLs** so the bucket can stay private. To use direct URLs:

`https://{bucket}.s3.{region}.amazonaws.com/{key}`

1. Add a bucket policy allowing `s3:GetObject` on `originals/*` (or make objects public).
2. Set `S3_USE_PRESIGNED_VIEW=false` in `.env.local` / Vercel.

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Add the same environment variables from `.env.example` in **Project → Settings → Environment Variables**.
4. Use a strong `SESSION_SECRET` (not the passcode).
5. Add your Vercel URL to the S3 bucket CORS `AllowedOrigins`.
6. Deploy.

```bash
# Optional CLI deploy from repo root
npx vercel
npx vercel --prod
```

After deploy, install on iOS via **Share → Add to Home Screen** (standalone PWA).

## Project structure

```
app/              # Routes, API handlers, pages
components/       # UI (passcode, gallery, PWA)
lib/              # Auth, S3, upload client utilities
types/            # Shared TypeScript types
middleware.ts     # Protects /gallery and /api/*
public/           # manifest, service worker, icons
```

## API routes

| Route                       | Auth     | Description                           |
| --------------------------- | -------- | ------------------------------------- |
| `POST /api/auth/login`      | Public   | Verify passcode, set session cookie   |
| `POST /api/auth/logout`     | Public   | Clear session                         |
| `GET /api/auth/session`     | Public   | Check session                         |
| `POST /api/upload/init`     | Required | Presigned PUT URL + `photoId` + `key` |
| `GET /api/gallery/list`     | Required | List originals from S3                |
| `GET /api/gallery/url?key=` | Required | View URL for a single object          |
