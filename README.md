Professional tool to convert compressed archives (ZIP) into a single, well-formatted text file containing all your source code.

## 🚀 Features

- **3 Operation Modes**: Bundle ZIP, Reverse (TXT to ZIP), GitHub Import
- **AI Templates**: Optimized for Claude, ChatGPT, and Gemini
- **Premium Plans**: Unlimited conversions with MercadoPago integration
- **API Access**: REST API for developers
- **Smart Filtering**: Automatically ignores node_modules, .git, etc.

## 📋 Requirements

- Node.js 18+
- Firebase project
- MercadoPago account (for payments)

## 🛠️ Setup

1. Clone repository:
```bash
git clone https://github.com/davidmaciasgonzalez/code-bundler-pro.git
cd code-bundler-pro
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (see `.env.example`):
```bash
cp .env.example .env.local
```

4. Fill in your credentials in `.env.local`:
- Firebase Service Account JSON
- MercadoPago Access Token
- MercadoPago Plan IDs
- Webhook secret

5. Run development server:
```bash
npm run dev
```

## 🌐 Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## 📝 Environment Variables

See `.env.example` for complete list of required variables.

## 🔐 Security Notes

- Restrict Firebase API key to your domain in Firebase Console
- Premium codes are validated server-side via /api/validate-code
- Webhook secret prevents unauthorized webhook calls
- TODO: Implement HMAC validation for MercadoPago webhooks

## 📧 Support

For issues or questions: davidmaciasdev@gmail.com

## 📄 License

MIT License
