module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```
- Click **"Commit changes"**

### File 2: `.gitignore`
- Click **"Add file"** → **"Create new file"**
- Name: `.gitignore`
- Paste:
```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
