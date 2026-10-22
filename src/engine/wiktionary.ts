import type {
  ArticleGender,
  CefrLevel,
  GermanGrammarInfo,
  GermanNounGrammar,
  GermanVerbConjugation,
  HighlightSegment,
  NetworkLike,
} from "../types";

const GENDER_LABELS: Record<ArticleGender, GermanNounGrammar["genderLabel"]> = {
  der: "Maskulin (Eril)",
  die: "Feminin (Dişil)",
  das: "Neutral (Nötr)",
};

const ARTICLE_INFERRED_GENDER: Record<string, ArticleGender> = {
  der: "der",
  die: "die",
  das: "das",
  den: "der",
  dem: "der",
  des: "der",
  ein: "der",
  eine: "die",
  einen: "der",
  einem: "der",
  einer: "die",
  eines: "der",
  kein: "der",
  keine: "die",
  keinen: "der",
  keinem: "der",
  keiner: "die",
  keines: "der",
};

interface CuratedLexiconEntry {
  grammar: GermanGrammarInfo;
  examples: Array<{ de: string; tr: string; en: string }>;
}

function makeNounEntry(params: {
  word: string;
  article: ArticleGender;
  plural: string;
  genitive: string;
  cefrLevel: CefrLevel;
  ipa: string;
  grammarTip: string;
  synonyms: string[];
  examples: Array<{ de: string; tr: string; en: string }>;
}): CuratedLexiconEntry {
  return {
    grammar: {
      word: params.word,
      pos: "noun",
      cefrLevel: params.cefrLevel,
      ipa: params.ipa,
      noun: {
        article: params.article,
        genderLabel: GENDER_LABELS[params.article],
        singular: params.word,
        plural: params.plural.startsWith("die ") ? params.plural : `die ${params.plural}`,
        genitive: params.genitive,
      },
      grammarTip: params.grammarTip,
      synonyms: params.synonyms,
    },
    examples: params.examples,
  };
}

function makeVerbEntry(params: {
  infinitive: string;
  praesensIch: string;
  praesensDu: string;
  praesensErSieEs: string;
  praeteritumIch: string;
  auxiliary: "haben" | "sein";
  partizipII: string;
  separable?: boolean;
  cefrLevel: CefrLevel;
  ipa: string;
  grammarTip: string;
  synonyms: string[];
  examples: Array<{ de: string; tr: string; en: string }>;
}): CuratedLexiconEntry {
  const auxVerb = params.auxiliary === "sein" ? "ist" : "hat";
  return {
    grammar: {
      word: params.infinitive,
      pos: "verb",
      cefrLevel: params.cefrLevel,
      ipa: params.ipa,
      verb: {
        infinitive: params.infinitive,
        praesensIch: params.praesensIch,
        praesensDu: params.praesensDu,
        praesensErSieEs: params.praesensErSieEs,
        praeteritumIch: params.praeteritumIch,
        perfekt: `${auxVerb} ${params.partizipII}`,
        auxiliary: params.auxiliary,
        partizipII: params.partizipII,
        separable: params.separable ?? false,
      },
      grammarTip: params.grammarTip,
      synonyms: params.synonyms,
    },
    examples: params.examples,
  };
}

const CURATED_GERMAN_LEXICON: CuratedLexiconEntry[] = [
  // --- 50 High-Frequency German Nouns (A1 - B2) ---
  makeNounEntry({
    word: "Buch",
    article: "das",
    plural: "die Bücher",
    genitive: "des Buches",
    cefrLevel: "A1",
    ipa: "buːx",
    grammarTip: "Nötr (das) isimdir; çoğulda kök ünlüsü umlaut alır ve -er eklenir (das Buch -> die Bücher).",
    synonyms: ["Werk", "Band", "Lektüre"],
    examples: [
      {
        de: "Das Buch liegt auf dem Tisch.",
        tr: "Kitap masanın üzerinde duruyor.",
        en: "The book is lying on the table.",
      },
      {
        de: "Ich lese abends gern ein gutes Buch.",
        tr: "Akşamları iyi bir kitap okumayı severim.",
        en: "I like reading a good book in the evening.",
      },
    ],
  }),
  makeNounEntry({
    word: "Haus",
    article: "das",
    plural: "die Häuser",
    genitive: "des Hauses",
    cefrLevel: "A1",
    ipa: "haʊ̯s",
    grammarTip: "Nötr (das) isimdir; çoğulda 'au' -> 'äu' dönüşümü ve -er eki alır (die Häuser).",
    synonyms: ["Gebäude", "Heim", "Wohnhaus"],
    examples: [
      {
        de: "Das Haus hat einen großen Garten.",
        tr: "Evin büyük bir bahçesi var.",
        en: "The house has a big garden.",
      },
      {
        de: "Wir gehen jetzt nach Hause.",
        tr: "Şimdi eve gidiyoruz.",
        en: "We are going home now.",
      },
    ],
  }),
  makeNounEntry({
    word: "Tisch",
    article: "der",
    plural: "die Tische",
    genitive: "des Tisches",
    cefrLevel: "A1",
    ipa: "tɪʃ",
    grammarTip: "Eril (der) isimdir; çoğul formu -e ekiyle yapılır (der Tisch -> die Tische).",
    synonyms: ["Tafel", "Pult"],
    examples: [
      {
        de: "Der Tisch am Fenster ist noch frei.",
        tr: "Pencere kenarındaki masa hâlâ boş.",
        en: "The table by the window is still free.",
      },
      {
        de: "Bitte leg die Schlüssel auf den Tisch.",
        tr: "Lütfen anahtarları masanın üzerine koy.",
        en: "Please put the keys on the table.",
      },
    ],
  }),
  makeNounEntry({
    word: "Stuhl",
    article: "der",
    plural: "die Stühle",
    genitive: "des Stuhls",
    cefrLevel: "A1",
    ipa: "ʃtuːl",
    grammarTip: "Eril (der) isimdir; çoğulda umlaut ve -e alır (der Stuhl -> die Stühle).",
    synonyms: ["Sitz", "Sessel"],
    examples: [
      {
        de: "Dieser Stuhl ist sehr bequem.",
        tr: "Bu sandalye çok rahat.",
        en: "This chair is very comfortable.",
      },
      {
        de: "Wir brauchen noch zwei Stühle für die Gäste.",
        tr: "Misafirler için iki sandalyeye daha ihtiyacımız var.",
        en: "We need two more chairs for the guests.",
      },
    ],
  }),
  makeNounEntry({
    word: "Apfel",
    article: "der",
    plural: "die Äpfel",
    genitive: "des Apfels",
    cefrLevel: "A1",
    ipa: "ˈap͡fl̩",
    grammarTip: "Eril (der) isimdir; çoğulda sadece kök ünlüsü umlaut alır (der Apfel -> die Äpfel).",
    synonyms: ["Obst", "Frucht"],
    examples: [
      {
        de: "Der Apfel schmeckt frisch und süß.",
        tr: "Elma taze ve tatlı.",
        en: "The apple tastes fresh and sweet.",
      },
      {
        de: "Ich kaufe auf dem Markt rote Äpfel.",
        tr: "Pazardan kırmızı elmalar satın alıyorum.",
        en: "I buy red apples at the market.",
      },
    ],
  }),
  makeNounEntry({
    word: "Hund",
    article: "der",
    plural: "die Hunde",
    genitive: "des Hundes",
    cefrLevel: "A1",
    ipa: "hʊnt",
    grammarTip: "Eril (der) isimdir; çoğul formu -e eki alır (der Hund -> die Hunde).",
    synonyms: ["Vierbeiner", "Haustier"],
    examples: [
      {
        de: "Der Hund spielt fröhlich im Park.",
        tr: "Köpek parkta neşeyle oynuyor.",
        en: "The dog is playing happily in the park.",
      },
      {
        de: "Unser Nachbar geht jeden Morgen mit dem Hund spazieren.",
        tr: "Komşumuz her sabah köpekle yürüyüşe çıkıyor.",
        en: "Our neighbor walks the dog every morning.",
      },
    ],
  }),
  makeNounEntry({
    word: "Katze",
    article: "die",
    plural: "die Katzen",
    genitive: "der Katze",
    cefrLevel: "A1",
    ipa: "ˈkat͡sə",
    grammarTip: "Sonu -e ile biten çoğu isim gibi dişil (die) artikellidir; çoğulu -n alır (die Katzen).",
    synonyms: ["Stubentiger", "Mieze"],
    examples: [
      {
        de: "Die Katze schläft auf dem warmen Sofa.",
        tr: "Kedi sıcak koltuğun üzerinde uyuyor.",
        en: "The cat is sleeping on the warm sofa.",
      },
      {
        de: "Meine Schwester hat zwei kleine Katzen.",
        tr: "Kız kardeşimin iki küçük kedisi var.",
        en: "My sister has two small cats.",
      },
    ],
  }),
  makeNounEntry({
    word: "Auto",
    article: "das",
    plural: "die Autos",
    genitive: "des Autos",
    cefrLevel: "A1",
    ipa: "ˈaʊ̯to",
    grammarTip: "Yabancı kökenli ve -o ile biten isimler genellikle nötrdür (das Auto) ve çoğulda -s alır.",
    synonyms: ["Wagen", "Fahrzeug", "Pkw"],
    examples: [
      {
        de: "Das Auto steht vor der Garage.",
        tr: "Araba garajın önünde duruyor.",
        en: "The car is parked in front of the garage.",
      },
      {
        de: "Wir fahren mit dem Auto nach Berlin.",
        tr: "Berlin'e arabayla gidiyoruz.",
        en: "We are driving to Berlin by car.",
      },
    ],
  }),
  makeNounEntry({
    word: "Wasser",
    article: "das",
    plural: "die Wässer",
    genitive: "des Wassers",
    cefrLevel: "A1",
    ipa: "ˈvasɐ",
    grammarTip: "Nötr (das) isimdir; günlük kullanımda çoğunlukla tekil (das Wasser) olarak kullanılır.",
    synonyms: ["Trinkwasser", "Flüssigkeit"],
    examples: [
      {
        de: "Das Wasser im See ist heute sehr kalt.",
        tr: "Göldeki su bugün çok soğuk.",
        en: "The water in the lake is very cold today.",
      },
      {
        de: "Kann ich bitte ein Glas Wasser bekommen?",
        tr: "Lütfen bir bardak su alabilir miyim?",
        en: "Can I please have a glass of water?",
      },
    ],
  }),
  makeNounEntry({
    word: "Kaffee",
    article: "der",
    plural: "die Kaffees",
    genitive: "des Kaffees",
    cefrLevel: "A1",
    ipa: "ˈkafe",
    grammarTip: "Sıcak içeceklerden 'der Kaffee' ve 'der Tee' eril (der) artikellidir.",
    synonyms: ["Mokka", "Espresso"],
    examples: [
      {
        de: "Der Kaffee duftet wunderbar am Morgen.",
        tr: "Kahve sabahları harika kokuyor.",
        en: "The coffee smells wonderful in the morning.",
      },
      {
        de: "Ich trinke meinen Kaffee gerne ohne Zucker.",
        tr: "Kahvemi şekersiz içmeyi severim.",
        en: "I like drinking my coffee without sugar.",
      },
    ],
  }),
  makeNounEntry({
    word: "Schule",
    article: "die",
    plural: "die Schulen",
    genitive: "der Schule",
    cefrLevel: "A1",
    ipa: "ˈʃuːlə",
    grammarTip: "Sonu -e ile biten dişil (die) isimdir; çoğul formu -n ekiyle yapılır (die Schulen).",
    synonyms: ["Lehranstalt", "Bildungseinrichtung"],
    examples: [
      {
        de: "Die Schule beginnt jeden Tag um acht Uhr.",
        tr: "Okul her gün saat sekizde başlıyor.",
        en: "School starts every day at eight o'clock.",
      },
      {
        de: "Die Kinder gehen zu Fuß in die Schule.",
        tr: "Çocuklar okula yürüyerek gidiyor.",
        en: "The children walk to school.",
      },
    ],
  }),
  makeNounEntry({
    word: "Universität",
    article: "die",
    plural: "die Universitäten",
    genitive: "der Universität",
    cefrLevel: "A2",
    ipa: "univɛʁziˈtɛːt",
    grammarTip: "-tät sonekiyle biten tüm isimler istisnasız dişil (die) artikellidir.",
    synonyms: ["Hochschule", "Uni", "Akademie"],
    examples: [
      {
        de: "Die Universität liegt im Zentrum der Stadt.",
        tr: "Üniversite şehrin merkezinde yer alıyor.",
        en: "The university is located in the center of the city.",
      },
      {
        de: "Sie studiert Informatik an einer bekannten Universität.",
        tr: "Tanınmış bir üniversitede bilgisayar bilimi okuyor.",
        en: "She studies computer science at a well-known university.",
      },
    ],
  }),
  makeNounEntry({
    word: "Arbeit",
    article: "die",
    plural: "die Arbeiten",
    genitive: "der Arbeit",
    cefrLevel: "A1",
    ipa: "ˈaʁbaɪ̯t",
    grammarTip: "Dişil (die) isimdir; 'zur Arbeit gehen' (işe gitmek) kalıbıyla sıkça kullanılır.",
    synonyms: ["Beruf", "Tätigkeit", "Beschäftigung"],
    examples: [
      {
        de: "Die Arbeit macht mir großen Spaß.",
        tr: "İş bana büyük keyif veriyor.",
        en: "I really enjoy the work.",
      },
      {
        de: "Nach der Arbeit treffen wir uns im Café.",
        tr: "İşten sonra kafede buluşuyoruz.",
        en: "After work we meet at the café.",
      },
    ],
  }),
  makeNounEntry({
    word: "Zeit",
    article: "die",
    plural: "die Zeiten",
    genitive: "der Zeit",
    cefrLevel: "A1",
    ipa: "t͡saɪ̯t",
    grammarTip: "Dişil (die) isimdir; 'Zeit haben' (vakti olmak) ifadelerinde artikelsiz kullanılır.",
    synonyms: ["Dauer", "Zeitraum", "Epoche"],
    examples: [
      {
        de: "Die Zeit vergeht im Urlaub viel zu schnell.",
        tr: "Tatilde zaman çok hızlı geçiyor.",
        en: "Time passes far too quickly on vacation.",
      },
      {
        de: "Hast du heute Abend etwas Zeit für mich?",
        tr: "Bu akşam benim için biraz vaktin var mı?",
        en: "Do you have some time for me tonight?",
      },
    ],
  }),
  makeNounEntry({
    word: "Geld",
    article: "das",
    plural: "die Gelder",
    genitive: "des Geldes",
    cefrLevel: "A1",
    ipa: "ɡɛlt",
    grammarTip: "Nötr (das) isimdir; genellikle tekil kullanılır ('das Geld').",
    synonyms: ["Vermögen", "Bargeld", "Kapital"],
    examples: [
      {
        de: "Das Geld liegt in meiner Brieftasche.",
        tr: "Para cüzdanımda duruyor.",
        en: "The money is in my wallet.",
      },
      {
        de: "Wir sparen Geld für eine lange Reise.",
        tr: "Uzun bir seyahat için para biriktiriyoruz.",
        en: "We are saving money for a long trip.",
      },
    ],
  }),
  makeNounEntry({
    word: "Freund",
    article: "der",
    plural: "die Freunde",
    genitive: "des Freundes",
    cefrLevel: "A1",
    ipa: "fʁɔɪ̯nt",
    grammarTip: "'ein Freund von mir' bir arkadaşım, 'mein Freund' ise genellikle erkek arkadaşım anlamındadır.",
    synonyms: ["Kamerad", "Kumpel", "Vertrauter"],
    examples: [
      {
        de: "Ein guter Freund hilft immer in schwierigen Zeiten.",
        tr: "İyi bir dost zor zamanlarda her zaman yardım eder.",
        en: "A good friend always helps in difficult times.",
      },
      {
        de: "Am Wochenende besuche ich meine Freunde in München.",
        tr: "Hafta sonu Münih'teki arkadaşlarımı ziyaret ediyorum.",
        en: "On the weekend I am visiting my friends in Munich.",
      },
    ],
  }),
  makeNounEntry({
    word: "Stadt",
    article: "die",
    plural: "die Städte",
    genitive: "der Stadt",
    cefrLevel: "A1",
    ipa: "ʃtat",
    grammarTip: "Dişil (die) isimdir; çoğulda umlaut ve -e alır (die Stadt -> die Städte).",
    synonyms: ["Ort", "Metropole", "Gemeinde"],
    examples: [
      {
        de: "Die Stadt hat viele historische Gebäude.",
        tr: "Şehrin birçok tarihi binası var.",
        en: "The city has many historical buildings.",
      },
      {
        de: "Wir machen einen Spaziergang durch die alte Stadt.",
        tr: "Eski şehirde bir yürüyüş yapıyoruz.",
        en: "We are taking a walk through the old town.",
      },
    ],
  }),
  makeNounEntry({
    word: "Land",
    article: "das",
    plural: "die Länder",
    genitive: "des Landes",
    cefrLevel: "A1",
    ipa: "lant",
    grammarTip: "Nötr (das) isimdir; hem 'ülke' hem 'kırsal kesim (auf dem Land)' anlamına gelir.",
    synonyms: ["Staat", "Nation", "Gebiet"],
    examples: [
      {
        de: "Dieses Land ist bekannt für seine schöne Natur.",
        tr: "Bu ülke güzel doğasıyla tanınır.",
        en: "This country is known for its beautiful nature.",
      },
      {
        de: "Meine Großeltern leben ruhig auf dem Land.",
        tr: "Büyükanne ve büyükbabam kırsalda sakin bir şekilde yaşıyor.",
        en: "My grandparents live quietly in the countryside.",
      },
    ],
  }),
  makeNounEntry({
    word: "Sprache",
    article: "die",
    plural: "die Sprachen",
    genitive: "der Sprache",
    cefrLevel: "A1",
    ipa: "ˈʃpʁaːxə",
    grammarTip: "Sonu -e ile biten dişil (die) isimdir; çoğulu 'die Sprachen' şeklindedir.",
    synonyms: ["Idiom", "Zunge", "Ausdrucksweise"],
    examples: [
      {
        de: "Die deutsche Sprache hat drei grammatische Geschlechter.",
        tr: "Alman dilinin üç dilbilgisel cinsiyeti vardır.",
        en: "The German language has three grammatical genders.",
      },
      {
        de: "Er spricht fließend drei fremde Sprachen.",
        tr: "Akıcı bir şekilde üç yabancı dil konuşuyor.",
        en: "He speaks three foreign languages fluently.",
      },
    ],
  }),
  makeNounEntry({
    word: "Wort",
    article: "das",
    plural: "die Wörter",
    genitive: "des Wortes",
    cefrLevel: "A1",
    ipa: "vɔʁt",
    grammarTip: "Tek tek kelimeler için 'die Wörter', bağlantılı söz/ifade için 'die Worte' çoğulu kullanılır.",
    synonyms: ["Begriff", "Vokabel", "Ausdruck"],
    examples: [
      {
        de: "Ich kenne dieses deutsche Wort noch nicht.",
        tr: "Bu Almanca kelimeyi henüz bilmiyorum.",
        en: "I do not know this German word yet.",
      },
      {
        de: "Jeden Tag lerne ich zehn neue Wörter.",
        tr: "Her gün on yeni kelime öğreniyorum.",
        en: "Every day I learn ten new words.",
      },
    ],
  }),
  makeNounEntry({
    word: "Frage",
    article: "die",
    plural: "die Fragen",
    genitive: "der Frage",
    cefrLevel: "A1",
    ipa: "ˈfʁaːɡə",
    grammarTip: "'eine Frage stellen' (soru sormak) kalıbıyla kullanılır; artikeli dişildir (die).",
    synonyms: ["Erkundigung", "Problemstellung"],
    examples: [
      {
        de: "Das ist eine sehr gute Frage.",
        tr: "Bu çok iyi bir soru.",
        en: "That is a very good question.",
      },
      {
        de: "Darf ich Ihnen eine kurze Frage stellen?",
        tr: "Size kısa bir soru sorabilir miyim?",
        en: "May I ask you a quick question?",
      },
    ],
  }),
  makeNounEntry({
    word: "Antwort",
    article: "die",
    plural: "die Antworten",
    genitive: "der Antwort",
    cefrLevel: "A1",
    ipa: "ˈantvɔʁt",
    grammarTip: "'das Wort' nötr olmasına rağmen 'die Antwort' dişil (die) artikellidir!",
    synonyms: ["Erwiderung", "Reaktion", "Auskunft"],
    examples: [
      {
        de: "Ich warte noch auf eine Antwort von dir.",
        tr: "Hâlâ senden bir cevap bekliyorum.",
        en: "I am still waiting for an answer from you.",
      },
      {
        de: "Die richtige Antwort steht auf der nächsten Seite.",
        tr: "Doğru cevap bir sonraki sayfada yazıyor.",
        en: "The correct answer is on the next page.",
      },
    ],
  }),
  makeNounEntry({
    word: "Problem",
    article: "das",
    plural: "die Probleme",
    genitive: "des Problems",
    cefrLevel: "A1",
    ipa: "pʁoˈbleːm",
    grammarTip: "Yunanca kökenli nötr (das) isimdir; çoğulu 'die Probleme' şeklindedir.",
    synonyms: ["Schwierigkeit", "Herausforderung", "Konflikt"],
    examples: [
      {
        de: "Das Problem lässt sich schnell lösen.",
        tr: "Sorun hızlıca çözülebilir.",
        en: "The problem can be solved quickly.",
      },
      {
        de: "Kein Problem, ich helfe dir gerne!",
        tr: "Sorun değil, sana memnuniyetle yardım ederim!",
        en: "No problem, I am happy to help you!",
      },
    ],
  }),
  makeNounEntry({
    word: "Lösung",
    article: "die",
    plural: "die Lösungen",
    genitive: "der Lösung",
    cefrLevel: "A2",
    ipa: "ˈløːzʊŋ",
    grammarTip: "-ung sonekiyle biten tüm Almanca isimler istisnasız dişil (die) artikellidir.",
    synonyms: ["Antwort", "Ausweg", "Ergebnis"],
    examples: [
      {
        de: "Wir suchen gemeinsam nach einer praktischen Lösung.",
        tr: "Birlikte pratik bir çözüm arıyoruz.",
        en: "We are looking together for a practical solution.",
      },
      {
        de: "Die Lösung für diese Aufgabe ist ganz einfach.",
        tr: "Bu görevin çözümü oldukça basit.",
        en: "The solution to this task is quite simple.",
      },
    ],
  }),
  makeNounEntry({
    word: "Weg",
    article: "der",
    plural: "die Wege",
    genitive: "des Weges",
    cefrLevel: "A1",
    ipa: "veːk",
    grammarTip: "Eril (der) isimdir; uzun 'e' ile okunur (zarf olan kısa 'weg' ile karıştırılmamalıdır).",
    synonyms: ["Pfad", "Strecke", "Route"],
    examples: [
      {
        de: "Der Weg durch den Wald ist sehr ruhig.",
        tr: "Ormanın içinden geçen yol çok sakin.",
        en: "The path through the forest is very quiet.",
      },
      {
        de: "Können Sie mir bitte den Weg zum Bahnhof zeigen?",
        tr: "Bana lütfen tren istasyonuna giden yolu gösterebilir misiniz?",
        en: "Can you please show me the way to the train station?",
      },
    ],
  }),
  makeNounEntry({
    word: "Tag",
    article: "der",
    plural: "die Tage",
    genitive: "des Tages",
    cefrLevel: "A1",
    ipa: "taːk",
    grammarTip: "Gün ve günün bölümleri ('die Nacht' hariç) eril (der) artikellidir.",
    synonyms: ["Datum", "Werktag"],
    examples: [
      {
        de: "Heute ist ein wunderschöner Tag.",
        tr: "Bugün harika bir gün.",
        en: "Today is a wonderful day.",
      },
      {
        de: "Ich wünsche dir einen schönen Tag!",
        tr: "Sana güzel bir gün dilerim!",
        en: "I wish you a nice day!",
      },
    ],
  }),
  makeNounEntry({
    word: "Nacht",
    article: "die",
    plural: "die Nächte",
    genitive: "der Nacht",
    cefrLevel: "A1",
    ipa: "naxt",
    grammarTip: "Dişil (die) isimdir; zaman edatıyla 'in der Nacht' olarak kullanılır.",
    synonyms: ["Dunkelheit", "Abendzeit"],
    examples: [
      {
        de: "In der Nacht sind alle Straßen leer.",
        tr: "Geceleyin bütün sokaklar boştur.",
        en: "At night all the streets are empty.",
      },
      {
        de: "Gute Nacht und schlaf gut!",
        tr: "İyi geceler ve iyi uykular!",
        en: "Good night and sleep well!",
      },
    ],
  }),
  makeNounEntry({
    word: "Jahr",
    article: "das",
    plural: "die Jahre",
    genitive: "des Jahres",
    cefrLevel: "A1",
    ipa: "jaːɐ̯",
    grammarTip: "Nötr (das) isimdir; çoğulu 'die Jahre', dativ çoğulu 'in den Jahren' şeklindedir.",
    synonyms: ["Kalenderjahr", "Zeitspanne"],
    examples: [
      {
        de: "Das neue Jahr beginnt im Januar.",
        tr: "Yeni yıl ocak ayında başlar.",
        en: "The new year begins in January.",
      },
      {
        de: "Er wohnt seit drei Jahren in Wien.",
        tr: "Üç yıldır Viyana'da yaşıyor.",
        en: "He has been living in Vienna for three years.",
      },
    ],
  }),
  makeNounEntry({
    word: "Woche",
    article: "die",
    plural: "die Wochen",
    genitive: "der Woche",
    cefrLevel: "A1",
    ipa: "ˈvɔxə",
    grammarTip: "Sonu -e ile biten dişil (die) isimdir; çoğulu 'die Wochen' şeklindedir.",
    synonyms: ["Siebentagewoche", "Zeitraum"],
    examples: [
      {
        de: "Die Woche hat sieben Tage.",
        tr: "Haftada yedi gün vardır.",
        en: "The week has seven days.",
      },
      {
        de: "Nächste Woche fahren wir in den Urlaub.",
        tr: "Gelecek hafta tatile gidiyoruz.",
        en: "Next week we are going on vacation.",
      },
    ],
  }),
  makeNounEntry({
    word: "Hand",
    article: "die",
    plural: "die Hände",
    genitive: "der Hand",
    cefrLevel: "A1",
    ipa: "hant",
    grammarTip: "Dişil (die) isimdir; çoğulda umlaut ve -e eki alır (die Hand -> die Hände).",
    synonyms: ["Greiforgan", "Pfote"],
    examples: [
      {
        de: "Sie hält eine warme Tasse Tee in der Hand.",
        tr: "Elinde sıcak bir fincan çay tutuyor.",
        en: "She is holding a warm cup of tea in her hand.",
      },
      {
        de: "Bitte wasch dir vor dem Essen die Hände.",
        tr: "Lütfen yemekten önce ellerini yıka.",
        en: "Please wash your hands before eating.",
      },
    ],
  }),
  makeNounEntry({
    word: "Auge",
    article: "das",
    plural: "die Augen",
    genitive: "des Auges",
    cefrLevel: "A1",
    ipa: "ˈaʊ̯ɡə",
    grammarTip: "Sonu -e ile bitmesine rağmen nötr (das) olan önemli istisnalardandır (das Auge, das Ende, das Interesse).",
    synonyms: ["Sehorgan", "Blick"],
    examples: [
      {
        de: "Das Kind hat große blaue Augen.",
        tr: "Çocuğun büyük mavi gözleri var.",
        en: "The child has big blue eyes.",
      },
      {
        de: "Ich schließe für einen Moment die Augen.",
        tr: "Bir anlığına gözlerimi kapatıyorum.",
        en: "I close my eyes for a moment.",
      },
    ],
  }),
  makeNounEntry({
    word: "Herz",
    article: "das",
    plural: "die Herzen",
    genitive: "des Herzens",
    cefrLevel: "A2",
    ipa: "hɛʁt͡s",
    grammarTip: "Nötr (das) isimdir; düzensiz çekime sahiptir (Genitiv: des Herzens, Plural: die Herzen).",
    synonyms: ["Gemüt", "Seele", "Zentrum"],
    examples: [
      {
        de: "Das Herz schlägt schneller beim Sport.",
        tr: "Spor yaparken kalp daha hızlı atar.",
        en: "The heart beats faster during sports.",
      },
      {
        de: "Ich danke dir von ganzem Herzen.",
        tr: "Sana tüm kalbimle teşekkür ederim.",
        en: "I thank you with all my heart.",
      },
    ],
  }),
  makeNounEntry({
    word: "Kopf",
    article: "der",
    plural: "die Köpfe",
    genitive: "des Kopfes",
    cefrLevel: "A1",
    ipa: "kɔp͡f",
    grammarTip: "Eril (der) isimdir; çoğulda umlaut ve -e alır (der Kopf -> die Köpfe).",
    synonyms: ["Haupt", "Schädel", "Verstand"],
    examples: [
      {
        de: "Mir tut heute ein bisschen der Kopf weh.",
        tr: "Bugün başım biraz ağrıyor.",
        en: "My head hurts a little today.",
      },
      {
        de: "Er trägt im Winter immer eine Mütze auf dem Kopf.",
        tr: "Kışın başında her zaman bir bere taşır.",
        en: "He always wears a beanie on his head in winter.",
      },
    ],
  }),
  makeNounEntry({
    word: "Kind",
    article: "das",
    plural: "die Kinder",
    genitive: "des Kindes",
    cefrLevel: "A1",
    ipa: "kɪnt",
    grammarTip: "Nötr (das) isimdir; çoğul formu -er ekiyle yapılır (das Kind -> die Kinder).",
    synonyms: ["Nachwuchs", "Sprössling"],
    examples: [
      {
        de: "Das Kind lacht und spielt im Garten.",
        tr: "Çocuk bahçede gülüyor ve oynuyor.",
        en: "The child is laughing and playing in the garden.",
      },
      {
        de: "Die Kinder freuen sich auf das Wochenende.",
        tr: "Çocuklar hafta sonunu dört gözle bekliyor.",
        en: "The children are looking forward to the weekend.",
      },
    ],
  }),
  makeNounEntry({
    word: "Mann",
    article: "der",
    plural: "die Männer",
    genitive: "des Mannes",
    cefrLevel: "A1",
    ipa: "man",
    grammarTip: "Eril (der) isimdir; çoğulda umlaut ve -er alır (der Mann -> die Männer).",
    synonyms: ["Herr", "Ehemann", "Gatte"],
    examples: [
      {
        de: "Der Mann an der Rezeption spricht sehr freundlich.",
        tr: "Resepsiyondaki adam çok nazik konuşuyor.",
        en: "The man at the reception speaks very kindly.",
      },
      {
        de: "Ihr Mann arbeitet als Ingenieur.",
        tr: "Eşi mühendis olarak çalışıyor.",
        en: "Her husband works as an engineer.",
      },
    ],
  }),
  makeNounEntry({
    word: "Frau",
    article: "die",
    plural: "die Frauen",
    genitive: "der Frau",
    cefrLevel: "A1",
    ipa: "fʁaʊ̯",
    grammarTip: "Dişil (die) isimdir; hem 'kadın', hem 'eş', hem de soyadıyla 'Hanım' anlamında kullanılır.",
    synonyms: ["Dame", "Ehefrau", "Gattin"],
    examples: [
      {
        de: "Die Frau liest eine Zeitung im Zug.",
        tr: "Kadın trende bir gazete okuyor.",
        en: "The woman is reading a newspaper on the train.",
      },
      {
        de: "Guten Tag, Frau Müller!",
        tr: "İyi günler, Bayan Müller!",
        en: "Good afternoon, Ms. Müller!",
      },
    ],
  }),
  makeNounEntry({
    word: "Mädchen",
    article: "das",
    plural: "die Mädchen",
    genitive: "des Mädchens",
    cefrLevel: "A1",
    ipa: "ˈmɛːtçən",
    grammarTip: "-chen ve -lein küçültme ekleriyle biten tüm isimler biyolojik cinsiyetten bağımsız olarak nötrdür (das Mädchen).",
    synonyms: ["Mädel", "Tochter"],
    examples: [
      {
        de: "Das Mädchen malt ein buntes Bild.",
        tr: "Kız çocuğu renkli bir resim çiziyor.",
        en: "The girl is painting a colorful picture.",
      },
      {
        de: "Die Mädchen spielen zusammen Fußball.",
        tr: "Kızlar birlikte futbol oynuyor.",
        en: "The girls are playing soccer together.",
      },
    ],
  }),
  makeNounEntry({
    word: "Junge",
    article: "der",
    plural: "die Jungen",
    genitive: "des Jungen",
    cefrLevel: "A1",
    ipa: "ˈjʊŋə",
    grammarTip: "N-Deklination grubundandır: yalın hâl dışında tüm tekil ve çoğul hâllerde -n eki alır (den/dem/des Jungen).",
    synonyms: ["Knabe", "Bub", "Sohn"],
    examples: [
      {
        de: "Der Junge fährt schnell mit dem Fahrrad.",
        tr: "Erkek çocuğu bisikletle hızlıca gidiyor.",
        en: "The boy is riding his bicycle fast.",
      },
      {
        de: "Ich gebe dem kleinen Jungen einen Ball.",
        tr: "Küçük çocuğa bir top veriyorum.",
        en: "I give the little boy a ball.",
      },
    ],
  }),
  makeNounEntry({
    word: "Zug",
    article: "der",
    plural: "die Züge",
    genitive: "des Zuges",
    cefrLevel: "A1",
    ipa: "t͡suːk",
    grammarTip: "Eril (der) isimdir; çoğulda 'u' -> 'ü' dönüşümü ve -e alır (der Zug -> die Züge).",
    synonyms: ["Bahn", "Eisenbahn"],
    examples: [
      {
        de: "Der Zug nach Hamburg fährt auf Gleis vier ab.",
        tr: "Hamburg'a giden tren dördüncü perondan kalkıyor.",
        en: "The train to Hamburg departs from platform four.",
      },
      {
        de: "Ich fahre lieber mit dem Zug als mit dem Bus.",
        tr: "Otobüsten ziyade trenle gitmeyi tercih ederim.",
        en: "I prefer traveling by train rather than by bus.",
      },
    ],
  }),
  makeNounEntry({
    word: "Bahnhof",
    article: "der",
    plural: "die Bahnhöfe",
    genitive: "des Bahnhofs",
    cefrLevel: "A1",
    ipa: "ˈbaːnhoːf",
    grammarTip: "Birleşik isimlerde artikel son kelimeden gelir: der Hof -> der Bahnhof (çoğul: die Bahnhöfe).",
    synonyms: ["Station", "Haltestelle", "Hauptbahnhof"],
    examples: [
      {
        de: "Wir treffen uns um zehn Uhr am Bahnhof.",
        tr: "Saat onda tren istasyonunda buluşuyoruz.",
        en: "We are meeting at the train station at ten o'clock.",
      },
      {
        de: "Der Bahnhof ist nur fünf Minuten entfernt.",
        tr: "Tren istasyonu sadece beş dakika uzaklıkta.",
        en: "The train station is only five minutes away.",
      },
    ],
  }),
  makeNounEntry({
    word: "Flughafen",
    article: "der",
    plural: "die Flughäfen",
    genitive: "des Flughafens",
    cefrLevel: "A1",
    ipa: "ˈfluːkhaːfn̩",
    grammarTip: "der Hafen -> der Flughafen; çoğulda 'a' ünlüsü umlaut alır (die Flughäfen).",
    synonyms: ["Airport", "Flugplatz"],
    examples: [
      {
        de: "Der Flughafen ist mit der S-Bahn leicht erreichbar.",
        tr: "Havalimanına banliyö treniyle kolayca ulaşılabilir.",
        en: "The airport is easily accessible by commuter train.",
      },
      {
        de: "Wir müssen zwei Stunden vor dem Abflug am Flughafen sein.",
        tr: "Uçuştan iki saat önce havalimanında olmalıyız.",
        en: "We have to be at the airport two hours before departure.",
      },
    ],
  }),
  makeNounEntry({
    word: "Zimmer",
    article: "das",
    plural: "die Zimmer",
    genitive: "des Zimmers",
    cefrLevel: "A1",
    ipa: "ˈt͡sɪmɐ",
    grammarTip: "Nötr (das) isimdir; tekil ve çoğul yazılışı aynıdır (das Zimmer -> die Zimmer).",
    synonyms: ["Raum", "Stube", "Kammer"],
    examples: [
      {
        de: "Das Zimmer hat einen schönen Blick auf das Meer.",
        tr: "Odanın deniz manzarası çok güzel.",
        en: "The room has a beautiful view of the sea.",
      },
      {
        de: "Die Wohnung hat drei helle Zimmer.",
        tr: "Dairenin üç aydınlık odası var.",
        en: "The apartment has three bright rooms.",
      },
    ],
  }),
  makeNounEntry({
    word: "Wohnung",
    article: "die",
    plural: "die Wohnungen",
    genitive: "der Wohnung",
    cefrLevel: "A1",
    ipa: "ˈvoːnʊŋ",
    grammarTip: "-ung sonekiyle bittiği için dişil (die) artikellidir; çoğulu -en alır (die Wohnungen).",
    synonyms: ["Apartment", "Unterkunft", "Heim"],
    examples: [
      {
        de: "Die Wohnung liegt im dritten Stock.",
        tr: "Daire üçüncü katta bulunuyor.",
        en: "The apartment is on the third floor.",
      },
      {
        de: "Wir suchen eine neue Wohnung in der Nähe.",
        tr: "Yakınlarda yeni bir daire arıyoruz.",
        en: "We are looking for a new apartment nearby.",
      },
    ],
  }),
  makeNounEntry({
    word: "Schlüssel",
    article: "der",
    plural: "die Schlüssel",
    genitive: "des Schlüssels",
    cefrLevel: "A1",
    ipa: "ˈʃlʏsl̩",
    grammarTip: "-el ile biten çoğu isim gibi eril (der) artikellidir; tekil ve çoğul hali aynıdır (die Schlüssel).",
    synonyms: ["Hausschlüssel", "Öffner"],
    examples: [
      {
        de: "Ich habe meinen Schlüssel in der Tasche gefunden.",
        tr: "Anahtarımı çantada buldum.",
        en: "I found my key in the bag.",
      },
      {
        de: "Wo liegt der Schlüssel für die Haustür?",
        tr: "Sokak kapısının anahtarı nerede duruyor?",
        en: "Where is the key for the front door?",
      },
    ],
  }),
  makeNounEntry({
    word: "Computer",
    article: "der",
    plural: "die Computer",
    genitive: "des Computers",
    cefrLevel: "A1",
    ipa: "kɔmˈpjuːtɐ",
    grammarTip: "-er ile biten cihaz isimleri genellikle erildir (der Computer, der Drucker); çoğulu değişmez.",
    synonyms: ["Rechner", "PC", "Laptop"],
    examples: [
      {
        de: "Der Computer startet nach dem Update sehr schnell.",
        tr: "Bilgisayar güncellemeden sonra çok hızlı açılıyor.",
        en: "The computer starts very quickly after the update.",
      },
      {
        de: "Ich arbeite den ganzen Tag am Computer.",
        tr: "Bütün gün bilgisayarda çalışıyorum.",
        en: "I work on the computer all day.",
      },
    ],
  }),
  makeNounEntry({
    word: "Telefon",
    article: "das",
    plural: "die Telefone",
    genitive: "des Telefons",
    cefrLevel: "A1",
    ipa: "teleˈfoːn",
    grammarTip: "Nötr (das) isimdir; 'am Telefon sein' (telefonda olmak) kalıbıyla sık kullanılır.",
    synonyms: ["Fernsprecher", "Handy", "Smartphone"],
    examples: [
      {
        de: "Das Telefon klingelt schon zum dritten Mal.",
        tr: "Telefon üçüncü kez çalıyor.",
        en: "The telephone is ringing for the third time already.",
      },
      {
        de: "Ich habe mein Telefon auf dem Schreibtisch vergessen.",
        tr: "Telefonumu çalışma masasında unuttum.",
        en: "I forgot my phone on the desk.",
      },
    ],
  }),
  makeNounEntry({
    word: "Zeitung",
    article: "die",
    plural: "die Zeitungen",
    genitive: "der Zeitung",
    cefrLevel: "A1",
    ipa: "ˈt͡saɪ̯tʊŋ",
    grammarTip: "-ung soneki nedeniyle dişil (die) artikellidir; çoğulu 'die Zeitungen' şeklindedir.",
    synonyms: ["Blatt", "Tageszeitung", "Presse"],
    examples: [
      {
        de: "Mein Vater liest jeden Morgen die Zeitung.",
        tr: "Babam her sabah gazeteyi okur.",
        en: "My father reads the newspaper every morning.",
      },
      {
        de: "Dieser Artikel stand gestern in der Zeitung.",
        tr: "Bu makale dün gazetede yer aldı.",
        en: "This article was in the newspaper yesterday.",
      },
    ],
  }),
  makeNounEntry({
    word: "Idee",
    article: "die",
    plural: "die Ideen",
    genitive: "der Idee",
    cefrLevel: "A2",
    ipa: "iˈdeː",
    grammarTip: "Dişil (die) isimdir; çoğulda tek bir -n eklenir ve dört heceli okunur (die I-de-en).",
    synonyms: ["Gedanke", "Einfall", "Vorstellung"],
    examples: [
      {
        de: "Das ist wirklich eine ausgezeichnete Idee!",
        tr: "Bu gerçekten mükemmel bir fikir!",
        en: "That is truly an excellent idea!",
      },
      {
        de: "Hast du eine Idee für das Geschenk?",
        tr: "Hediye için bir fikrin var mı?",
        en: "Do you have an idea for the gift?",
      },
    ],
  }),
  makeNounEntry({
    word: "Freiheit",
    article: "die",
    plural: "die Freiheiten",
    genitive: "der Freiheit",
    cefrLevel: "B1",
    ipa: "ˈfʁaɪ̯haɪ̯t",
    grammarTip: "-heit ve -keit sonekleriyle biten tüm soyut isimler dişil (die) artikellidir.",
    synonyms: ["Unabhängigkeit", "Selbstbestimmung"],
    examples: [
      {
        de: "Die Freiheit der Meinung ist ein wichtiges Grundrecht.",
        tr: "Düşünce özgürlüğü önemli bir temel haktır.",
        en: "Freedom of opinion is an important fundamental right.",
      },
      {
        de: "Auf Reisen genieße ich das Gefühl von Freiheit.",
        tr: "Seyahat ederken özgürlük hissinin tadını çıkarıyorum.",
        en: "While traveling I enjoy the feeling of freedom.",
      },
    ],
  }),
  makeNounEntry({
    word: "Möglichkeit",
    article: "die",
    plural: "die Möglichkeiten",
    genitive: "der Möglichkeit",
    cefrLevel: "B1",
    ipa: "ˈmøːklɪçkaɪ̯t",
    grammarTip: "Sıfatlardan -keit ekiyle türetilen tüm isimler dişil (die) artikellidir (möglich -> die Möglichkeit).",
    synonyms: ["Chance", "Gelegenheit", "Option"],
    examples: [
      {
        de: "Es gibt noch eine andere Möglichkeit.",
        tr: "Başka bir olasılık / imkân daha var.",
        en: "There is still another possibility.",
      },
      {
        de: "Diese Arbeit bietet viele neue Möglichkeiten.",
        tr: "Bu iş birçok yeni olanak sunuyor.",
        en: "This job offers many new opportunities.",
      },
    ],
  }),

  // --- 27 Essential German Verbs (A1 - B2) ---
  makeVerbEntry({
    infinitive: "sein",
    praesensIch: "bin",
    praesensDu: "bist",
    praesensErSieEs: "ist",
    praeteritumIch: "war",
    auxiliary: "sein",
    partizipII: "gewesen",
    cefrLevel: "A1",
    ipa: "zaɪ̯n",
    grammarTip: "Almancanın en temel düzensiz fiilidir; Perfekt zamanı kendi yardımcı fiiliyle ('ist gewesen') kurulur.",
    synonyms: ["existieren", "sich befinden"],
    examples: [
      {
        de: "Ich bin heute sehr glücklich.",
        tr: "Bugün çok mutluyum.",
        en: "I am very happy today.",
      },
      {
        de: "Gestern sind wir den ganzen Tag zu Hause gewesen.",
        tr: "Dün bütün gün evdeydik.",
        en: "Yesterday we were at home all day.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "haben",
    praesensIch: "habe",
    praesensDu: "hast",
    praesensErSieEs: "hat",
    praeteritumIch: "hatte",
    auxiliary: "haben",
    partizipII: "gehabt",
    cefrLevel: "A1",
    ipa: "ˈhaːbn̩",
    grammarTip: "'sahiplik' bildirir ve geçişli fiillerin Perfekt zamanında yardımcı fiil olarak kullanılır (du hast, er hat).",
    synonyms: ["besitzen", "verfügen über"],
    examples: [
      {
        de: "Wir haben morgen leider keine Zeit.",
        tr: "Yarın maalesef vaktimiz yok.",
        en: "Unfortunately we have no time tomorrow.",
      },
      {
        de: "Er hat eine gute Idee gehabt.",
        tr: "Onun iyi bir fikri vardı.",
        en: "He had a good idea.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "werden",
    praesensIch: "werde",
    praesensDu: "wirst",
    praesensErSieEs: "wird",
    praeteritumIch: "wurde",
    auxiliary: "sein",
    partizipII: "geworden",
    cefrLevel: "A1",
    ipa: "ˈveːɐ̯dn̩",
    grammarTip: "Hem 'olmak/dönüşmek' ana fiili hem de gelecek zaman (Futur I) ve edilgen çatı (Passiv) yardımcı fiilidir.",
    synonyms: ["entstehen", "sich entwickeln"],
    examples: [
      {
        de: "Das Wetter wird morgen viel besser.",
        tr: "Hava yarın çok daha iyi olacak.",
        en: "The weather will get much better tomorrow.",
      },
      {
        de: "Sie ist Ärztin geworden.",
        tr: "O doktor oldu.",
        en: "She became a doctor.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "gehen",
    praesensIch: "gehe",
    praesensDu: "gehst",
    praesensErSieEs: "geht",
    praeteritumIch: "ging",
    auxiliary: "sein",
    partizipII: "gegangen",
    cefrLevel: "A1",
    ipa: "ˈɡeːən",
    grammarTip: "Yön/hareket bildirdiği için Perfekt zamanda 'sein' yardımcı fiiliyle kullanılır (ist gegangen).",
    synonyms: ["laufen", "schreiten", "spazieren"],
    examples: [
      {
        de: "Wir gehen heute Abend ins Kino.",
        tr: "Bu akşam sinemaya gidiyoruz.",
        en: "We are going to the cinema tonight.",
      },
      {
        de: "Er ist schon früh nach Hause gegangen.",
        tr: "O erkenden eve gitti.",
        en: "He already went home early.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "kommen",
    praesensIch: "komme",
    praesensDu: "kommst",
    praesensErSieEs: "kommt",
    praeteritumIch: "kam",
    auxiliary: "sein",
    partizipII: "gekommen",
    cefrLevel: "A1",
    ipa: "ˈkɔmən",
    grammarTip: "Konum değişikliği bildirdiği için Perfekt zamanda 'sein' alır (ist gekommen).",
    synonyms: ["eintreffen", "ankommen", "erscheinen"],
    examples: [
      {
        de: "Woher kommst du ursprünglich?",
        tr: "Aslen nerelisin?",
        en: "Where do you come from originally?",
      },
      {
        de: "Der Zug ist pünktlich angekommen.",
        tr: "Tren tam vaktinde geldi.",
        en: "The train arrived on time.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "machen",
    praesensIch: "mache",
    praesensDu: "machst",
    praesensErSieEs: "macht",
    praeteritumIch: "machte",
    auxiliary: "haben",
    partizipII: "gemacht",
    cefrLevel: "A1",
    ipa: "ˈmaxn̩",
    grammarTip: "Düzenli (zayıf) bir fiildir; Perfekt hali 'hat gemacht' şeklindedir.",
    synonyms: ["tun", "erledigen", "herstellen"],
    examples: [
      {
        de: "Was machst du an diesem Wochenende?",
        tr: "Bu hafta sonu ne yapıyorsun?",
        en: "What are you doing this weekend?",
      },
      {
        de: "Sie hat ihre Hausaufgaben schon gemacht.",
        tr: "Ödevlerini çoktan yaptı.",
        en: "She has already done her homework.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "sagen",
    praesensIch: "sage",
    praesensDu: "sagst",
    praesensErSieEs: "sagt",
    praeteritumIch: "sagte",
    auxiliary: "haben",
    partizipII: "gesagt",
    cefrLevel: "A1",
    ipa: "ˈzaːɡn̩",
    grammarTip: "Düzenli bir fiildir; birine bir şey söylemek 'jemandem (Dativ) etwas (Akkusativ) sagen' ile kurulur.",
    synonyms: ["äußern", "mitteilen", "erklären"],
    examples: [
      {
        de: "Kannst du mir bitte die Wahrheit sagen?",
        tr: "Bana lütfen gerçeği söyleyebilir misin?",
        en: "Can you please tell me the truth?",
      },
      {
        de: "Was hat er dazu gesagt?",
        tr: "Buna ne dedi?",
        en: "What did he say about that?",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "geben",
    praesensIch: "gebe",
    praesensDu: "gibst",
    praesensErSieEs: "gibt",
    praeteritumIch: "gab",
    auxiliary: "haben",
    partizipII: "gegeben",
    cefrLevel: "A1",
    ipa: "ˈɡeːbn̩",
    grammarTip: "Tekil 2. ve 3. şahısta 'e' -> 'i' ünlü değişimi olur (du gibst, er gibt). 'es gibt' = vardır.",
    synonyms: ["überreichen", "schenken", "reichen"],
    examples: [
      {
        de: "Er gibt seinem Freund das Buch zurück.",
        tr: "Kitabı arkadaşına geri veriyor.",
        en: "He gives the book back to his friend.",
      },
      {
        de: "In dieser Straße gibt es viele kleine Cafés.",
        tr: "Bu caddede birçok küçük kafe var.",
        en: "There are many small cafés on this street.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "nehmen",
    praesensIch: "nehme",
    praesensDu: "nimmst",
    praesensErSieEs: "nimmt",
    praeteritumIch: "nahm",
    auxiliary: "haben",
    partizipII: "genommen",
    cefrLevel: "A1",
    ipa: "ˈneːmən",
    grammarTip: "Güçlü (düzensiz) fiildir: du nimmst, er nimmt, nahm, hat genommen.",
    synonyms: ["greifen", "wählen", "benutzen"],
    examples: [
      {
        de: "Ich nehme zum Frühstück einen Kaffee und ein Brötchen.",
        tr: "Kahvaltıda bir kahve ve bir küçük ekmek alıyorum.",
        en: "I will have a coffee and a roll for breakfast.",
      },
      {
        de: "Er hat den nächsten Bus in die Stadt genommen.",
        tr: "Şehre giden bir sonraki otobüse bindi.",
        en: "He took the next bus into the city.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "sehen",
    praesensIch: "sehe",
    praesensDu: "siehst",
    praesensErSieEs: "sieht",
    praeteritumIch: "sah",
    auxiliary: "haben",
    partizipII: "gesehen",
    cefrLevel: "A1",
    ipa: "ˈzeːən",
    grammarTip: "Tekil 2. ve 3. şahısta 'e' -> 'ie' dönüşümü yaşanır (du siehst, er sieht).",
    synonyms: ["blicken", "schauen", "bemerken"],
    examples: [
      {
        de: "Siehst du den Vogel auf dem Baum?",
        tr: "Ağaçtaki kuşu görüyor musun?",
        en: "Do you see the bird in the tree?",
      },
      {
        de: "Wir haben gestern einen spannenden Film gesehen.",
        tr: "Dün heyecan verici bir film izledik.",
        en: "We watched an exciting movie yesterday.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "sprechen",
    praesensIch: "spreche",
    praesensDu: "sprichst",
    praesensErSieEs: "spricht",
    praeteritumIch: "sprach",
    auxiliary: "haben",
    partizipII: "gesprochen",
    cefrLevel: "A1",
    ipa: "ˈʃpʁɛçn̩",
    grammarTip: "Kök ünlüsü du/er çekiminde 'e' -> 'i' olur (du sprichst, er spricht); Perfekt: hat gesprochen.",
    synonyms: ["reden", "unterhalten", "kommunizieren"],
    examples: [
      {
        de: "Sprichst du schon gut Deutsch?",
        tr: "Artık iyi Almanca konuşuyor musun?",
        en: "Do you already speak German well?",
      },
      {
        de: "Wir haben lange über das Projekt gesprochen.",
        tr: "Proje hakkında uzun süre konuştuk.",
        en: "We talked about the project for a long time.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "lesen",
    praesensIch: "lese",
    praesensDu: "liest",
    praesensErSieEs: "liest",
    praeteritumIch: "las",
    auxiliary: "haben",
    partizipII: "gelesen",
    cefrLevel: "A1",
    ipa: "ˈleːzn̩",
    grammarTip: "'du' ve 'er/sie/es' çekimleri aynıdır: 'du liest', 'er liest' (kök -s ile bittiği için fazladan s eklenmez).",
    synonyms: ["studieren", "schmökern"],
    examples: [
      {
        de: "Sie liest jeden Abend im Bett ein Kapitel.",
        tr: "Her akşam yatakta bir bölüm okur.",
        en: "She reads a chapter in bed every evening.",
      },
      {
        de: "Hast du die Nachricht schon gelesen?",
        tr: "Mesajı çoktan okudun mu?",
        en: "Have you read the message already?",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "schreiben",
    praesensIch: "schreibe",
    praesensDu: "schreibst",
    praesensErSieEs: "schreibt",
    praeteritumIch: "schrieb",
    auxiliary: "haben",
    partizipII: "geschrieben",
    cefrLevel: "A1",
    ipa: "ˈʃʁaɪ̯bn̩",
    grammarTip: "'ei' ünlüsü geçmiş zamanda 'ie' olur: schreiben -> schrieb -> hat geschrieben.",
    synonyms: ["verfassen", "notieren", "tippen"],
    examples: [
      {
        de: "Ich schreibe meiner Mutter eine E-Mail.",
        tr: "Anneme bir e-posta yazıyorum.",
        en: "I am writing an email to my mother.",
      },
      {
        de: "Er hat einen langen Brief geschrieben.",
        tr: "Uzun bir mektup yazdı.",
        en: "He wrote a long letter.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "lernen",
    praesensIch: "lerne",
    praesensDu: "lernst",
    praesensErSieEs: "lernt",
    praeteritumIch: "lernte",
    auxiliary: "haben",
    partizipII: "gelernt",
    cefrLevel: "A1",
    ipa: "ˈlɛʁnən",
    grammarTip: "Düzenli bir fiildir; pratik/okul öğrenimi için 'lernen', üniversite eğitimi için 'studieren' kullanılır.",
    synonyms: ["üben", "pauken", "aneignen"],
    examples: [
      {
        de: "Wir lernen zusammen Deutsch und Englisch.",
        tr: "Birlikte Almanca ve İngilizce öğreniyoruz.",
        en: "We are learning German and English together.",
      },
      {
        de: "Ich habe heute viele neue Vokabeln gelernt.",
        tr: "Bugün birçok yeni kelime öğrendim.",
        en: "I learned many new vocabulary words today.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "verstehen",
    praesensIch: "verstehe",
    praesensDu: "verstehst",
    praesensErSieEs: "versteht",
    praeteritumIch: "verstand",
    auxiliary: "haben",
    partizipII: "verstanden",
    cefrLevel: "A1",
    ipa: "fɛɐ̯ˈʃteːən",
    grammarTip: "'ver-' ayrılmaz öneki taşıdığı için Partizip II formunda '-ge-' almaz (hat verstanden).",
    synonyms: ["begreifen", "erfassen", "nachvollziehen"],
    examples: [
      {
        de: "Ich verstehe diesen Satz ohne Wörterbuch.",
        tr: "Bu cümleyi sözlük olmadan anlıyorum.",
        en: "I understand this sentence without a dictionary.",
      },
      {
        de: "Haben Sie meine Frage gut verstanden?",
        tr: "Sorumu iyi anladınız mı?",
        en: "Did you understand my question well?",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "arbeiten",
    praesensIch: "arbeite",
    praesensDu: "arbeitest",
    praesensErSieEs: "arbeitet",
    praeteritumIch: "arbeitete",
    auxiliary: "haben",
    partizipII: "gearbeitet",
    cefrLevel: "A1",
    ipa: "ˈaʁbaɪ̯tn̩",
    grammarTip: "Kökü -t ile bittiği için telaffuzu kolaylaştırmak adına -e- kaynaştırma ünlüsü alır (du arbeitest, er arbeitet).",
    synonyms: ["tätig sein", "schaffen", "wirken"],
    examples: [
      {
        de: "Sie arbeitet seit fünf Jahren in einem Krankenhaus.",
        tr: "Beş yıldır bir hastanede çalışıyor.",
        en: "She has been working in a hospital for five years.",
      },
      {
        de: "Heute habe ich konzentriert zu Hause gearbeitet.",
        tr: "Bugün evde odaklanarak çalıştım.",
        en: "Today I worked with focus at home.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "wohnen",
    praesensIch: "wohne",
    praesensDu: "wohnst",
    praesensErSieEs: "wohnt",
    praeteritumIch: "wohnte",
    auxiliary: "haben",
    partizipII: "gewohnt",
    cefrLevel: "A1",
    ipa: "ˈvoːnən",
    grammarTip: "Düzenli fiildir; ikamet etmek / oturmak anlamındadır (hat gewohnt).",
    synonyms: ["leben", "residieren", "hausen"],
    examples: [
      {
        de: "Wo wohnst du zurzeit?",
        tr: "Şu anda nerede oturuyorsun?",
        en: "Where do you live currently?",
      },
      {
        de: "Wir wohnen in einer ruhigen Straße.",
        tr: "Sakin bir sokakta oturuyoruz.",
        en: "We live on a quiet street.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "essen",
    praesensIch: "esse",
    praesensDu: "isst",
    praesensErSieEs: "isst",
    praeteritumIch: "aß",
    auxiliary: "haben",
    partizipII: "gegessen",
    cefrLevel: "A1",
    ipa: "ˈɛsn̩",
    grammarTip: "Düzensiz fiildir: du/er isst; Partizip II formunda fazladan bir 'g' bulunur (hat gegessen).",
    synonyms: ["speisen", "verzehren", "genießen"],
    examples: [
      {
        de: "Mittags essen wir oft zusammen in der Kantine.",
        tr: "Öğleleri sık sık kantinde birlikte yemek yeriz.",
        en: "At noon we often eat together in the cafeteria.",
      },
      {
        de: "Was hast du heute zum Abendessen gegessen?",
        tr: "Bugün akşam yemeğinde ne yedin?",
        en: "What did you eat for dinner today?",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "trinken",
    praesensIch: "trinke",
    praesensDu: "trinkst",
    praesensErSieEs: "trinkt",
    praeteritumIch: "trank",
    auxiliary: "haben",
    partizipII: "getrunken",
    cefrLevel: "A1",
    ipa: "ˈtʁɪŋkn̩",
    grammarTip: "i-a-u ünlü değişim grubundandır: trinken -> trank -> hat getrunken.",
    synonyms: ["schlürfen", "zu sich nehmen"],
    examples: [
      {
        de: "Am Morgen trinke ich immer eine Tasse Tee.",
        tr: "Sabahları her zaman bir fincan çay içerim.",
        en: "In the morning I always drink a cup of tea.",
      },
      {
        de: "Hast du heute schon genug Wasser getrunken?",
        tr: "Bugün yeterince su içtin mi?",
        en: "Have you drunk enough water today already?",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "schlafen",
    praesensIch: "schlafe",
    praesensDu: "schläfst",
    praesensErSieEs: "schläft",
    praeteritumIch: "schlief",
    auxiliary: "haben",
    partizipII: "geschlafen",
    cefrLevel: "A1",
    ipa: "ˈʃlaːfn̩",
    grammarTip: "Tekil 2. ve 3. şahısta 'a' -> 'ä' umlaut değişimi alır (du schläfst, er schläft).",
    synonyms: ["ruhen", "schlummern", "dösen"],
    examples: [
      {
        de: "Das Baby schläft ruhig in seinem Bett.",
        tr: "Bebek yatağında sakin bir şekilde uyuyor.",
        en: "The baby is sleeping quietly in his bed.",
      },
      {
        de: "Ich habe letzte Nacht sehr gut geschlafen.",
        tr: "Dün gece çok iyi uyudum.",
        en: "I slept very well last night.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "fahren",
    praesensIch: "fahre",
    praesensDu: "fährst",
    praesensErSieEs: "fährt",
    praeteritumIch: "fuhr",
    auxiliary: "sein",
    partizipII: "gefahren",
    cefrLevel: "A1",
    ipa: "ˈfaːʁən",
    grammarTip: "Araçla gitmek anlamında hareket bildirdiği için 'sein' alır (du fährst, er fährt, ist gefahren).",
    synonyms: ["reisen", "steuern", "lenken"],
    examples: [
      {
        de: "Er fährt jeden Tag mit dem Fahrrad zur Arbeit.",
        tr: "Her gün işe bisikletle gidiyor.",
        en: "He rides his bike to work every day.",
      },
      {
        de: "Im Sommer sind wir ans Meer gefahren.",
        tr: "Yazın deniz kenarına gittik.",
        en: "In the summer we drove to the sea.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "laufen",
    praesensIch: "laufe",
    praesensDu: "läufst",
    praesensErSieEs: "läuft",
    praeteritumIch: "lief",
    auxiliary: "sein",
    partizipII: "gelaufen",
    cefrLevel: "A1",
    ipa: "ˈlaʊ̯fn̩",
    grammarTip: "'au' -> 'äu' dönüşümü alır (du läufst, er läuft) ve Perfekt zamanda 'sein' kullanılır (ist gelaufen).",
    synonyms: ["rennen", "joggen", "gehen"],
    examples: [
      {
        de: "Sie läuft jeden Morgen fünf Kilometer im Park.",
        tr: "Her sabah parkta beş kilometre koşuyor.",
        en: "She runs five kilometers in the park every morning.",
      },
      {
        de: "Die Kinder sind schnell nach draußen gelaufen.",
        tr: "Çocuklar hızla dışarı koştular.",
        en: "The children ran outside quickly.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "denken",
    praesensIch: "denke",
    praesensDu: "denkst",
    praesensErSieEs: "denkt",
    praeteritumIch: "dachte",
    auxiliary: "haben",
    partizipII: "gedacht",
    cefrLevel: "A2",
    ipa: "ˈdɛŋkn̩",
    grammarTip: "Karma (Gemischte) fiildir; geçmiş zamanda kök değişir: denken -> dachte -> hat gedacht (+ an Akk).",
    synonyms: ["überlegen", "glauben", "meinen"],
    examples: [
      {
        de: "Ich denke oft an unsere schöne Reise.",
        tr: "Sık sık güzel seyahatimizi düşünüyorum.",
        en: "I often think about our lovely trip.",
      },
      {
        de: "Das habe ich mir schon gedacht!",
        tr: "Bunu zaten tahmin etmiştim / düşünmüştüm!",
        en: "I already thought so!",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "wissen",
    praesensIch: "weiß",
    praesensDu: "weißt",
    praesensErSieEs: "weiß",
    praeteritumIch: "wusste",
    auxiliary: "haben",
    partizipII: "gewusst",
    cefrLevel: "A2",
    ipa: "ˈvɪsn̩",
    grammarTip: "Tekil 1. ve 3. şahıs aynıdır: ich weiß, er/sie/es weiß; bilgi/gerçek bilmek için kullanılır.",
    synonyms: ["kennen", "informiert sein"],
    examples: [
      {
        de: "Ich weiß leider nicht, wann der Film beginnt.",
        tr: "Maalesef filmin ne zaman başlayacağını bilmiyorum.",
        en: "Unfortunately I do not know when the movie starts.",
      },
      {
        de: "Hast du die Antwort auf die Frage gewusst?",
        tr: "Sorunun cevabını biliyor muydun?",
        en: "Did you know the answer to the question?",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "finden",
    praesensIch: "finde",
    praesensDu: "findest",
    praesensErSieEs: "findet",
    praeteritumIch: "fand",
    auxiliary: "haben",
    partizipII: "gefunden",
    cefrLevel: "A1",
    ipa: "ˈfɪndn̩",
    grammarTip: "Hem 'bulmak' hem de bir şeyi 'nasıl bulmak / düşünmek' (Ich finde das Buch gut) anlamında kullanılır.",
    synonyms: ["entdecken", "halten für", "aufspüren"],
    examples: [
      {
        de: "Wie findest du meine neue Wohnung?",
        tr: "Yeni dairemi nasıl buluyorsun?",
        en: "How do you like my new apartment?",
      },
      {
        de: "Wir haben endlich einen freien Parkplatz gefunden.",
        tr: "Sonunda boş bir park yeri bulduk.",
        en: "We finally found a free parking spot.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "helfen",
    praesensIch: "helfe",
    praesensDu: "hilfst",
    praesensErSieEs: "hilft",
    praeteritumIch: "half",
    auxiliary: "haben",
    partizipII: "geholfen",
    cefrLevel: "A1",
    ipa: "ˈhɛlfn̩",
    grammarTip: "Dativ nesne alan en önemli fiillerdendir (jemandem helfen): du hilfst, er hilft, hat geholfen.",
    synonyms: ["unterstützen", "beistehen", "assistieren"],
    examples: [
      {
        de: "Kannst du mir bitte beim Tragen helfen?",
        tr: "Taşımada bana lütfen yardım edebilir misin?",
        en: "Can you please help me carry this?",
      },
      {
        de: "Die Lehrerin hat den Schülern geduldig geholfen.",
        tr: "Öğretmen öğrencilere sabırla yardım etti.",
        en: "The teacher patiently helped the students.",
      },
    ],
  }),
  makeVerbEntry({
    infinitive: "bleiben",
    praesensIch: "bleibe",
    praesensDu: "bleibst",
    praesensErSieEs: "bleibt",
    praeteritumIch: "blieb",
    auxiliary: "sein",
    partizipII: "geblieben",
    cefrLevel: "A1",
    ipa: "ˈblaɪ̯bn̩",
    grammarTip: "Durum bildirmesine rağmen Perfekt zamanda 'sein' yardımcı fiiliyle kullanılır (ist geblieben).",
    synonyms: ["verweilen", "ausharren"],
    examples: [
      {
        de: "Bei diesem Regen bleibe ich lieber zu Hause.",
        tr: "Bu yağmurda evde kalmayı tercih ederim.",
        en: "In this rain I prefer to stay at home.",
      },
      {
        de: "Wie lange seid ihr in Berlin geblieben?",
        tr: "Berlin'de ne kadar süre kaldınız?",
        en: "How long did you stay in Berlin?",
      },
    ],
  }),
];

/**
 * Recognizes leading "der ", "die ", "das " (case-insensitive) and returns { article, noun }.
 */
export function extractArticleAndNoun(germanPhrase: string): {
  article?: ArticleGender;
  noun: string;
} {
  const trimmed = germanPhrase.trim();
  const match = trimmed.match(/^(der|die|das)\s+(.+)$/i);
  if (match) {
    const article = match[1].toLowerCase() as ArticleGender;
    return {
      article,
      noun: match[2].trim(),
    };
  }
  return { noun: trimmed };
}

function stripUmlauts(value: string): string {
  return value
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");
}

function matchesTargetWord(token: string, cleanTarget: string): boolean {
  if (!cleanTarget) return false;
  const tokenLower = token.toLowerCase();
  const targetLower = cleanTarget.toLowerCase();

  if (tokenLower === targetLower) return true;
  if (targetLower.length < 2) return false;

  if (tokenLower.startsWith(targetLower) && tokenLower.length <= targetLower.length + 5) {
    return true;
  }

  // Handle German umlaut plurals / inflections (e.g., Buch -> Bücher, Haus -> Häuser, Apfel -> Äpfel)
  if (targetLower.length >= 3) {
    const baseToken = stripUmlauts(tokenLower);
    const baseTarget = stripUmlauts(targetLower);
    if (baseToken.startsWith(baseTarget) && baseToken.length <= baseTarget.length + 5) {
      return true;
    }
  }

  return false;
}

/**
 * Splits sentence into HighlightSegment[] so that segments.map(s => s.text).join("") === sentence.
 * Highlights German articles and occurrences of targetNoun.
 */
export function segmentSentenceWithArticleHighlights(
  sentence: string,
  targetNoun?: string,
  defaultArticle?: ArticleGender
): HighlightSegment[] {
  if (!sentence) return [];

  const extractedTarget = targetNoun ? extractArticleAndNoun(targetNoun) : undefined;
  const cleanTarget = extractedTarget?.noun ?? "";
  const effectiveTargetArticle = defaultArticle ?? extractedTarget?.article;

  const segments: HighlightSegment[] = [];
  const tokenRegex = /([A-Za-zÄÖÜäöüß]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushPlainText = (text: string) => {
    if (!text) return;
    const prev = segments[segments.length - 1];
    if (prev && !prev.isArticle && !prev.isTargetWord) {
      prev.text += text;
    } else {
      segments.push({ text });
    }
  };

  while ((match = tokenRegex.exec(sentence)) !== null) {
    const startIndex = match.index;
    if (startIndex > lastIndex) {
      pushPlainText(sentence.slice(lastIndex, startIndex));
    }

    const wordToken = match[1];
    const lowerToken = wordToken.toLowerCase();
    const inferredGender = ARTICLE_INFERRED_GENDER[lowerToken];

    if (inferredGender) {
      segments.push({
        text: wordToken,
        isArticle: true,
        articleGender: defaultArticle ?? inferredGender,
      });
    } else if (cleanTarget && matchesTargetWord(wordToken, cleanTarget)) {
      const segment: HighlightSegment = {
        text: wordToken,
        isTargetWord: true,
      };
      if (effectiveTargetArticle) {
        segment.articleGender = effectiveTargetArticle;
      }
      segments.push(segment);
    } else {
      pushPlainText(wordToken);
    }

    lastIndex = startIndex + wordToken.length;
  }

  if (lastIndex < sentence.length) {
    pushPlainText(sentence.slice(lastIndex));
  }

  return segments;
}

function cleanWikitextValue(raw: string): string {
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^/>]*\/>/gi, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''/g, "")
    .replace(/''/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTemplateParam(wikitext: string, paramPatterns: RegExp[]): string | undefined {
  for (const pattern of paramPatterns) {
    const match = wikitext.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanWikitextValue(match[1]);
      if (cleaned && cleaned !== "—" && cleaned !== "-" && cleaned !== "?") {
        return cleaned;
      }
    }
  }
  return undefined;
}

/**
 * Parses German Wiktionary wikitext for noun/verb grammar, IPA, examples, and synonyms.
 */
export function parseWiktionaryWikitext(
  word: string,
  wikitext: string
): {
  grammar: GermanGrammarInfo | null;
  rawExamples: string[];
  synonyms: string[];
} {
  if (!wikitext || !wikitext.trim()) {
    return { grammar: null, rawExamples: [], synonyms: [] };
  }

  const cleanWord = extractArticleAndNoun(word).noun || word.trim();

  // Extract IPA from {{Lautschrift|...}}
  let ipa: string | undefined;
  const ipaRegex = /\{\{\s*Lautschrift\s*\|\s*([^}|]+)\s*\}\}/gi;
  let ipaMatch: RegExpExecArray | null;
  while ((ipaMatch = ipaRegex.exec(wikitext)) !== null) {
    const candidate = ipaMatch[1].trim();
    if (candidate && candidate !== "…" && candidate !== "...") {
      ipa = candidate;
      break;
    }
  }

  // Extract examples under {{Beispiele}}
  const rawExamples: string[] = [];
  const beispieleMatch = wikitext.match(
    /\{\{\s*Beispiele\s*\}\}([\s\S]*?)(?=\n\{\{[A-ZÄÖÜa-zäöü]|\n={2,}|$)/
  );
  if (beispieleMatch?.[1]) {
    const lines = beispieleMatch[1].split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (/^:\s*\[[^\]]+\]/.test(trimmedLine)) {
        const withoutPrefix = trimmedLine.replace(/^:\s*(?:\[[^\]]*\]\s*)+/, "");
        const cleanedExample = cleanWikitextValue(withoutPrefix);
        if (cleanedExample && !rawExamples.includes(cleanedExample)) {
          rawExamples.push(cleanedExample);
        }
      }
    }
  }

  // Extract synonyms under {{Synonyme}}
  const synonyms: string[] = [];
  const synonymeMatch = wikitext.match(
    /\{\{\s*Synonyme\s*\}\}([\s\S]*?)(?=\n\{\{[A-ZÄÖÜa-zäöü]|\n={2,}|$)/
  );
  if (synonymeMatch?.[1]) {
    const lines = synonymeMatch[1].split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (/^:\s*\[[^\]]+\]/.test(trimmedLine)) {
        const linkRegex = /\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g;
        let linkMatch: RegExpExecArray | null;
        while ((linkMatch = linkRegex.exec(trimmedLine)) !== null) {
          const syn = linkMatch[1].trim();
          if (syn && !synonyms.includes(syn)) {
            synonyms.push(syn);
          }
        }
      }
    }
  }

  const isNoun =
    /\{\{\s*Wortart\s*\|\s*Substantiv\s*\|\s*Deutsch/i.test(wikitext) ||
    /\{\{\s*Deutsch Substantiv Übersicht/i.test(wikitext);

  const isVerb =
    /\{\{\s*Wortart\s*\|\s*Verb\s*\|\s*Deutsch/i.test(wikitext) ||
    /\{\{\s*Deutsch Verb Übersicht/i.test(wikitext);

  if (isNoun) {
    const genusRaw =
      extractTemplateParam(wikitext, [/\|\s*Genus(?:\s*1)?\s*=\s*([mfn])\b/i]) ??
      wikitext.match(
        /\{\{\s*Wortart\s*\|\s*Substantiv\s*\|\s*Deutsch\s*\}\}\s*,\s*\{\{\s*([mfn])\s*\}\}/i
      )?.[1];

    const genusChar = genusRaw?.toLowerCase();
    const article: ArticleGender =
      genusChar === "f" ? "die" : genusChar === "n" ? "das" : "der";

    const singularRaw = extractTemplateParam(wikitext, [
      /\|\s*Nominativ Singular(?:\s*1)?\s*=\s*([^\n|}]+)/i,
    ]);
    const singular = singularRaw
      ? extractArticleAndNoun(singularRaw).noun
      : cleanWord;

    const pluralRaw = extractTemplateParam(wikitext, [
      /\|\s*Nominativ Plural(?:\s*1)?\s*=\s*([^\n|}]+)/i,
    ]);
    let plural: string | undefined;
    if (pluralRaw && !/kein plural/i.test(pluralRaw)) {
      const cleanPlural = extractArticleAndNoun(pluralRaw).noun;
      plural = /^die\s+/i.test(pluralRaw) ? pluralRaw : `die ${cleanPlural}`;
    }

    const genitive = extractTemplateParam(wikitext, [
      /\|\s*Genitiv Singular(?:\s*1)?\s*=\s*([^\n|}]+)/i,
    ]);

    const nounGrammar: GermanNounGrammar = {
      article,
      genderLabel: GENDER_LABELS[article],
      singular,
      ...(plural ? { plural } : {}),
      ...(genitive ? { genitive } : {}),
    };

    const grammar: GermanGrammarInfo = {
      word: singular || cleanWord,
      pos: "noun",
      ...(ipa ? { ipa } : {}),
      noun: nounGrammar,
      ...(synonyms.length > 0 ? { synonyms } : {}),
    };

    return { grammar, rawExamples, synonyms };
  }

  if (isVerb) {
    const praesensIch = extractTemplateParam(wikitext, [
      /\|\s*Präsens_ich\s*=\s*([^\n|}]+)/i,
    ]);
    const praesensDu = extractTemplateParam(wikitext, [
      /\|\s*Präsens_du\s*=\s*([^\n|}]+)/i,
    ]);
    const praesensErSieEs = extractTemplateParam(wikitext, [
      /\|\s*Präsens_er,\s*sie,\s*es\s*=\s*([^\n|}]+)/i,
    ]);
    const praeteritumIch = extractTemplateParam(wikitext, [
      /\|\s*Präteritum_ich\s*=\s*([^\n|}]+)/i,
    ]);
    const partizipII = extractTemplateParam(wikitext, [
      /\|\s*Partizip II\s*=\s*([^\n|}]+)/i,
    ]);
    const hilfsverbRaw = extractTemplateParam(wikitext, [
      /\|\s*Hilfsverb\s*=\s*([^\n|}]+)/i,
    ]);

    const auxiliary: "haben" | "sein" =
      hilfsverbRaw && /^sein\b/i.test(hilfsverbRaw) ? "sein" : "haben";
    const aux3rd = auxiliary === "sein" ? "ist" : "hat";
    const perfekt = partizipII ? `${aux3rd} ${partizipII}` : undefined;

    const verbConjugation: GermanVerbConjugation = {
      infinitive: cleanWord.toLowerCase(),
      ...(praesensIch ? { praesensIch } : {}),
      ...(praesensDu ? { praesensDu } : {}),
      ...(praesensErSieEs ? { praesensErSieEs } : {}),
      ...(praeteritumIch ? { praeteritumIch } : {}),
      ...(perfekt ? { perfekt } : {}),
      ...(hilfsverbRaw || partizipII ? { auxiliary } : {}),
      ...(partizipII ? { partizipII } : {}),
    };

    const grammar: GermanGrammarInfo = {
      word: cleanWord.toLowerCase(),
      pos: "verb",
      ...(ipa ? { ipa } : {}),
      verb: verbConjugation,
      ...(synonyms.length > 0 ? { synonyms } : {}),
    };

    return { grammar, rawExamples, synonyms };
  }

  return { grammar: null, rawExamples, synonyms };
}

/**
 * Looks up a German word (with or without leading article, case-insensitive) in the curated lexicon.
 */
export function lookupCuratedGermanGrammar(queryWord: string): {
  grammar: GermanGrammarInfo;
  examples: Array<{ de: string; tr: string; en: string }>;
} | null {
  if (!queryWord || !queryWord.trim()) return null;

  const { noun: cleanQuery } = extractArticleAndNoun(queryWord);
  const targetLower = cleanQuery.toLowerCase();
  if (!targetLower) return null;

  const found =
    CURATED_GERMAN_LEXICON.find(
      (entry) => entry.grammar.word.toLowerCase() === targetLower
    ) ??
    CURATED_GERMAN_LEXICON.find((entry) => {
      const plural = entry.grammar.noun?.plural;
      if (!plural) return false;
      return extractArticleAndNoun(plural).noun.toLowerCase() === targetLower;
    });

  if (!found) return null;

  return {
    grammar: {
      ...found.grammar,
      ...(found.grammar.noun ? { noun: { ...found.grammar.noun } } : {}),
      ...(found.grammar.verb ? { verb: { ...found.grammar.verb } } : {}),
      ...(found.grammar.synonyms ? { synonyms: [...found.grammar.synonyms] } : {}),
    },
    examples: found.examples.map((ex) => ({ ...ex })),
  };
}

function buildWiktionaryApiUrl(pageTitle: string): string {
  return `https://de.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(
    pageTitle
  )}&prop=wikitext&format=json`;
}

function extractWikitextFromApiResponse(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      parse?: {
        wikitext?: { "*"?: string } | string;
      };
    };
    const wt = parsed?.parse?.wikitext;
    if (typeof wt === "string") return wt;
    if (wt && typeof wt === "object" && typeof wt["*"] === "string") {
      return wt["*"];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches German Wiktionary data for a word, trying capitalized form if lowercase fails,
 * and merging with curated German lexicon data when available.
 */
export async function fetchGermanWiktionary(
  network: NetworkLike,
  germanWord: string
): Promise<{
  grammar: GermanGrammarInfo | null;
  rawExamples: string[];
  synonyms: string[];
}> {
  const { noun: cleanWord } = extractArticleAndNoun(germanWord);
  if (!cleanWord) {
    return { grammar: null, rawExamples: [], synonyms: [] };
  }

  const curated = lookupCuratedGermanGrammar(cleanWord);

  const tryFetchAndParse = async (pageTitle: string) => {
    try {
      const response = await network.fetch(buildWiktionaryApiUrl(pageTitle));
      if (!response.ok || !response.body) return null;
      const wikitext = extractWikitextFromApiResponse(response.body);
      if (!wikitext) return null;
      const parsed = parseWiktionaryWikitext(pageTitle, wikitext);
      if (!parsed.grammar && parsed.rawExamples.length === 0 && parsed.synonyms.length === 0) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  let wikiResult = await tryFetchAndParse(cleanWord);

  if (!wikiResult || !wikiResult.grammar) {
    const capitalized = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
    if (capitalized !== cleanWord) {
      const capResult = await tryFetchAndParse(capitalized);
      if (capResult && (capResult.grammar || !wikiResult)) {
        wikiResult = capResult;
      }
    } else {
      const lowercased = cleanWord.toLowerCase();
      if (lowercased !== cleanWord) {
        const lowResult = await tryFetchAndParse(lowercased);
        if (lowResult && (lowResult.grammar || !wikiResult)) {
          wikiResult = lowResult;
        }
      }
    }
  }

  if (!wikiResult && !curated) {
    return { grammar: null, rawExamples: [], synonyms: [] };
  }

  const mergedSynonyms: string[] = [];
  for (const syn of [
    ...(wikiResult?.synonyms ?? []),
    ...(curated?.grammar.synonyms ?? []),
  ]) {
    if (syn && !mergedSynonyms.includes(syn)) {
      mergedSynonyms.push(syn);
    }
  }

  const mergedExamples: string[] = [];
  for (const ex of [
    ...(wikiResult?.rawExamples ?? []),
    ...(curated?.examples.map((e) => e.de) ?? []),
  ]) {
    if (ex && !mergedExamples.includes(ex)) {
      mergedExamples.push(ex);
    }
  }

  let mergedGrammar: GermanGrammarInfo | null = null;
  if (wikiResult?.grammar && curated?.grammar) {
    const wg = wikiResult.grammar;
    const cg = curated.grammar;
    mergedGrammar = {
      ...cg,
      ...wg,
      cefrLevel: wg.cefrLevel ?? cg.cefrLevel,
      ipa: wg.ipa ?? cg.ipa,
      grammarTip: wg.grammarTip ?? cg.grammarTip,
      noun: wg.noun
        ? {
            ...cg.noun,
            ...wg.noun,
            plural: wg.noun.plural ?? cg.noun?.plural,
            genitive: wg.noun.genitive ?? cg.noun?.genitive,
          }
        : cg.noun,
      verb: wg.verb
        ? {
            ...cg.verb,
            ...wg.verb,
          }
        : cg.verb,
      synonyms: mergedSynonyms.length > 0 ? mergedSynonyms : undefined,
    };
  } else if (wikiResult?.grammar) {
    mergedGrammar = {
      ...wikiResult.grammar,
      ...(mergedSynonyms.length > 0 ? { synonyms: mergedSynonyms } : {}),
    };
  } else if (curated?.grammar) {
    mergedGrammar = {
      ...curated.grammar,
      ...(mergedSynonyms.length > 0 ? { synonyms: mergedSynonyms } : {}),
    };
  }

  return {
    grammar: mergedGrammar,
    rawExamples: mergedExamples,
    synonyms: mergedSynonyms,
  };
}
