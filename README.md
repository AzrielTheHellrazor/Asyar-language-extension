# 🇩🇪🇬🇧🇹🇷 Asyar Polyglot Sözlük & Almanca Öğrenim Eklentisi (`org.asyar.polyglot-dict`)

Asyar başlatıcısı için geliştirilmiş; **Almanca öğrenimi (Artikel, çoğul, fiil çekimi ve örnek cümleler)** ile **İngilizce/Türkçe üç dilli sözlük** ihtiyaçlarını tek ekranda birleştiren eklenti.

## ✨ Özellikler

- **Üç Dilli Akıllı Çeviri (`DE ↔ EN ↔ TR`):** Ne yazarsan yaz dilini otomatik algılar ve aynı anda **Almanca**, **İngilizce** ve **Türkçe** karşılıklarını gösterir.
- **Renk Kodlu Almanca Gramer Kartı:**
  - **İsimler (Nomen):** Renk kodlu artikel rozeti (**`der`** Mavi, **`die`** Kırmızı/Pembe, **`das`** Yeşil), tekil ve çoğul halleri (`das Buch · die Bücher`), Genitiv ve CEFR seviyesi (`A1–C2`).
  - **Fiiller (Verben):** `Präsens (du / er,sie,es)`, `Präteritum` ve `Perfekt (hat/ist + Partizip II)` çekim tablosu.
- **Artikel Vurgulu Örnek Cümleler (Beispielsätze & Examples):**
  - Hem Almanca hem İngilizce gerçek örnek cümleler ve **Türkçe çevirileri**.
  - Almanca cümlelerin içinde geçen artikeller (`der/die/das/den/dem/ein/eine`) ve hedef kelimeler artikel rengiyle vurgulanır.
- **Kelime Defteri (`VocabView`) & Flashcard Tekrarı (`FlashcardView`):**
  - Öğrendiğin kelimeleri örnek cümleleri ve artikelleriyle birlikte tek tuşla kaydet.
  - `der`, `die`, `das`, `Fiiller`, `Favoriler` filtreleriyle incele ve **Cümle İçinde Artikel Tahmini** veya **Kelime Kartı** modlarında pratik yap.

## 🛠️ Geliştirme & Kurulum

```bash
npm install --ignore-scripts
npm test
npm run build
```

Derlenen dosyalar `dist/` klasörüne çıkar ve Asyar eklenti dizinine (`~/Library/Application Support/org.asyar.app/extensions/org.asyar.polyglot-dict`) kopyalanarak doğrudan çalıştırılır.
