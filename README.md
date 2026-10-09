This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Survey reports

Survey report PDFs live in the private Supabase Storage bucket `survey-reports`, with one row each in `public.survey_reports`. Run `supabase/survey_reports.sql` once in the Supabase SQL Editor to create the bucket, the table and their policies (signed-in users only). Until it has been run, survey pages show "Reports storage not set up yet".

Reports are managed on `/surveys/[jobId]`: upload, View, Download, Delete, and Send to customer. Sending only happens when you press Send in the confirm dialog. PDFs up to 10 MB are attached; bigger ones are sent as a signed link that lasts 14 days.

### Survey report upload API

`POST /api/survey-reports` uploads a report. It **only uploads**: it never emails or deletes anything.

Auth:

- A signed-in office session (browser cookies), or
- `Authorization: Bearer <token>`, which only works when the Vercel env var `SURVEY_REPORTS_UPLOAD_TOKEN` is set (at least 24 characters, e.g. `openssl rand -hex 32`). The token is compared in constant time. When the env var is not set, bearer requests get `403 Token uploads are disabled`. Token uploads use `SUPABASE_SERVICE_ROLE_KEY` on the server.

Small files (Vercel limits request bodies to about 4.5 MB):

```bash
curl -X POST https://dry-home-office.vercel.app/api/survey-reports \
  -H "Authorization: Bearer $SURVEY_REPORTS_UPLOAD_TOKEN" \
  -F job_number=JOB-1006 \
  -F title="Damp survey report" \
  -F file=@report.pdf
```

Send `job_id` (uuid) or `job_number`, `file` (PDF), and an optional `title` (it defaults to the file name). The response is `201 { report: {...} }`.

Bigger files (up to 25 MB) use two JSON calls with a signed upload URL:

```bash
# 1. get an upload URL
curl -X POST .../api/survey-reports -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"create-upload","job_number":"JOB-1006","file_name":"report.pdf"}'
# 2. PUT the file to the returned signed_url
curl -X PUT "<signed_url>" -H "Content-Type: application/pdf" --data-binary @report.pdf
# 3. save it
curl -X POST .../api/survey-reports -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"complete","job_number":"JOB-1006","path":"<path>","file_name":"report.pdf","title":"Damp survey report"}'
```
