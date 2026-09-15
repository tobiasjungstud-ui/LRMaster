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

1. **Plan** – Validierung, Zielwortzahl (Audio-Länge × Sprechtempo bzw. Wortzahl/A4), Sprecher-Labels und -anteile, Skill-Mix (automatisch nach Schwierigkeit oder manuell), Format-Zuweisung, Fragen-Niveau (CEFR-Band unabhängig vom Textniveau).
2. **Content** – Claude schreibt Skript/Text als JSON (Sprecherzeilen mit optionalem Emotion-Tag bzw. Absätze).
3. **Content-Prüfung** – gemessen: Wortzahl, Sprechanteile, Sprecher-Labels, Tag-Dichte, Turn-Länge/Variabilität, Zielvokabular. Bei blockierenden Verstößen eine Revision mit konkreten Befunden.
4. **Aufgaben** – Claude erstellt Fragen mit fixem Skill je Fragenummer, Format, CEFR-Difficulty, wörtlichem Evidenz-Zitat, Referenz und Begründung; separat Higher-Order-Aufgaben und Pre-Tasks.
5. **Aufgaben-Prüfung** – gemessen: Anzahl, Skill-Verteilung, erlaubte Formate, Chronologie über Evidenz-Positionen, Duplikate, auffindbare Evidenz, Higher-Order getrennt, Pre-Task-Typen.
6. **Claude-Review** – Beurteilung der Regeln, die Lesen erfordern (Eindeutigkeit, Ableitbarkeit, Distraktoren, Niveau, echte Inferenz, Natürlichkeit, Thema, keine Spoiler im Pre-Task).
7. **Automatische Korrektur** – siehe unten: beanstandete Fragen werden gezielt ersetzt, der Text bei Bedarf überarbeitet, danach wird erneut gemessen und geprüft.
8. **Ausgabe** – Student Version (ohne Skript beim Listening), Teacher Version (Skript mit Zeilennummern und Vokabel-Highlight, verwendete Items, Lösungsschlüssel mit Skill/Difficulty/Evidenz/Begründung, Qualitätsbericht), Prompts und JSON; Download als **Word (.docx)**, HTML, Markdown oder JSON, Druck, Speicherung.

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

- **Konzept-Manifest** (`app/manifest.js`): 208 Anforderungen aus dem Konzeptdokument, jede mit Prüfart:
  - `setting` – Steuerelement existiert **und** die Änderung des Werts verändert nachweislich mindestens einen Prompt (Prompt-Sensitivitätstest; tote Einstellungen fallen durch).
  - `function` – Verhalten wird mit echten Eingaben ausgeführt (z. B. Preset *Interview* ⇒ Anteile 25/75, Skill-Mix verschiebt sich mit der Schwierigkeit, Beispielkonfiguration §32 reproduziert alle Werte).
  - `rule` – Qualitätsregel existiert als Messfunktion oder als Review-Kriterium und wird im Review-Prompt an Claude übergeben.
  - `render` – Ausgabe wird auf einer Fixture gerendert und inhaltlich geprüft (z. B. Schülerversion enthält beim Listening kein Skript).
  - `ui` – Navigations-/Strukturelement existiert.
- **Vollständigkeit**: jedes Setting im Schema muss einer Anforderung zugeordnet sein, jede Qualitätsregel wird gelistet.
- **Kein hartkodierter Inhalt**: Titel, Instruktion, Fragen, Pre-Tasks und Themenvorschläge werden nachweislich von Claude angefordert; die Pipeline wird auf literale Instruktionstexte geprüft.
- **Word-Export**: der Generator schreibt OOXML selbst, deshalb prüft `ooxml.js` jedes erzeugte Paket vor dem Download – vorhandene Teile, Content-Types, auflösbare Beziehungen, Schema-Reihenfolge der Elemente, Tabellenstruktur. Schlägt die Prüfung fehl, wird keine Datei ausgeliefert. In den Tests wird das Paket zusätzlich von einem unabhängigen ZIP-/XML-Leser (`python3 zipfile`) geöffnet, und für jeden der 14 Texttypen wird geprüft, dass die typischen Gestaltungselemente tatsächlich im Dokument stehen.
- **Drei Ausführungsorte derselben Prüfung**: `npm test` (lokal), GitHub Actions (`.github/workflows/test.yml`, inkl. Aktualität von `CONCEPT_COVERAGE.md`) und die Seite **Konzept-Check** in der App selbst, die gegen das laufende DOM und die echte `generate()`-Funktion prüft.

```bash
npm test          # Unit-Tests + Konzept-Abdeckung
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
