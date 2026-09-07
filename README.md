# SHIORIcafe

A cozy, Japanese-inspired study cafe website featuring table ordering, nook reservations, and an AI study companion.

## Local XAMPP

Run Apache and MySQL in XAMPP, then open:

`http://localhost/SHIORIcafe/`

The local site uses the PHP endpoints in `api/*.php` and your local MySQL database.

## Vercel Deployment

The repository also includes Vercel-compatible Node.js serverless endpoints in `api/*.js`.
Vercel cannot access the local XAMPP database, so create an online MySQL-compatible database and run `api/schema.sql` there first.

In the Vercel project settings, add these environment variables:

```text
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.6-flash
DATABASE_URL=mysql://username:password@host:3306/shiori_cafe
DATABASE_SSL=true
```

Import the GitHub repository into Vercel with the framework set to **Other**. The frontend automatically uses PHP endpoints on localhost and Vercel serverless endpoints after deployment.
