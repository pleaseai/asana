# Asana CLI Documentation

Docus-based documentation site for Asana CLI with English and Korean support.

## Features

- ✨ **Docus Framework** - Built with Nuxt 4 + Nuxt Content + Nuxt UI
- 🌍 **Multilingual** - Full English and Korean (ko) support via @nuxtjs/i18n
- 📱 **Responsive** - Beautiful design on all devices
- 🔍 **Full-text Search** - Built-in search functionality
- 🎨 **Customizable** - Easy theming with Nuxt App Config
- 📝 **MDC Syntax** - Enhanced Markdown with Vue components

## Structure

```
docs/
├── content/
│   ├── index.md          # Root landing page (language selector)
│   ├── en/               # English documentation
│   │   ├── index.md      # English home page
│   │   ├── 1.guide/      # Getting Started guides
│   │   └── 2.features/   # Feature documentation
│   └── ko/               # Korean documentation (한국어)
│       ├── index.md      # Korean home page
│       ├── 1.guide/      # 시작 가이드
│       └── 2.features/   # 기능 문서
├── public/               # Static assets
├── nuxt.config.ts        # Nuxt configuration with i18n
└── package.json
```

## Development

### Install Dependencies

```bash
bun install
```

### Start Development Server

```bash
bun run dev
```

The site will be available at `http://localhost:3000`

- English: `http://localhost:3000/en`
- Korean: `http://localhost:3000/ko`

### Build for Production

```bash
bun run build
```

### Generate Static Site

```bash
bun run generate
```

### Preview Production Build

```bash
bun run preview
```

## Adding Content

### English Content

Add or edit files in `content/en/`:

```bash
# Example: Add new guide
touch content/en/1.guide/3.advanced-usage.md
```

### Korean Content

Add or edit files in `content/ko/`:

```bash
# Example: Add new guide
touch content/ko/1.guide/3.advanced-usage.md
```

### Frontmatter

Each page should include frontmatter:

```yaml
---
title: Page Title
description: Page description for SEO
---
```

## Multilingual Support

The site uses `@nuxtjs/i18n` with `prefix` strategy:

- **English**: `/en/*` (default locale)
- **Korean**: `/ko/*`

Browser language detection is enabled with cookie persistence.

## Customization

### App Config

Edit theme colors, social links, and more in `nuxt.config.ts` or create `app.config.ts`.

### Navigation

Navigation is auto-generated from the content structure. Use numbered prefixes (e.g., `1.guide`, `2.features`) to control order.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set build command: `bun run build`
3. Set output directory: `.output/public`

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `bun run generate`
3. Set publish directory: `.output/public`

### GitHub Pages

```bash
bun run generate
# Deploy .output/public directory
```

## Learn More

- [Docus Documentation](https://docus.dev)
- [Nuxt Documentation](https://nuxt.com)
- [Nuxt Content](https://content.nuxt.com)
- [Nuxt UI](https://ui.nuxt.com)
- [@nuxtjs/i18n](https://i18n.nuxtjs.org)

## Author

이민수 (Minsu Lee)

- GitHub: [@amondnet](https://github.com/amondnet)

## License

Private
