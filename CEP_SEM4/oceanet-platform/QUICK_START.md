# 🚀 Nerexis Quick Start Guide

## Installation (< 2 minutes)

```bash
cd nerexis-platform
npm install
npm run dev
```

Visit: `http://localhost:3000`

---

## 📄 What's Included

| Item | Location | Status |
|------|----------|--------|
| **Landing Page** | `/` | ✅ Live |
| **Dashboard** | `/dashboard` | ✅ Live |
| **Data Manager** | `/data-manager` | ✅ Live |
| **AI Analytics** | `/analytics` | ✅ Live |
| **Reports** | `/reports` | ✅ Live |
| **AI Assistant** | `/ai-assistant` | ✅ Live |
| **API Hub** | `/api-hub` | ✅ Live |

---

## 🎨 Customization

### Change Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  cyan: '#YOUR_COLOR',
  teal: '#YOUR_COLOR',
  // ...
}
```

### Add New Page
1. Create folder: `src/app/new-page/`
2. Create file: `page.tsx`
3. Add route to navbar: `src/components/Navbar.tsx`

### Modify Animations
Edit `src/globals.css` or `tailwind.config.js`

---

## 🔗 Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing page |
| `src/components/Navbar.tsx` | Navigation |
| `tailwind.config.js` | Styling config |
| `src/globals.css` | Global styles |
| `package.json` | Dependencies |

---

## 📚 Documentation

- **README.md** - Full project guide
- **DEPLOYMENT.md** - Deploy to production
- **INTEGRATION.md** - Add APIs, databases, auth
- **PROJECT_SUMMARY.md** - What was built

---

## 🛠 Common Tasks

### Add a Component
```typescript
// src/components/MyComponent.tsx
'use client';

export default function MyComponent() {
  return <div className="glass rounded-lg p-6">Your content</div>;
}
```

### Import in Page
```typescript
import MyComponent from '@/components/MyComponent';

export default function Page() {
  return <MyComponent />;
}
```

### Use Animation
```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
>
  Content
</motion.div>
```

### Add Icon
```typescript
import { Zap, Database, Settings } from 'lucide-react';

<Zap size={24} className="text-cyan" />
```

### Create Card
```typescript
import { GlassCard } from '@/components/Cards';

<GlassCard>
  Your content here
</GlassCard>
```

---

## 🚀 Deploy

### Vercel (Easiest)
```bash
npm i -g vercel
vercel deploy
```

### Docker
```bash
docker build -t nerexis .
docker run -p 3000:3000 nerexis
```

See **DEPLOYMENT.md** for more options.

---

## 🔌 Add Backend

### Option 1: API Routes
```typescript
// src/app/api/hello/route.ts
export async function GET() {
  return Response.json({ message: 'Hello' });
}
```

### Option 2: External API
```typescript
// src/services/api.ts
export async function fetchData() {
  const res = await fetch('https://your-api.com/data', {
    headers: { 'Authorization': `Bearer ${process.env.API_KEY}` },
  });
  return res.json();
}
```

See **INTEGRATION.md** for complete setup guides.

---

## 📦 Add Dependency

```bash
npm install package-name
npm run dev  # Restart dev server
```

---

## 🐛 Troubleshooting

### Build Error
```bash
rm -rf .next node_modules
npm install
npm run build
```

### Port Already in Use
```bash
npm run dev -- -p 3001
```

### TypeScript Error
Ensure `src/` folder exists and files have `.tsx` extension.

---

## 📱 Test Responsiveness

Open DevTools (F12):
- Chrome: Toggle device toolbar (Ctrl+Shift+M)
- Firefox: Responsive Design Mode (Ctrl+Shift+M)
- Safari: Develop → Enter Responsive Design Mode

Test breakpoints:
- Mobile: 375px
- Tablet: 768px
- Desktop: 1024px+

---

## ✨ Features Showcase

### Floating Particles
```typescript
import { FloatingParticles } from '@/components/Animations';

<FloatingParticles count={30} />
```

### Status Badges
```typescript
import { Badge } from '@/components/Cards';

<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>
```

### Loading Skeleton
```typescript
import { LoadingSkeleton } from '@/components/Cards';

<LoadingSkeleton />
```

---

## 📊 Data Binding

### Static Data
```typescript
const data = [
  { name: 'Item 1', value: 100 },
  { name: 'Item 2', value: 200 },
];

{data.map((item) => <div key={item.name}>{item.value}</div>)}
```

### Dynamic Data
```typescript
'use client';
import { useState } from 'react';

export default function Page() {
  const [data, setData] = useState([]);
  // Fetch and update data
}
```

---

## 🎨 Tailwind Classes Reference

```
# Spacing
p-6 = padding 24px
m-4 = margin 16px
gap-3 = gap 12px

# Colors
bg-cyan = background cyan
text-white = white text
border-white border-opacity-10 = subtle border

# Responsive
md: = medium (768px+)
lg: = large (1024px+)
flex-col md:flex-row = stack on mobile, row on desktop

# Utilities
rounded-lg = border radius
shadow-glow = custom glow shadow
glass = glassmorphism
btn-primary = primary button style
```

---

## 🔐 Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_KEY=test_key
```

Access in code:
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

---

## 📞 Help & Resources

- **Next.js**: https://nextjs.org/docs
- **Tailwind**: https://tailwindcss.com/docs
- **Framer Motion**: https://www.framer.com/motion/
- **Recharts**: https://recharts.org/

---

## ✅ Production Checklist

- [ ] Change API endpoints to production
- [ ] Update environment variables
- [ ] Remove console.log statements
- [ ] Test all pages
- [ ] Check mobile responsiveness
- [ ] Setup analytics
- [ ] Enable HTTPS
- [ ] Setup monitoring
- [ ] Configure backups
- [ ] Deploy!

---

**Ready to build? Let's go! 🚀**

For questions, see the full documentation in README.md, DEPLOYMENT.md, or INTEGRATION.md.
