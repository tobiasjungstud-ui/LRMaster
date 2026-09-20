# LRMaster – Listening & Reading Creator

Erzeugt aus dem Vokabular eines Lehrmittels (z. B. *English Plus 4 → Unit 1*) didaktisch kontrollierbare **Listenings** und **Readings** inklusive Worksheet, Lösungsschlüssel und Qualitätskontrolle. Das Sprachmodell (Claude) wird direkt aus dem veröffentlichten Artifact über die `sample`-Capability von Claude.ai angesprochen; es gibt keine hartkodierten Texte, Fragen, Instruktionen oder Themenvorschläge – alles Generierte kommt aus Claude und wird anschließend gemessen und bewertet.

Konzept: [`docs/Konzept_Listening_Reading_Creator.md`](docs/Konzept_Listening_Reading_Creator.md) · Abdeckung: [`CONCEPT_COVERAGE.md`](CONCEPT_COVERAGE.md) · Veröffentlichtes Artifact: https://claude.ai/artifact/Hk9g1UZhmWbpgcMUScbZey

## Aufbau

```
app/
  index.html    Seite (als Artifact veröffentlicht; Start, Creator, Vocabulary-Manager, Materialien, Konzept-Check)
  styles.css    Design-Tokens (hell/dunkel), Layout, Druck
  core.js       Settings-Schema, Defaults, Ableitungen (Wortzahl, Sprechanteile, Skill-Mix, Formate, Plan), Validierung, Presets, Beispielkonfiguration
  prompts.js    Prompt-Builder: jede Einstellung wird in eine Anweisung an Claude übersetzt (Topic, Content, Fragen, Review, Revision, Vokabel-Import)
  quality.js    Normalisierung der Claude-Antworten + Qualitätsregeln (§29): deterministisch gemessen oder per Claude-Review beurteilt
  render.js     Student Version / Teacher Version / Markdown-Export, Textlayout je Texttyp
  docx.js       Word-Writer (OOXML + ZIP, ohne Abhängigkeiten): Absätze, Tabellen, Spalten, Initialen, Seitenzahlen
  word.js       Dokument-Designs je Texttyp (Artikel, E-Mail, Forum, Tagebuch …), Arbeitsblatt und Lehrerversion als .docx
  ooxml.js      Validator für die erzeugten Word-Pakete (Teile, Content-Types, Beziehungen, Elementreihenfolge)
  vocab.js      Import von CSV/TSV/TXT/XLSX-Wortlisten, Unit-Erkennung, Gruppierung nach Claudes Vorschlag, Zusammenführen/Ersetzen
  controls.js   Rendert das Creator-Formular aus dem Schema (jedes Setting → data-setting-Steuerelement)
  manifest.js   Konzept-Manifest: jede Anforderung aus §1–§32 mit ID, Art und maschineller Prüfung
  checks.js     Führt das Manifest gegen den echten Code aus (Node + Browser)
  fixture.js    Beispiel-Lehrmittel (als Beispiel markiert) und Test-Material für Renderer-/Regelprüfungen
  ui.js         DOM, Speicher (db-Capability, Fallback localStorage), Claude-Aufrufe, Generierungs-Pipeline
tests/run.js    Unit-Tests + Konzept-Abdeckung (npm test)
scripts/coverage-report.js  schreibt CONCEPT_COVERAGE.md (npm run coverage)
```

## Generierungs-Pipeline (`generate()` in `ui.js`)

1. **Plan** – Validierung, Zielwortzahl (Audio-Länge × Sprechtempo bzw. Wortzahl/A4), Sprecher-Labels und -anteile, Skill-Mix (automatisch nach Schwierigkeit oder manuell), Format-Verteilung, Fragen-Niveau (CEFR-Band unabhängig vom Textniveau; als Meta-Einstellung *Niveau A* = B1.2–B2.1, *Niveau B* = B1.1 oder *Beide* mit je einem Plan pro Fragebogen).
2. **Content** – Claude schreibt Skript/Text als JSON (Sprecherzeilen mit optionalem Emotion-Tag bzw. Absätze).
3. **Content-Prüfung** – gemessen: Wortzahl, Sprechanteile, Sprecher-Labels, Tag-Dichte, Turn-Länge/Variabilität, Zielvokabular und – mit dem **Schwierigkeitsmesser** (siehe unten) – das erreichte CEFR-Niveau gegen das gewählte. Abweichungen werden mit konkreten Vorgaben („Sätze kürzen: Ziel 9–10 Wörter“, „Schwere Wörter ersetzen: subtle, questionable …“) in die Textüberarbeitung gegeben.
4. **Aufgaben** – Claude erstellt Fragen mit vorgegebener Anzahl je Skill und Format, CEFR-Difficulty innerhalb des Fragen-Niveaus, wörtlichem Evidenz-Zitat, Referenz und Begründung; separat Higher-Order-Aufgaben und Pre-Tasks. Bei *Beide* wird der Schritt pro Niveau durchlaufen.
5. **Reihenfolge (immer)** – jeder eingehende Fragebogen wird deterministisch in die Reihenfolge des Materials gebracht (Evidenz-Position, Gist nur am Anfang/Ende) und neu nummeriert; die Prüfregel dazu ist blockierend und schlägt auch an, wenn ein Beleg nicht wörtlich gefunden wird.
6. **Aufgaben-Prüfung** – gemessen: Anzahl, Skill-Verteilung (Summen), erlaubte Formate und Format-Verteilung, Chronologie, Stufe je Frage innerhalb des erlaubten Fragen-Niveaus, Duplikate, auffindbare Evidenz, Higher-Order getrennt, Pre-Task-Typen.
7. **Claude-Review** – Beurteilung der Regeln, die Lesen erfordern (Eindeutigkeit, Ableitbarkeit, Distraktoren, Niveau, echte Inferenz, Natürlichkeit, Thema, keine Spoiler im Pre-Task).
8. **Automatische Korrektur** – siehe unten: beanstandete Fragen werden gezielt ersetzt, der Text bei Bedarf überarbeitet, danach wird erneut geordnet, gemessen und geprüft.
9. **Pre-Task** (Option, siehe unten) – Aufgaben vor dem Hören/Lesen; Typ, Sozialform, Arbeitsweise und Zeit sind pro Aufgabe geplant, werden geprüft und bei Bedarf gezielt neu erstellt, ohne die Fragen anzutasten.
10. **Post-Task** (Option, siehe unten) – Aufgaben nach dem Hören/Lesen, geplant und geprüft wie die Pre-Task, aber mit umgekehrter Anforderung: sie müssen am Material ansetzen und über die Verständnisfragen hinausgehen.
11. **Fremdwörter** (Option) – der Messer wählt die Wörter über dem Niveau (ohne Zielvokabular), Claude erklärt sie in einfachem Englisch mit deutscher Entsprechung; das Glossar steht auf Seite 1 des Fragebogens.
12. **Ausgabe** – Student Version (ohne Skript beim Listening, ausser die Option *Skript auf der letzten Seite* ist gewählt; bei *Beide* eine Version pro Niveau), Teacher Version (Skript mit Zeilennummern und Vokabel-Highlight, verwendete Items, Messung, Lösungsschlüssel je Niveau mit Skill/Difficulty/Evidenz/Begründung, Qualitätsbericht), Prompts und JSON; Download als **Word (.docx)** (Schülerversion A/B, Lehrerversion), HTML, Markdown oder JSON, Druck, Speicherung.

## Pre-Task und Post-Task (Aufgaben vor und nach dem Hören/Lesen)

Beide Phasen laufen über **dieselbe geprüfte Mechanik** (`core.buildTaskPlan`, `quality.taskRules`, gemeinsamer Reparaturweg) und haben je einen eigenen Creator-Bereich.

**Bedienung:** Jeder Bereich beginnt mit einer **Schnellwahl** – typischen Aufgabenfolgen, wie eine Lehrperson eine Lektion plant. Ein Klick setzt Aufgabentypen, Sozialformen, mündlich/schriftlich, Zeit und Anforderungsniveau:

| Pre-Task | Post-Task |
|---|---|
| Keine Pre-Task · Kurzer Einstieg (1 Aufgabe, Partnerarbeit, mündlich, 5 min) · Konfrontation (These beziehen, dann Vermutungen, 8 min) · Wortschatz vorentlasten (Wortfeld und Zielwörter, schriftlich, 8 min) · Sprechen aktivieren (Umfrage und Sprechimpuls, 10 min) | Keine Post-Task · Kurze Sicherung (8 min) · Diskussion & Position (Debatte, dann Stellungnahme, 20 min) · Schreibprodukt (25 min) · Sprachmittlung & Feedback (20 min) · Transfer & Recherche (30 min) |

Darunter steht die **Vorschau der geplanten Abfolge** – Aufgabe für Aufgabe mit Sozialform, Arbeitsweise und Minuten, dazu die Gesamtzeit, das Sprachniveau und sofort sichtbare Probleme („3 mündlich, aber nur 1 interaktive Sozialform“). Schnellwahl und Vorschau sind **auch im Simple Mode** bedienbar; der Advanced Mode öffnet zusätzlich jede Einzeleinstellung, und sobald man dort etwas ändert, gilt die Folge als eigener Mix. Zu viele mündliche Aufgaben werden automatisch auf die Anzahl Aufgaben begrenzt.

### Pre-Task

Eigener Creator-Bereich mit denselben kriterienorientierten Einstellungen wie die Fragen:

| Einstellung | Bedeutung |
|---|---|
| Fokus | Thema, Zielvokabular oder beides – bei „Wortschatz“ und „beides“ muss nachweislich mit den Unit-Wörtern gearbeitet werden |
| Anzahl | 1–6 Aufgaben |
| Aufgabentypen | **Konfrontationsaufgabe** (zugespitzte These/Dilemma, beidseitig vertretbar), Vorwissen aktivieren, Wortfeld/Brainstorming, Ranking/Positionierung, Klassenumfrage, Sprechimpuls, Wortschatz vorentlasten, Fragen & Hypothesen, Prediction. Die gewählten Typen werden reihum verteilt, in didaktischer Reihenfolge |
| Sozialformen | automatisch verteilt oder selbst gesetzt: wie viele **Einzel-, Partner-, Gruppen- und Plenumsarbeiten** |
| Davon mündlich | wie viele Aufgaben rein mündlich gelöst werden; mündliche Aufgaben bekommen immer eine interaktive Sozialform (sonst greift die Validierung) |
| Anforderungsniveau | reproduktiv (sammeln, zuordnen) → anwenden und verknüpfen → begründen und abwägen → Position beziehen |
| Hilfestellungen | Beispiel, Wortspeicher, Satzanfänge, Musterlösung – erscheinen als Elemente unter der Aufgabe |
| Sprachniveau | Aufgabenstellung wie die Fragen, Niveau A oder B (die Klasse liest sie, bevor sie das Material kennt) |
| Gelingenskriterien | 2–3 beobachtbare Kriterien in Schülersprache pro Aufgabe |
| Zeitbudget | Minuten insgesamt, auf die Aufgaben verteilt und auf dem Arbeitsblatt ausgewiesen |

Typ, Sozialform, Arbeitsweise und Zeit sind pro Aufgabenposition **fest geplant** und werden Claude so übergeben – damit lässt sich jede davon deterministisch nachprüfen.

**Kontrollmechanismen** (Gruppe „Pre-Task“ im Qualitätsbericht): `pretask.present` (Anzahl und Typ je Position, blockierend), `pretask.social_forms` (Sozialformen und deren Anzahl, blockierend), `pretask.modes` (mündlich/schriftlich wie eingestellt, nie mündlich in Einzelarbeit, blockierend), `pretask.focus` (Wortschatzaufgaben verwenden das Zielvokabular, Themenaufgaben das Thema), `pretask.criteria` (Gelingenskriterien vorhanden und kurz), `pretask.time` (Zeitangaben im Budget), `pretask.language` (Wörter über dem eingestellten Niveau in der Aufgabenstellung – mit dem Schwierigkeitsmesser gemessen) sowie vier Claude-Prüfungen: `pretask.no_spoilers` (nimmt keine Antwort vorweg, blockierend), `pretask.solvable_before` (ohne das Material lösbar, blockierend), `pretask.social_fits` (Sozialform und Arbeitsweise passen zur Aufgabe), `pretask.confrontation` (die Konfrontationsaufgabe konfrontiert wirklich – nur aktiv, wenn eine geplant ist).

### Post-Task

Dieselben Einstellungen (Anzahl, Sozialformen, mündlich/schriftlich, Anforderungsniveau, Hilfen, Sprachniveau, Gelingenskriterien, Zeitbudget) – mit eigener Typenliste und umgekehrter Logik: Die Aufgaben **setzen am Material an** und gehen **über die Verständnisfragen hinaus**.

| Einstellung | Bedeutung |
|---|---|
| Fokus | Inhalt weiterdenken · Zielvokabular produktiv anwenden · beides |
| Aufgabentypen | Diskussion, **Debatte (Pro/Contra)**, Rollenspiel/Simulation, Transfer auf die eigene Lebenswelt, **Sprachmittlung/Zusammenfassung**, Stellungnahme, kreatives Produkt, Wortschatz anwenden, Mini-Recherche, Partnerfeedback |
| Anforderungsniveau | wiedergeben und ordnen → eng anwenden → übertragen und verknüpfen → eigenes Produkt und Position → bewerten, kritisieren, frei gestalten |

Jede Post-Task-Aufgabe nennt zusätzlich ihren **Ansatzpunkt im Material** (`reference`) und ihr **Produkt** (`product`, was am Ende abgegeben oder gezeigt wird).

**Kontrollen Post-Task:** dieselben sieben deterministischen Regeln wie oben (`posttask.present`, `social_forms`, `modes`, `focus`, `criteria`, `time`, `language`) plus `posttask.product` (Ansatzpunkt und Produkt benannt) sowie die Claude-Prüfungen `posttask.uses_material` (setzt nachweislich am Material an, blockierend), `posttask.beyond_questions` (lässt sich nicht durch Wiederholen einer Verständnisfrage lösen, blockierend), `posttask.social_fits` und `posttask.mediation` (Adressat und Zweck genannt – nur aktiv, wenn eine Sprachmittlung geplant ist).

**Gezielte Korrektur:** Pre-Task- und Post-Task-Befunde haben je einen eigenen Reparaturweg. Claude bekommt Material, die fertigen Fragen (bei der Pre-Task »nimm davon nichts vorweg«, bei der Post-Task »wiederhole sie nicht«), die aktuellen Aufgaben und die Befunde im Wortlaut und schreibt nur diese Phase neu; Fragen und die jeweils andere Phase bleiben unangetastet. Übernommen wird auch hier nur, was die Prüfung verbessert.

## Vorlagen: fertige Konfigurationen, in Worten beschrieben

Über dem Formular steht die **Vorlagen-Galerie**: je sechs vollständige Konfigurationen pro Materialart, die sich in *allen* Bereichen unterscheiden – Thema und Inhalt, Sprachniveau und Satzbau, Wortschatz und Idiomatik, Explizitheit, Aufbau, Zielvokabular, Fragen und Formate, Higher-Order, beide Aufgabenphasen und die Extras.

| Listening | Reading |
|---|---|
| Podcast-Interview (B1.2) · Alltagsgespräch im Café (A2.2) · Radio-Nachricht (B2.1) · Streitgespräch, 3 Stimmen (B2.1) · Telefonat mit dem Kundendienst (B1.1) · Erzählung/Anekdote (B1.1) | Horror-Blogpost (B2.2) · Zeitungsmeldung (B2.1) · E-Mail an die Gastfamilie (A2.2) · Forumsthread (B1.1) · Kurzgeschichte mit offenem Ende (B1.2) · Serien-Kritik (B1.2) |

Ganz oben auf jeder Karte stehen die wichtigsten Angaben als **kurze Tags** – `B2.2` `380 Wörter` `Blog Post` `10 Fragen · Niveau A` `Pre 8 min` `Post 25 min` –, darunter die vollständige Konfiguration **in Worten, aus den Einstellungen selbst erzeugt** (`core.describeSetup` und `core.tagsFor`), also nie abweichend von dem, was wirklich generiert wird:

```
· Blog Post · Thema: the horror genre: why people enjoy being scared …
· 380 Wörter · mittlere Absätze · eher erzählend
· Sprachniveau B2.2 · volles Strukturrepertoire · sehr anspruchsvoller Wortschatz
· Idiomatik häufig · Informationen oft implizit
· Zielvokabular: 8–12 Wörter aus der Unit · deutlich eingesetzt
· 10 Fragen · Niveau A (B1.2–B2.1) · Inferenz sehr anspruchsvoll · 4 Formate
· 2 Higher-Order-Aufgaben: interpretation, evaluation
· Pre-Task: Konfrontation + Prediction · 2 Aufgaben, 8 min, 1 mündlich
· Post-Task: Kreativ + Wortschatz · 2 Aufgaben, 25 min, 0 mündlich
· Extras: Fremdwörter erklärt · Text im echten Layout (Bild) · Schwierigkeit wird gemessen
```

**Redo pro Karte:** Der Knopf ↻ oben rechts lässt Claude **eine neue Variante genau dieser Vorlage** vorschlagen – ein anderer Inhalt im selben Geist, dazu leicht verschobene Regler. Festgelegt bleibt, was die Vorlage ausmacht: Materialart, CEFR-Niveau, Textsorte/Format sowie Fragen und Aufgabenphasen. Übernommen wird nur, was auf der Erlaubnisliste steht (Thema, Länge und einige Regler, jeweils gekappt) **und** eine gültige Konfiguration ergibt; sonst bleibt die Karte, wie sie war. Die gezogenen Varianten gelten für die laufende Sitzung.

**Solange eine Vorlage gewählt ist, bleiben die Einzeleinstellungen vollständig zugeklappt** – sichtbar sind nur Lehrmittel/Unit, die Zusammenfassung „Das wird erzeugt“ und der Generate-Bereich. Zwei Schaltflächen öffnen sie: **„Vorlage anpassen“** (alle Felder mit den Werten der Vorlage als Ausgangspunkt) und **„Alles selbst einstellen“** (alle Felder ab Standardwerten). **„Zurück zu den Vorlagen“** klappt wieder zu; die Werte bleiben erhalten. Sobald etwas verändert wird, gilt die Vorlage als angepasst.

## Authentisches Layout: der Text als Screenshot seines Mediums

Für Reading-Texte standardmässig an (Schalter *Text im echten Layout zeigen*). Nach dem Schreiben des Textes gestaltet Claude die **Oberfläche des Mediums**, in dem der Text wirklich erscheinen würde – Adressleiste, Seitenname, Navigation, Buttons mit Zahlen, „Meistgelesen“-Kasten, Mail-Ordner, Forum-Angaben, Chat-Kopfzeile. Die App zeichnet daraus ein **echtes Bild**: eigener Tab *Layout*, Download als PNG.

**Bildschirm oder Papier.** Presseerzeugnisse erscheinen als **abfotografierte Seite**, Online-Formate als **Screenshot** – einstellbar über *Medium des Bildes* (Automatisch · Bildschirm · Papier), auch direkt im Layout-Tab umschaltbar:

| Papier (abfotografiert) | Bildschirm (Screenshot) |
|---|---|
| **Zeitungsseite** (News Article: Zeitungskopf, Doppellinien, Schlagzeile, Vorspann, Halbton-Pressefoto mit Bildlegende, dreispaltiger Satz mit Spaltenlinien, Seitenfuss) · **Magazinseite** (Article, zweispaltig) · **Kommentarseite** (Opinion Text) · **Kritik im Blatt** (Review) · **Interview im Blatt** · **Buchseite** (Story: Kolumnentitel, eingezogene Absätze, Seitenzahl) · **Tagebuchseite** (Diary: liniertes Papier, roter Rand, Handschrift) · **Bericht/Infoblatt** (Report, Informational Text) | **Browserfenster** (Blog Post, Custom) · **Mailprogramm** (E-Mail) · **Forum-Thread** · **Messenger** (Dialog) |

Jede Papierseite liegt leicht gedreht auf einer Unterlage, mit Papierkorn, Schlagschatten und Vignette – wie mit dem Handy abfotografiert. Jeder Bildschirmtyp hat eigene Typografie, Akzentfarbe und Interface. Jedes Format lässt sich zusätzlich auf Papier zwingen (dann als ausgedruckte Seite).

**Jedes Medium ist im Detail gebaut wie das echte** – nicht als neutraler Kasten mit Text darin:

| Medium | Woran man es erkennt |
|---|---|
| Blog / Nachrichtenseite / Kritik | Browserfenster mit Tableiste, Favicon, Zurück-Pfeilen, Schloss und Adresse · Logomarke, Zeile unter dem Namen, Navigation mit aktiver Rubrik · Rubrikenpille, Schlagzeile, Vorspann, Autorenzeile mit Avatar und Merken/Teilen · Aufmacherbild mit Legende und Bildnachweis · Initial im ersten Absatz, Zitatblock, #Tags · Aktionsleiste mit Herz-, Kommentar-, Teilen- und Merken-Symbol samt Zahlen · Spalte „Meistgelesen“ mit Vorschaubildern, Anzeigenplatz, dunkler Fuss mit Links |
| Mailprogramm | Fensterleiste mit Suchfeld · runder Verfassen-Knopf, Ordner mit Symbolen · Werkzeugleiste (zurück, archivieren, löschen, antworten, weiterleiten) · Betreff mit Stern und Etiketten · Absender mit Avatar, Anhangskarte, zusammengeklapptes Zitat, Antwort-Knöpfe |
| Forum-Thread | Board-Kopf mit Logo und Suche · Sortier-Reiter · Stimmpfeile mit Zahl, farbige Avatare, Abzeichen (OP, Mod) · eingerückte Antworten mit Linie · Antwortzeile, Info-Kasten zum Board |
| Messenger | Statusleiste mit Uhr, Empfang und Akku · grüner Kopf mit Zurück-Pfeil, Avatar, Status, Video-/Telefon-/Menü-Symbol · gemustertes Hintergrundbild · Datumspille · Sprechblasen mit Spitze, Uhrzeit und blauen Doppelhäkchen · Eingabeleiste mit Klammer, Kamera und Mikrofon |
| Zeitung / Magazin | Kolumnentitel, Stehsatz zwischen Linien, farbige Schlagzeile, Vorspann · Pressefoto mit Legende und Nachweis · **Blocksatz** in zwei bis drei Spalten mit Spaltenlinien und nummerierten Absätzen · Zitatkasten oder Hausanzeige im Spaltenfuss |
| Buchseite | schmaler, **blockgesetzter** Satzspiegel, Kapitelzeile mit Ornament, Initial, eingezogene Absätze, Bundschatten am Innenrand, Seitenzahl |
| Heft- / Tagebuchseite | Lineatur, auf der die Schrift wirklich sitzt, roter Rand, Lochung, Handschrift mit leichter Unruhe |
| Blatt / Bericht | Briefkopf mit Logomarke und Akzentlinie, Datumszeile, Fusszeile mit Seitenpille, Heftklammer in der Ecke |

**Das Bild hängt an keinem Claude-Aufruf.** Gezeichnet wird es immer aus dem Material selbst: Publikation, Autorenzeile, Datum, Lesezeit, Sprecher und Zeitstempel stammen aus den bereits generierten Dokument-Angaben (`mock.fallbackChrome`). Claude **reichert** diese Oberfläche nur an (Adresse, Navigation, Buttons mit Zahlen, „Meistgelesen“, Bildlegende, Ausgabenzeile); fällt der Aufruf aus, entsteht das Bild trotzdem – nur schlichter, und der Qualitätsbericht vermerkt, was fehlt.

Das Bild entsteht nicht aus einer Bildgenerierung, sondern wird aus dem Text und Claudes Layoutdaten in der App komponiert (`mock.js` baut ein Zeichenmodell, das auf ein Canvas gezeichnet und als PNG ausgegeben wird). Genau deshalb lässt sich prüfen, **dass Bild und Text übereinstimmen**:

- `layout.text_identical` (blockierend): Der im Bild gezeichnete Fliesstext ist Wort für Wort der generierte Text – kein Absatz fehlt, kein Wort kommt dazu.
- `layout.fields` (blockierend): Die Oberfläche des Mediums ist vollständig (z. B. Adresse, Seitenname, Navigation, Buttons).
- `layout.no_invented_text`: Die Oberfläche erzählt den Text nicht nach (kein Satzstück von sechs Wörtern aus dem Text in Sidebar, Titeln oder Buttons).
- `layout.image_valid` (blockierend): Das Bild ist zeichenbar – Grösse plausibel, nichts ausserhalb der Fläche; vor dem PNG-Download wird erneut geprüft und bei einem Problem nichts ausgeliefert.
- `layout.authentic` (Claude): Wirkt die Oberfläche wie ein echtes Beispiel dieses Mediums und passt sie zum Text (Namen, Orte, Daten)?

Abweichungen gehen in dieselbe automatische Korrektur wie alles andere: Claude bekommt die Befunde und gestaltet die Oberfläche neu; übernommen wird nur, was die Prüfung verbessert.

## Schwierigkeitsmesser (`level.js`, `wordlist.js`)

Der Messer bestimmt das CEFR-Niveau eines Skripts oder Texts auf der Sechser-Skala A2.1–B2.2 aus sieben Dimensionen und liefert je Dimension Wert, Stufe und Korrekturhinweis:

| Dimension | Mass | A2.1 | A2.2 | B1.1 | B1.2 | B2.1 | B2.2 |
|---|---|---|---|---|---|---|---|
| Satzlänge | Wörter/Satz | ≤ 7 | ≤ 9 | ≤ 10 | ≤ 12.5 | ≤ 17 | > 17 |
| Wortschatz jenseits 2000 | % der Inhaltswörter mit NGSL-Rang > 2000 | ≤ 4 | ≤ 7 | ≤ 10 | ≤ 14 | ≤ 20 | > 20 |
| Seltener Wortschatz | % mit Rang > 3500 oder ausserhalb der Liste | ≤ 0.6 | ≤ 1.2 | ≤ 1.8 | ≤ 3 | ≤ 6 | > 6 |
| Nebensätze | Subordinatoren, Relativ- und that-Sätze pro Satz | ≤ 0.05 | ≤ 0.12 | ≤ 0.18 | ≤ 0.32 | ≤ 0.55 | > 0.55 |
| Anspruchsvolle Grammatik | Passiv, Perfekt, Konditionale, Spaltsätze, Vergleiche, Inversion pro 100 Wörter | ≤ 0.5 | ≤ 1.2 | ≤ 2.1 | ≤ 3.2 | ≤ 4.5 | > 4.5 |
| Phrasal Verbs & Idiome | pro 100 Wörter (gering gewichtet: Register) | ≤ 0.2 | ≤ 0.5 | ≤ 0.9 | ≤ 1.9 | ≤ 3 | > 3 |
| Beitragslänge (Listening) | Wörter/Sprecherbeitrag | ≤ 13 | ≤ 20 | ≤ 30 | ≤ 38 | ≤ 50 | > 50 |

Die Werte werden zwischen den Schwellen interpoliert und gewichtet (Satzlänge 0.2, Wortschatz 0.2/0.1, Nebensätze 0.15, Grammatik 0.15, Idiome 0.05, Beiträge 0.15) zu einem Score 0–5 verrechnet; die Streuung der Dimensionen ergibt die Sicherheit. Regieanweisungen wie `[laughs]`, Sprechernamen, Eigennamen und Kontraktionen werden nicht gezählt; ein Lemmatisierer führt Flexionsformen, britische Schreibungen (*humour → humor*), Komposita (*seventeen-year-old*) und Ableitungen (*unmotivated*) auf die Liste zurück.

**Datenbasis**: Häufigkeitsränge der New General Service List 1.01 (Browne, Culligan & Phillips; CC BY-SA 4.0, 11 996 Lemmata, `wordlist.js`). Die Rangbänder wurden gegen die CEFR-Etiketten der Oxford 3000/5000 kalibriert (A1-Wörter: Median-Rang 645, A2 1324, B1 1684, B2 2438, C1 4005 ⇒ Bänder bei 1000 / 2000 / 3500); 390 A1/A2-Wörter und 128 B1-Wörter, die der Korpus tiefer einstuft (*pizza, café, castle*), erhalten Überschreibungen.

**Ankerpunkt**: Das Podcast-Skript *Screen Time* (356 Wörter, 10 Beiträge) wurde von der Lehrperson mit **B1.2** eingeschätzt; die Schwellen sind so gesetzt, dass es B1.2 misst und die im Test hinterlegten A2-, B1-, B2.1- und B2.2-Referenztexte monoton darunter bzw. darüber liegen (`tests/run.js`, Manifest §34). Die Stufen sind mit den Deskriptoren des GER-Begleitbands (Hör- und Leseverstehen, A2/A2+/B1/B1+/B2/B2+) und den sprachlichen Merkmalen hinterlegt, die der Prompt als Zielvorgaben erhält.

**Einbindung**: (1) Der Content-Prompt enthält die numerischen Ziele des gewählten Niveaus. (2) Die Regel `content.level_measured` vergleicht die Messung mit dem Ziel – Warnung bei einer Stufe, Fehler ab zwei – und liefert die Korrekturhinweise an die Textüberarbeitung. (3) Die Messung erscheint im Quality-Tab (Skala mit Marker, Dimensionen, Strukturen, schwere Wörter), in der Lehrerversion und im Word-Export. (4) Die Seite **Niveau messen** misst beliebige eingefügte Skripte oder Texte und holt auf Wunsch eine Zweitmeinung von Claude mit denselben Deskriptoren ein. Der Schalter *Schwierigkeit messen und nachsteuern* (Section Language) schaltet Vorgaben und Regel ab.

## Automatische Korrektur statt Fehlerliste

Befunde der Qualitätskontrolle werden nicht nur gemeldet, sondern behoben. Einstellbar unter *Advanced Settings → Qualität*: **Aus**, **Fehler beheben** oder **Fehler und Warnungen beheben** (Standard), mit einer Höchstzahl an Korrekturrunden (Standard 2).

Ablauf pro Runde:

1. Die Befunde werden aufgeteilt: Probleme, die einzelne Fragen betreffen (mit Fragenummern aus Messung oder Claude-Review), und Probleme, die Text oder ganzes Arbeitsblatt betreffen.
2. **Gezielter Ersatz**: Claude bekommt das Material, alle übrigen Fragen samt Antworten („das testen die anderen schon – teste etwas anderes“), den konkreten Befund im Wortlaut, sowie Skill, Format und Niveau, die für diese Nummer vorgesehen sind. Zurück kommen nur die ersetzten Fragen; Nummerierung, Skill und Format bleiben erhalten, alle anderen Fragen bleiben unangetastet.
3. Struktur- oder Textprobleme (falsche Fragenzahl, Skill-Verteilung, inkohärenter Text) lösen eine vollständige Überarbeitung aus; ein gescheiterter Text-Check erzeugt einmalig Text **und** Arbeitsblatt neu.
4. Danach wird erneut gemessen und erneut von Claude geprüft. Die Korrektur wird nur übernommen, wenn die Prüfung danach besser ausfällt (Fehler zählen zehnfach gegenüber Warnungen); sonst bleibt die vorige Fassung stehen und die Schleife bricht ab.
5. Jede übernommene Runde steht im Qualitätsbericht – auf dem Bildschirm, in der Teacher-HTML-Ausgabe, im Markdown und in der Word-Lehrerversion: „Runde 1 · Fragen ersetzt: Q4 · Auslöser: No two questions test exactly the same information“.

Beispiel aus einem echten Durchlauf: Das Review meldet, dass Q3 (Connecting) und Q4 (Inference) dieselbe Information mit derselben Belegstelle prüfen. Die Anwendung ersetzt daraufhin nur Q4 durch eine Frage mit anderer Belegstelle, prüft erneut – und gibt das Material ohne offene Befunde aus.

## Word-Export

Zwei Downloads: **Schülerversion** und **Lehrerversion**, beide als fertig formatierte `.docx`-Datei (A4, Kopf-/Fußzeile mit Seitenzahl, Word-eigene Absatz- und Tabellenformate – kein HTML in einer Word-Hülle).

Der Text wird im Layout seines Texttyps gesetzt, nicht als neutraler Fließtext:

| Texttyp | Gestaltung |
|---|---|
| Story | Buchsatz, Garamond, kapitälchenartiger Titel, Initiale, Blocksatz mit Einzug |
| Article | Magazin: Kicker, große Headline, Vorspann, Autorenzeile zwischen Haarlinien, Pull-Quote |
| News Article | Zeitung: Zeitungskopf mit Doppellinie, Ressortzeile, **zwei Spalten**, Ortsmarke im ersten Absatz |
| Blog Post | Serifenlos, Blogname, „von X · Datum · 4 min read“, Tag-Leiste am Ende |
| Email | Kopftabelle From / To / Subject / Sent, Signaturblock nach `--` |
| Forum Discussion | Thread-Balken, Beiträge als Karten mit Username und Zeitstempel |
| Interview | Frage fett mit Sprecherkürzel, hängender Einzug |
| Review | Kategorie-Kicker, Sternewertung, Verdict-Kasten |
| Report | Titelband in Akzentfarbe, Empfänger/Autor/Datum-Tabelle, Summary-Kasten, nummerierte Zwischentitel |
| Diary Entry | Handschrift-Schrift, Datum rechts, gepunktete Schreiblinien |
| Informational Text | Akzentlinie unter dem Titel, „Did you know?“-Faktenkasten, Quellenangabe |
| Opinion Text | „OPINION“-Eyebrow, Initiale, Pull-Quote |
| Dialogue | Zweispaltige Sprechertabelle |
| Listening | Aufnahme-Skript: Zeilennummern, Sprecherspalte, Emotion-Tags, Setting und Sprechanteile im Kopf |

Die dafür nötigen Angaben (Byline, Publikation, Datum, From/To/Subject, Usernames, Sternewertung, Verdict, Faktenkasten …) fordert die Anwendung pro Texttyp bei Claude an (`META_SPECS` in `core.js` → Prompt → `meta`-Objekt der Antwort). Es gibt dafür keine Textbausteine im Code; fehlende Felder werden schlicht weggelassen.

Das Arbeitsblatt ist ein echtes Arbeitsblatt: Name-/Klasse-/Datum-Zeile, Aufgabenblöcke nach Antwortformat gruppiert, Ankreuzkästchen, Zuordnungstabellen mit gemischter rechter Spalte, Schreiblinien, Seitenzahl. Die Lehrerversion enthält Metadaten, Skript bzw. Text mit ¶-Nummern und hervorgehobenem Zielvokabular, Vokabeltabelle, Lösungsschlüssel (Skill, Format, Niveau, Antwort, Evidenz, Begründung) und den Qualitätsbericht.

## Kontrollmechanismen

- **Konzept-Manifest** (`app/manifest.js`): 308 Anforderungen aus dem Konzeptdokument und den Auftragserweiterungen (§33 Word-Export, §34 Schwierigkeitsmesser & Niveau der Fragen, §35 Pre-Task, §36 Post-Task, §37 Authentisches Layout, §38 Vorlagen), jede mit Prüfart:
  - `setting` – Steuerelement existiert **und** die Änderung des Werts verändert nachweislich mindestens einen Prompt (Prompt-Sensitivitätstest; tote Einstellungen fallen durch).
  - `function` – Verhalten wird mit echten Eingaben ausgeführt (z. B. Preset *Interview* ⇒ Anteile 25/75, Skill-Mix verschiebt sich mit der Schwierigkeit, Beispielkonfiguration §32 reproduziert alle Werte).
  - `rule` – Qualitätsregel existiert als Messfunktion oder als Review-Kriterium und wird im Review-Prompt an Claude übergeben.
  - `render` – Ausgabe wird auf einer Fixture gerendert und inhaltlich geprüft (z. B. Schülerversion enthält beim Listening kein Skript).
  - `ui` – Navigations-/Strukturelement existiert.
- **Vollständigkeit**: jedes Setting im Schema muss einer Anforderung zugeordnet sein, jede Qualitätsregel wird gelistet.
- **Kein hartkodierter Inhalt**: Titel, Instruktion, Fragen, Pre-Tasks und Themenvorschläge werden nachweislich von Claude angefordert; die Pipeline wird auf literale Instruktionstexte geprüft.
- **Word-Export**: der Generator schreibt OOXML selbst, deshalb prüft `ooxml.js` jedes erzeugte Paket vor dem Download – vorhandene Teile, Content-Types, auflösbare Beziehungen, Schema-Reihenfolge der Elemente, Tabellenstruktur. Schlägt die Prüfung fehl, wird keine Datei ausgeliefert. In den Tests wird das Paket zusätzlich von einem unabhängigen ZIP-/XML-Leser (`python3 zipfile`) geöffnet, und für jeden der 14 Texttypen wird geprüft, dass die typischen Gestaltungselemente tatsächlich im Dokument stehen.
- **Drei Ausführungsorte derselben Prüfung**: `npm test` (lokal), GitHub Actions (`.github/workflows/test.yml`, inkl. Aktualität von `CONCEPT_COVERAGE.md`) und die Seite **Konzept-Check** in der App selbst, die gegen das laufende DOM und die echte `generate()`-Funktion prüft.

- **Audit-Suite** (`tests/audit.js`, 104 Prüfungen): stellt die umgekehrte Frage – *was bricht es?* Sie baut absichtlich **korrektes** Material (positive Kontrolle: keine Regel darf anschlagen) und absichtlich **kaputtes** Material (für jede deterministische Regel eine eigene Verletzung, die sie fangen muss), fuzzt 3000 zufällige Einstellungszustände gegen Idempotenz und Plan-Invarianten, schickt feindseligen Text (Markup, Emoji, RTL, 60-Zeichen-Wörter, 160 Absätze) durch Bild, Ansicht und Word-Export, prüft, dass Claudes Antwort nichts übernehmen kann (erfundene Regeln, injizierte Fragen, Interface-Daten falschen Typs), und dass gleiche Eingaben gleiche Ergebnisse liefern. Der komplette Prüfauftrag steht in **[AUDIT.md](AUDIT.md)** – als Prompt formuliert, damit er jederzeit erneut ausgeführt werden kann.
- **Blockierende Befunde sind sichtbar**: Prüfungen, die als blockierend definiert sind (Wortzahl, Zielvokabular, Fragenzahl, Chronologie, Sozialformen, Bildidentität …), färben den Lauf rot, nennen sich im Quality-Check mit eigenem Kasten, stehen in der Lehrerversion und im Word-Export – Material, das sie nicht besteht, wird nicht stillschweigend als fertig ausgegeben.

- **Selbstkontrolle des Auftrags**: jede Audit-Prüfung trägt das Kapitel aus `AUDIT.md`, das sie beantwortet; die Suite listet am Ende alle Kapitel und Schwachstellen mit der Zahl ihrer Prüfungen und **fällt durch, sobald eines ohne Prüfung bleibt**.
- **Browser-Audit** (`tests/browser.js`, 25 Prüfungen, `npm run audit:browser`): was ohne echten Browser nicht prüfbar ist – die In-App-Konzeptprüfung gegen den exportierten Quelltext, der ganze Durchlauf gegen neun bösartige Claude-Antworten, XSS in allen Tabs, kaputter und voller Speicher, Doppelstart, Stop bei hängendem Aufruf, Tastatur, Fokus, Dunkelmodus, 360 px, Navigation während des Laufs.

```bash
npm test          # Unit-Tests + Konzept-Abdeckung + Audit-Suite
npm run audit     # nur die Audit-Suite
npm run audit:browser  # Browser-Audit (überspringt sich ohne Playwright)
npm run coverage  # CONCEPT_COVERAGE.md neu erzeugen
npm run serve     # lokale Vorschau (ohne Claude: Import, Einstellungen, Konzept-Check funktionieren; Generierung nur in Claude.ai)
```

## Nutzung in Claude.ai

Das Artifact deklariert die Capabilities `sample` (Claude), `db` (Lehrmittel und Materialien werden serverseitig gespeichert; Fallback localStorage) und `downloads` (Export). Beim ersten Generieren fragt Claude.ai um Erlaubnis; die Generierung nutzt das Kontingent des jeweiligen Nutzers. Ein Listening mit Worksheet benötigt drei bis fünf Claude-Aufrufe (Content, Fragen, Review, ggf. Revisionen).

## Lehrmittel und Vokabellisten

Ein Lehrmittel ist eine eigene Vokabelliste mit Units. Neue Listen entstehen auf zwei Wegen, beide ohne vorhandene Liste:

- **Lehrmittel anlegen** – legt ein leeres Lehrmittel an; die Units entstehen beim Import.
- **Import direkt in ein neues Lehrmittel** – im Import-Formular steht „➕ Neues Lehrmittel anlegen …“ als Ziel; Name eingeben, Liste einlesen, übernehmen. Das neue Lehrmittel wird anschließend automatisch im Creator ausgewählt.

Die Unit-Zuordnung ist wählbar:

| Modus | Verhalten |
|---|---|
| Aus der Liste erkennen | Überschriften wie „Unit 3: Movies“, eine Unit-Spalte oder Tabellenblattnamen |
| Alles in eine einzige neue Unit | Die ganze Liste wird zu einer Unit mit dem eingegebenen Namen |
| Claude soll Units und Themen erkennen | Claude gruppiert eine unstrukturierte Liste in Units, benennt sie fortlaufend und leitet je ein Thema ab |

Enthält die Liste zwar Units, aber keine Themen, ergänzt Claude die Themen aus dem Wortschatz – im Import über „Fehlende Themen von Claude ergänzen“, für bereits gespeicherte Lehrmittel über „Themen von Claude“ direkt am Lehrmittel. Die Zuordnung ist verlustfrei: Lücken und Überlappungen in Claudes Gruppen werden geschlossen, keine Vokabel geht verloren (im Test über mehrere Grenzfälle geprüft). Jede Unit lässt sich in der Vorschau vor dem Import umbenennen, mit einem Thema versehen oder ganz weglassen.

Dateiformate: CSV, TSV, TXT (Spalten *word/translation/unit/note* oder „Wort – Übersetzung“-Listen), XLSX über SheetJS. Unstrukturierter Rohtext (z. B. aus einem PDF kopiert) lässt sich mit „Rohtext mit Claude zerlegen“ in Wort und Übersetzung trennen. Modi beim Import in ein bestehendes Lehrmittel: Hinzufügen, Aktualisieren, Ersetzen.

Gespeicherte Lehrmittel kommen aus der `db`-Capability als **schreibgeschützte (eingefrorene) Dokumente** zurück. Jede Änderung – Themen ergänzen, Thema tippen, umbenennen, Unit löschen – erzeugt deshalb Kopien statt die Originale zu verändern (`withTopics`, `withUnitPatch` in `vocab.js`, Klon beim Lesen aus dem Speicher). Ein Test mit tiefgefrorenen Objekten und ein Browser-Durchlauf gegen eine eingefrorene Datenbank halten das fest; ohne diese Behandlung scheiterte das automatische Ergänzen der Themen mit „Cannot assign to read only property“.

Anlegen, Umbenennen und Löschen laufen über seiteneigene Dialoge, nicht über `window.prompt`/`confirm` – im Artifact-Frame sind die nicht verlässlich verfügbar. Ein Test stellt sicher, dass keine native Dialogfunktion mehr im Code steht.
