# Kaeo Production Deployment & Google OAuth Setup Guide

This document contains step-by-step instructions to configure Google OAuth via Supabase and deploy the Kaeo web application to Vercel.

---

## 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services** → **OAuth consent screen**:
   - Select **External** (unless you only want users from your Google Workspace organization).
   - Fill in the required application information.
   - Add the `.../auth/userinfo.profile` and `.../auth/userinfo.email` scopes.
4. Navigate to **APIs & Services** → **Credentials**:
   - Click **+ Create Credentials** and select **OAuth client ID**.
   - **Application type**: `Web application`.
   - **Name**: `Kaeo Production Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `https://YOUR-VERCEL-DOMAIN.vercel.app` (e.g. `https://kaeo.vercel.app`)
     - `https://YOUR-CUSTOM-DOMAIN` (if utilizing a custom domain)
   - **Authorized redirect URIs**:
     - Paste the Supabase Google callback URL (e.g. `https://<supabase-project-id>.supabase.co/auth/v1/callback`). You can copy this exact URL from your Supabase Dashboard in **Auth** → **Providers** → **Google**.
5. Save and copy the generated **Client ID** and **Client Secret**.

---

## 2. Supabase Dashboard Settings

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Auth** → **Providers** → **Google**:
   - Enable the Google provider.
   - Paste the **Client ID** copied from the Google Cloud Console.
   - Paste the **Client Secret** copied from the Google Cloud Console.
   - Save the changes.
3. Go to **Auth** → **URL Configuration**:
   - **Site URL**: `https://YOUR-PRODUCTION-DOMAIN` (e.g. `https://kaeo.vercel.app` or your custom domain)
   - **Additional Redirect URLs**:
     - `http://localhost:5173/**`
     - `https://YOUR-VERCEL-DOMAIN.vercel.app/**`
     - `https://YOUR-CUSTOM-DOMAIN/**`
     - `https://*.vercel.app/**` (highly recommended for preview branches)
   - Save the configurations.

---

## 3. Vercel CLI Deployment Steps

Follow these steps to deploy your Vite SPA to Vercel:

1. **Install Vercel CLI** (if you don't have it installed):
   ```bash
   npm i -g vercel
   ```

2. **Authenticate with Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy Preview Version**:
   Run the following command from the root directory of your project and follow the interactive prompts to link/configure the project:
   ```bash
   vercel
   ```

4. **Add Environment Variables**:
   In your Vercel Project Dashboard, navigate to **Settings** → **Environment Variables** and add the following keys:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (Note: These are safe, public client keys required by Vite at build time, do not share your Service Role keys!)

5. **Deploy to Production**:
   Deploy the finalized build with correct environment variables active:
   ```bash
   vercel --prod
   ```
