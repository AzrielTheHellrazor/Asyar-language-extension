# Asyar Polyglot Sözlük & Almanca Öğrenim Eklentisi (`org.asyar.polyglot-dict`) — Tasarım Dokümanı

**Tarih:** 2026-10-22
**Hedef Platform:** Asyar (`asyarSdk: "^4.15.0"`, Tier-2 Sandboxed Iframe Extension)
**Kurulum Dizini:** `/Users/goktus/Library/Application Support/org.asyar.app/extensions/org.asyar.polyglot-dict`
**Kaynak Kod Dizini:** `/Users/goktus/asyar-polyglot-dict`

---

## 1. Amaç ve Kapsam

Kullanıcının Asyar üzerinden tek bir arama çubuğuyla:
1. **Üç Dilli Akıllı Çeviri (`TR ↔ EN ↔ DE`):** Girilen kelime veya cümlenin dilini otomatik algılayarak aynı anda **Almanca (DE)**, **İngilizce (EN)** ve **Türkçe (TR)** karşılıklarını görmesini sağlamak.
2. **Almanca Öğrenim & Gramer Sözlüğü:**
   - **İsimler (Nomen) için:** Renk kodlu artikel rozeti (`der` mavi, `die` kırmızı/pembe, `das` yeşil), tekil ve çoğul halleri (`das Buch · die Bücher`).
   - **Fiiller (Verben) için:** `Präsens (er/sie/es)`, `Präteritum` ve `Perfekt (hat/ist + Partizip II)` çekim tablosu.
   - **CEFR Seviye & Kelime Türü:** `Nomen`, `Verb`, `Adjektiv`, `Adverb` etiketi ve varsa `A1–C2` seviye göstergesi.
3. **Artikel Vurgulu Örnek Cümleler (Beispielsätze & Examples):**
   - Kelimenin ve özellikle **Almanca artikelinin (`der/die/das/den/dem/des/ein/eine`)** cümle içinde nasıl kullanıldığını gösteren **Almanca örnek cümle + Türkçe çevirisi** ve **İngilizce örnek cümle + Türkçe çevirisi**.
   - Almanca örnek cümlelerde hedef kelime ve önündeki artikel renk kodlu olarak vurgulanır (highlight), böylece görsel hafıza ile artikel ve bağlam birlikte öğrenilir.
4. **Kelime Defteri (`VocabView`) ve Flashcard Tekrarı (`FlashcardView`):**
   - Tek tuşla (`⌘S` veya kaydet butonu) kelimeyi; üç dildeki anlamı, artikeli, çoğul/fiil çekimi ve **örnek cümlesiyle birlikte** Kelime Defteri'ne kaydetme.
   - Kaydedilen kelimeleri filtreleme (`Tümü`, `der`, `die`, `das`, `Fiiller`, `İngilizce`) ve Flashcard modunda örnek cümle eşliğinde pratik yapma.

---

## 2. Mimari ve Veri Akışı

### 2.1. Hibrit Sözlük & Çeviri Motoru (`src/engine/`)
API anahtarı gerektirmeden anında çalışan çok katmanlı yapı + opsiyonel AI zenginleştirmesi:

1. **Katman 1 — Üç Dilli Çeviri & Google Zengin Sözlük (`translate.googleapis.com/translate_a/single`):**
   - Kullanıcının girdisi (`query`) için paralel olarak `DE`, `EN` ve `TR` hedeflerine `dt=t&dt=bd&dt=ex&dt=ss&dt=md&dt=rm` parametreleriyle istek atılır.
   - Kaynak dil otomatik algılanır (`detectedFrom`).
   - Kelime türleri (`pos`: noun, verb, adjective), eş anlamlılar (`synonyms`), alternatif çeviriler ve Google örnek cümleleri (`examples`) çıkarılır.

2. **Katman 2 — Almanca Wiktionary Gramer & Örnek Cümle Çıkarıcı (`de.wiktionary.org/w/api.php`):**
   - Almanca hedef kelime (veya girdinin Almanca karşılığı) için MediaWiki API (`action=parse&prop=wikitext&format=json`) sorgulanır.
   - Wikitext şablonlarından deterministik parser ile şunlar ayrıştırılır:
     - **Genus (Artikel):** `{{Deutsch Substantiv Übersicht}}` içindeki `Genus=m/f/n` -> `der` (maskulin), `die` (feminin), `das` (neutral).
     - **Tekil & Çoğul:** `Nominativ Singular` ve `Nominativ Plural` (`die ...`).
     - **Fiil Çekimleri:** `{{Deutsch Verb Übersicht}}` içindeki `Präsens_er, sie, es`, `Präteritum_ich`, `Partizip II` ve `Hilfsverb` (`haben` / `sein` -> `hat` / `ist`).
     - **Fonetik (IPA):** `{{Lautschrift|...}}`.
     - **Örnek Cümleler (`{{Beispiele}}`):** Gerçek Almanca örnek cümleler temizlenir; ardından Türkçe çevirileri paralel Google Translate çağrısıyla otomatik eklenir.
   - **Yedek (Fallback) Artikel & Örnek Cümle Üretici:** Eğer Wiktionary'de örnek cümle bulunamazsa veya kelime çekimli girildiyse, Almanca karşılığın başındaki artikel/kelime yapısı çözümlenir ve kelimenin artikelini/anlamını içeren doğal bir Almanca + İngilizce örnek cümle (Türkçe çevirisiyle) şablon/çeviri hattından üretilir; kullanıcı hiçbir zaman örnek cümlesiz kalmaz.

3. **Katman 3 — İngilizce Sözlük & Örnek Cümle (`api.dictionaryapi.dev`):**
   - İngilizce kelime için fonetik (IPA), İngilizce tanım ve doğal İngilizce örnek cümle çekilir, Türkçe çevirisiyle eşleştirilir.

4. **Katman 4 — Opsiyonel AI Zenginleştirici (Gemini / OpenAI API Key):**
   - Kullanıcı eklenti ayarlarına (`preferences`) `aiApiKey` (`password` tipinde) girdiyse, arka planda CEFR seviyesi (`A1–C2`), gramer ipucu (örn. hangi edatla/kasus ile kullanıldığı: *auf + Akkusativ*) ve ek günlük konuşma örnek cümleleri üretilir.

---

## 3. Komutlar, Görünümler ve Aksiyonlar

### 3.1. `manifest.json` Yapısı
- **ID:** `org.asyar.polyglot-dict`
- **İzinler (`permissions`):** `network`, `storage:read`, `storage:write`, `cache:read`, `cache:write`, `clipboard:read`, `clipboard:write`, `selection:read`, `notifications:send`, `tools:register`, `extension:invoke`
- **Komutlar (`commands`):**
  1. `lookup` (**Polyglot Sözlük & Çeviri** — `mode: "view"`, `component: "PolyglotView"`):
     - Üç dilli çeviri, renkli `der/die/das` gramer kartı, fiil çekimleri, **artikel vurgulu örnek cümleler**, eş anlamlılar.
     - Arama çubuğu aksesuarı (`searchBarAccessory`): Odak modu (`Tümü: TR+EN+DE`, `Almanca Odaklı`, `İngilizce Odaklı`).
  2. `vocab` (**Kelime Defterim** — `mode: "view"`, `component: "VocabView"`):
     - Kaydedilen kelimeleri artikel rengi, çoğul hali, 3 dildeki karşılığı ve örnek cümlesiyle listeler.
     - Filtreleme (`Tümü`, `der (Maskulin)`, `die (Feminin)`, `das (Neutral)`, `Fiiller`, `Favoriler`).
  3. `flashcards` (**Kelime Tekrarı (Flashcards)** — `mode: "view"`, `component: "FlashcardView"`):
     - Kaydedilen kelimeler üzerinde interaktif kart çevirme (`Space`/`Enter`), örnek cümlede boşluk/ipucu gösterme, `Öğrendim` / `Tekrar Et` ilerleme takibi.

### 3.2. Klavye Kısayolları ve Aksiyonlar (`actions`)
- `Kaydet / Kelime Defterine Ekle` (`act_org.asyar.polyglot-dict_save-word`)
- `Almanca Kopyala` (`act_org.asyar.polyglot-dict_copy-de`)
- `İngilizce Kopyala` (`act_org.asyar.polyglot-dict_copy-en`)
- `Türkçe Kopyala` (`act_org.asyar.polyglot-dict_copy-tr`)
- `Örnek Cümleyi Kopyala` (`act_org.asyar.polyglot-dict_copy-example`)
- `Kelime Defterini Aç` (`act_org.asyar.polyglot-dict_open-vocab`)
- `Flashcard Pratiği Başlat` (`act_org.asyar.polyglot-dict_open-flashcards`)

---

## 4. Görsel Tasarım ve Artikel Renk Kodlaması

Asyar'ın yerleşik tasarım değişkenleri (`--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--separator`, `--radius-md`) ile tam uyumlu çalışır ve Almanca artikeller için özel görsel kodlama kullanır:
- **`der` (Maskulin / Eril):** Mavi rozet ve vurgu (`#3b82f6` / `rgba(59, 130, 246, 0.18)`)
- **`die` (Feminin / Dişil):** Kırmızı-Pembe rozet ve vurgu (`#ec4899` / `rgba(236, 72, 153, 0.18)`)
- **`das` (Neutral / Nötr):** Yeşil-Zümrüt rozet ve vurgu (`#10b981` / `rgba(16, 185, 129, 0.18)`)
- **Örnek Cümle İçinde Vurgu:** Almanca örnek cümlede geçen artikel + isim (örn. *"Ich lese **das Buch** jeden Abend."*) kelimenin artikel rengiyle altı çizili ve kalın olarak vurgulanır; hemen altında Türkçe ve İngilizce çevirisi yer alır.

---

## 5. Hata Yönetimi ve Test Stratejisi

- **Önbellekleme (`cache`):** Sorgulanan her kelime 24 saat boyunca `cache` servisinde saklanır; aynı kelime tekrar yazıldığında 0ms gecikmeyle açılır.
- **Kısmi Hata Dayanıklılığı (Graceful Degradation):** `Promise.allSettled` kullanılır; Wiktionary veya DictionaryAPI zaman aşımına uğrasa bile Google Translate + Sözlük verisi ve otomatik örnek cümle çevirisi anında ekrana basılır.
- **Testler:**
  - Wiktionary wikitext parser birim testleri (isimlerde `der/die/das` + çoğul, fiillerde `Präsens/Präteritum/Perfekt`, örnek cümle temizleme ve artikel vurgulama).
  - Üç dilli çeviri ve örnek cümle üretimi entegrasyon testleri.
  - Asyar eklenti dizinine (`/Users/goktus/Library/Application Support/org.asyar.app/extensions/org.asyar.polyglot-dict`) derleme ve manifest doğrulaması.
