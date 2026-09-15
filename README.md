# LRMaster – Listening & Reading Creator

Erzeugt aus dem Vokabular eines Lehrmittels (z. B. *English Plus 4 → Unit 1*) didaktisch kontrollierbare **Listenings** und **Readings** inklusive Worksheet, Lösungsschlüssel und Qualitätskontrolle. Das Sprachmodell (Claude) wird direkt aus dem veröffentlichten Artifact über die `sample`-Capability von Claude.ai angesprochen; es gibt keine hartkodierten Texte, Fragen, Instruktionen oder Themenvorschläge – alles Generierte kommt aus Claude und wird anschließend gemessen und bewertet.

Konzept: [`docs/Konzept_Listening_Reading_Creator.md`](docs/Konzept_Listening_Reading_Creator.md) · Abdeckung: [`CONCEPT_COVERAGE.md`](CONCEPT_COVERAGE.md)

## Aufbau

```
app/
  index.html    Seite (als Artifact veröffentlicht; Start, Creator, Vocabulary-Manager, Materialien, Konzept-Check)
  styles.css    Design-Tokens (hell/dunkel), Layout, Druck
  core.js       Settings-Schema, Defaults, Ableitungen (Wortzahl, Sprechanteile, Skill-Mix, Formate, Plan), Validierung, Presets, Beispielkonfiguration
  prompts.js    Prompt-Builder: jede Einstellung wird in eine Anweisung an Claude übersetzt (Topic, Content, Fragen, Review, Revision, Vokabel-Import)
  quality.js    Normalisierung der Claude-Antworten + Qualitätsregeln (§29): deterministisch gemessen oder per Claude-Review beurteilt
  render.js     Student Version / Teacher Version / Markdown-Export
  vocab.js      Import von CSV/TSV/TXT/XLSX-Wortlisten, Unit-Erkennung, Zusammenführen/Ersetzen
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
7. **Revision** – bei blockierenden Befunden einmalige Überarbeitung, danach erneutes Messen und erneutes Review.
8. **Ausgabe** – Student Version (ohne Skript beim Listening), Teacher Version (Skript mit Zeilennummern und Vokabel-Highlight, verwendete Items, Lösungsschlüssel mit Skill/Difficulty/Evidenz/Begründung, Qualitätsbericht), Prompts und JSON; Druck, Download (.html/.md/.json), Speicherung.

## Kontrollmechanismen

- **Konzept-Manifest** (`app/manifest.js`): 167 Anforderungen aus dem Konzeptdokument, jede mit Prüfart:
  - `setting` – Steuerelement existiert **und** die Änderung des Werts verändert nachweislich mindestens einen Prompt (Prompt-Sensitivitätstest; tote Einstellungen fallen durch).
  - `function` – Verhalten wird mit echten Eingaben ausgeführt (z. B. Preset *Interview* ⇒ Anteile 25/75, Skill-Mix verschiebt sich mit der Schwierigkeit, Beispielkonfiguration §32 reproduziert alle Werte).
  - `rule` – Qualitätsregel existiert als Messfunktion oder als Review-Kriterium und wird im Review-Prompt an Claude übergeben.
  - `render` – Ausgabe wird auf einer Fixture gerendert und inhaltlich geprüft (z. B. Schülerversion enthält beim Listening kein Skript).
  - `ui` – Navigations-/Strukturelement existiert.
- **Vollständigkeit**: jedes Setting im Schema muss einer Anforderung zugeordnet sein, jede Qualitätsregel wird gelistet.
- **Kein hartkodierter Inhalt**: Titel, Instruktion, Fragen, Pre-Tasks und Themenvorschläge werden nachweislich von Claude angefordert; die Pipeline wird auf literale Instruktionstexte geprüft.
- **Drei Ausführungsorte derselben Prüfung**: `npm test` (lokal), GitHub Actions (`.github/workflows/test.yml`, inkl. Aktualität von `CONCEPT_COVERAGE.md`) und die Seite **Konzept-Check** in der App selbst, die gegen das laufende DOM und die echte `generate()`-Funktion prüft.

```bash
npm test          # Unit-Tests + Konzept-Abdeckung
npm run coverage  # CONCEPT_COVERAGE.md neu erzeugen
npm run serve     # lokale Vorschau (ohne Claude: Import, Einstellungen, Konzept-Check funktionieren; Generierung nur in Claude.ai)
```

## Nutzung in Claude.ai

Das Artifact deklariert die Capabilities `sample` (Claude), `db` (Lehrmittel und Materialien werden serverseitig gespeichert; Fallback localStorage) und `downloads` (Export). Beim ersten Generieren fragt Claude.ai um Erlaubnis; die Generierung nutzt das Kontingent des jeweiligen Nutzers. Ein Listening mit Worksheet benötigt drei bis fünf Claude-Aufrufe (Content, Fragen, Review, ggf. Revisionen).

Vocabulary-Import: CSV/TSV/TXT (Spalten *word/translation/unit/note* oder „Wort – Übersetzung“-Listen mit Überschriften wie „Unit 3: Movies“), XLSX über SheetJS, oder unstrukturierten Text mit „Mit Claude strukturieren“. Modi: Hinzufügen, Aktualisieren, Ersetzen.
