# NEXUS Trading Terminal

## Kurulum ve Deploy (10 dakika)

### Yöntem 1: Railway.app (Önerilen — Ücretsiz)

1. **railway.app** adresine git, GitHub ile giriş yap
2. **"New Project"** → **"Deploy from GitHub repo"** tıkla
3. Bu klasörü GitHub'a yükle (veya "Deploy from local" seç)
4. Deploy tamamlandıktan sonra **Settings** → **Variables** sekmesine git
5. Şu değişkeni ekle:
   ```
   ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxx
   ```
6. Uygulama otomatik yeniden başlar, URL'ini kopyala — hazır!

### Yöntem 2: Render.com (Alternatif — Ücretsiz)

1. **render.com** → New → Web Service
2. Bu klasörü yükle
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Environment Variables: `ANTHROPIC_API_KEY = sk-ant-...`

### Yöntem 3: Lokal Çalıştırma

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-xxx node server.js
# Aç: http://localhost:3000
```

---

## Veri Kaynakları

| Piyasa | Kaynak | Gecikme |
|--------|--------|---------|
| Kripto (30 coin) | Binance API | Gerçek Zamanlı |
| US Hisse (80 hisse) | Yahoo Finance | 15 dakika |
| BIST (50 hisse) | Yahoo Finance .IS | 15 dakika |
| Emtia (15 varlık) | Yahoo Finance Futures | 15 dakika |

## Özellikler

- **TradingView Lightweight Charts** — Zoom, pan, crosshair
- Zaman dilimleri: 5D, 15D, 1S, 4S, 1G, 1H
- Göstergeler: EMA 20/50, Bollinger Bantları, Destek/Direnç
- Alt grafikler: RSI, MACD, Hacim
- **AI Analiz** — Claude Sonnet ile konfluence bazlı AL/SAT/BEKLE
- Otomatik 30 saniyede bir fiyat güncelleme
