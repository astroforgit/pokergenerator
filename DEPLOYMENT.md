# GitHub Pages Deployment Guide

## Quick Start (3 Steps)

### 1. Push to GitHub

```bash
# If you haven't set up a remote yet:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push all commits
git push -u origin master
```

### 2. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under **Source**, select: **GitHub Actions**
5. Click **Save**

### 3. Wait for Deployment

- GitHub Actions will automatically build and deploy
- Check progress: **Actions** tab in your repository
- Takes ~1-2 minutes
- Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## Automatic Deployment

Every time you push to `master` or `main` branch:
1. GitHub Actions runs automatically
2. Builds the Vite project (`npm run build`)
3. Deploys to GitHub Pages
4. Your site updates in ~1-2 minutes

## Manual Deployment Trigger

You can also trigger deployment manually:
1. Go to **Actions** tab
2. Click **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## Verify Deployment

After deployment completes:
1. Visit: `https://YOUR_USERNAME.github.io/YOUR_REPO/`
2. Click "Load Data" button
3. Test image editing
4. Test text editing
5. Download modified ATR

## Troubleshooting

### Build Fails
- Check **Actions** tab for error logs
- Ensure `vite-editor/package.json` is committed
- Ensure `vite-editor/package-lock.json` is committed

### 404 Error
- Verify GitHub Pages is enabled (Settings → Pages)
- Verify Source is set to "GitHub Actions"
- Check deployment status in Actions tab
- Wait a few minutes after first deployment

### Blank Page
- Check browser console for errors
- Verify `vite.config.js` has `base: './'`
- Clear browser cache and reload

## Local Testing

Before pushing, test the build locally:

```bash
cd vite-editor
npm run build
npm run preview
```

Open http://localhost:4173 to test the production build.

## Custom Domain (Optional)

To use a custom domain:
1. Add a `CNAME` file to `vite-editor/public/` with your domain
2. Configure DNS settings with your domain provider
3. Enable HTTPS in GitHub Pages settings

## Build Information

- **Build time**: ~1 second
- **Bundle size**: 323.78 KB (87.49 KB gzipped)
- **Files**:
  - `index.html` (9.31 KB)
  - `assets/index.css` (2.10 KB)
  - `assets/index.js` (323.78 KB)

## What Gets Deployed

Only the `vite-editor/dist/` folder is deployed:
- ✅ Compiled JavaScript bundle
- ✅ Compiled CSS
- ✅ HTML file
- ✅ Embedded ATR data (in JS bundle)
- ❌ Source files (not deployed)
- ❌ node_modules (not deployed)

## Updating the Site

1. Make changes to code
2. Test locally: `npm run dev`
3. Commit changes: `git commit -am "Your message"`
4. Push: `git push`
5. GitHub Actions deploys automatically

---

**That's it! Your Atari Strip Poker Editor is now live! 🚀**

