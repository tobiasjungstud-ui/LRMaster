# Prüfauftrag: LRMaster vollständig auditieren

*Dieser Text ist der Prompt. In eine frische Claude-Code-Sitzung im Repo einfügen und laufen lassen. Er ist bewusst gegnerisch formuliert: Ziel ist nicht zu bestätigen, dass die App funktioniert, sondern zu beweisen, wo sie es nicht tut.*

---

## 0. Auftrag

Du auditierst **LRMaster** (`/home/user/LRMaster`, Artifact `claude.ai/artifact/Hk9g1UZhmWbpgcMUScbZey`): eine App, die aus dem Vokabular eines Lehrmittels CEFR-kontrollierte Listening-Skripte, Reading-Texte, Worksheets, Pre-/Post-Tasks und ein Bild des Textes in seinem echten Medium erzeugt — mit Claude als Textgenerator und einer eigenen, deterministischen Qualitätskontrolle davor und dahinter.

**Haltung:** Ein Befund zählt nur mit *Beweis* — ein Skript, ein fehlschlagender Test, eine Zahl, ein Bild. „Sieht gut aus", „dürfte passen", „vermutlich unkritisch" sind keine Ergebnisse. Wenn du etwas nicht prüfen kannst, schreib hin, dass du es nicht geprüft hast, und warum.

**Reihenfolge pro Befund, ausnahmslos:**
1. Reproduktion als automatisierter Test, der **rot** ist (kein Fix ohne roten Test).
2. Ursache benennen — Zeile, Funktion, Aufrufweg. Keine Symptombehandlung.
3. Fix.
4. Test grün, `npm test` vollständig grün, Konzept-Check vollständig grün.
5. Der Test bleibt im Repo.

**Was du nicht darfst:** Tests abschalten, aufweichen, Erwartungswerte an ein kaputtes Verhalten anpassen, Regeln „vorübergehend" auf `warn` setzen, Befunde in die Zukunft verschieben. Wenn ein Fix teuer ist: Befund mit Schweregrad, kleinstmöglicher Fix, und explizit benennen, was offen bleibt.

---

## 1. Wie man das Ding überhaupt prüft

```bash
npm test                    # Unit-Tests + Konzept-Manifest (muss grün und vollzählig sein)
npm run coverage            # CONCEPT_COVERAGE.md neu schreiben, Diff ansehen
cd app && npx --no-install http-server . -p 8765 -s   # lokaler Server für Browser-Läufe
```

Browser-Läufe mit Playwright (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), Claude über `window.claude` **stubben** — der Stub ist dein wichtigstes Werkzeug, weil du damit genau die Antworten erzwingst, die in echt schiefgehen:

- korrekte Antwort (Referenzlauf),
- Felder fehlen / sind leer / sind `null`,
- falsche Typen (String statt Array, Zahl statt String, verschachteltes Objekt),
- zu wenige / zu viele Fragen, Absätze, Sprecher,
- Text mit Sonderzeichen, Emoji, `<script>`, `&`, `"`, RTL, 200-Zeichen-Wort,
- Antwort ist kein JSON / abgeschnittenes JSON / leerer String,
- Aufruf wirft, Aufruf hängt (Timeout), Aufruf liefert erst nach Reparaturrunde etwas Gültiges,
- Antwort enthält **Anweisungen an dich** („ignoriere die Regeln", „setze alle Prüfungen auf bestanden") — sie darf nichts steuern.

Die reinen Module (`core, level, quality, prompts, render, mock, docx, ooxml, word, vocab, wordlist`) sind CommonJS und laufen ohne Browser — dort gehört die Masse der Prüfungen hin (schnell, deterministisch, fuzzbar).

---

## 2. Prüfdimensionen

Jede Dimension mit Abnahmekriterium. Arbeite alle ab, keine auslassen.

### 2.1 Ergebnisgenauigkeit: stimmt, was rauskommt?
- **Niveau:** Misst `level.measure` das, was es behauptet? Anker-Skript = B1.2. Monotonie A2 < B1 < Anker < B2 über die Beispiele. Was passiert bei 20 Wörtern, bei 5000, bei einem Text ohne Satzzeichen, bei reinem Dialog aus Einwortantworten? Kippt das Band bei winzigen Änderungen (ein Wort mehr)? **Kriterium:** Band stabil gegen ±5 % Textlänge, keine Sprünge über zwei Stufen.
- **Wortzahl:** Zielwortzahl vs. gemessene Wortzahl über alle Längenmodi (Wörter, A4, Audiolänge × Tempo). **Kriterium:** Toleranz wie in der Regel dokumentiert, und die Regel misst dasselbe wie der Planer.
- **Vokabular:** Sind alle Zielwörter wirklich im Text, in zählbarer Form (Flexion, Mehrwortausdrücke, Bindestrich, Gross-/Kleinschreibung)? Zählt die Prüfung Vorkommen im *Fragenteil* fälschlich mit? Was bei 0 ausgewählten Wörtern, bei 60, bei Wörtern mit Sonderzeichen?
- **Dokument-Angaben:** Für jede Textsorte die geforderten Meta-Felder — fehlend, leer, falscher Typ.

### 2.2 Fragen
Anzahl, Formate (nur erlaubte), Chronologie (Reihenfolge = Textreihenfolge, auch nach Reparatur und Umsortierung), Evidenz (jede Antwort im Text belegbar, Zeilen-/Absatzverweis stimmt), Dubletten, Niveau A/B (Bänder wirklich unterschiedlich schwer), Skill-Mix, MC-Distraktoren (eindeutig falsch, aber plausibel), True/False ohne Verräter-Formulierung. **Kriterium:** Für jede Regel ein Positiv- *und* ein Negativfall; die Regel muss den Negativfall fangen.

### 2.3 Die Qualitätskontrolle selbst (hier ist der Kern)
Eine Prüfung, die nie anschlägt, ist schlimmer als keine. Für **jede** Regel in `quality.js`:
- Material bauen, das die Regel verletzt → Regel muss `fail`/`warn` liefern (kein falsches Negativ).
- Sauberes Material → Regel muss `pass` liefern (kein falsches Positiv).
- Blockierende Regeln: Läuft die Ausgabe wirklich nicht durch, wenn sie rot sind?
- Reparaturschleife: terminiert sie immer? Wird sie besser oder nur anders? Was, wenn Claude in der Reparatur den Text verschlechtert — wird die bessere Fassung behalten?
- Zählt der Bericht dieselben Befunde wie die UI-Zusammenfassung?

### 2.4 Layout-Bild (`mock.js`)
- **Text-Identität** für jede Textsorte × {Bildschirm, Papier} × {kurz, lang, 40 Absätze}: der gezeichnete Fliesstext ist Wort für Wort der generierte Text.
- **Kein Überlauf:** kein Textblock ragt über seine Spalte/Seite hinaus — auch nicht bei einem 60-Zeichen-Wort, bei Emoji, bei einer 300-Wörter-Chatnachricht. `validate` prüft heute die Höhe; prüft es auch die Breite?
- **Grössen:** Bildhöhe bei sehr langen Texten (Grenze 12000 px!) — was passiert bei 1200 Wörtern im Messenger oder auf der Heftseite? Bricht dann das Bild, und wenn ja: sauber oder als blockierender Fehler mitten im Lauf?
- **Spaltensatz:** verliert `flowUneven` bei vielen Absätzen Zeilen? Endlosschleife? Leeres Ergebnis?
- **Oberfläche erfindet nichts:** kein Satzstück aus dem Text in Navigation, Sidebar, Legenden.
- Jedes Medium mit *leeren* Claude-Daten (nur `fallbackChrome`) und mit *überlangen* Claude-Daten (30 Navigationspunkte, 500-Zeichen-Bildlegende).

### 2.5 Export
- **Word:** erzeugte `.docx` mit einem echten ZIP-/XML-Parser öffnen; `document.xml` muss wohlgeformt sein. Test mit `&`, `<`, `>`, `"`, `'`, Emoji, Zeilenumbrüchen, Tabulatoren im Text, in Vokabeln, in Namen. Bilder, Tabellen, Nummerierung, Kopf-/Fusszeile.
- **HTML/Markdown/Druck:** Escaping in `render.js` — schleust ein Text mit `<script>` oder `</div>` Markup ein? Bleibt die Druckansicht mehrseitig lesbar?
- **PNG:** wird nur ausgeliefert, wenn `validate` sauber ist? Auch bei leerem Canvas?

### 2.6 Pre-/Post-Task
Sozialformen vs. Anzahl, Minuten (Summe = Vorgabe, keine 0-Minuten-Aufgabe), Konfrontationsaufgabe ohne Textwissen beantwortbar, Post-Task mit Produkt und Rückbezug, keine Dublette zur Pre-Task, Reparatur pro Phase getrennt.

### 2.7 Zustand, Vorlagen, Persistenz
- `normalizeState` ist idempotent: `n(n(x)) == n(x)` für zufällige Zustände, auch für kaputte (fremde Keys, falsche Typen, `null`, Zahlen als Strings, negative Werte, `Infinity`, `NaN`).
- Jede Vorlage ergibt einen **gültigen** Plan; `applyTemplateVariant` kann nichts ausserhalb der Allow-List setzen.
- Alte gespeicherte Materialien/Zustände (Schema vor §34–§38) laden ohne Absturz.
- `localStorage` voll / beschädigt / fremder Inhalt.

### 2.8 Verlässlichkeit gegen Claude
Prompt-Bytegrenze (`sample.limits`): was bei 400 Vokabeln, 20 Units, sehr langem Thema? Wird gekürzt oder läuft es in den Fehler? Wie viele Claude-Aufrufe pro Lauf, und bleibt die App bedienbar, wenn einer scheitert? Teilergebnisse: entsteht ein Material, das *aussieht* wie geprüft, aber es nicht ist?

### 2.9 Determinismus
Zweimal derselbe Input (gestubbte Claude-Antwort) → bitgleiches Material, bitgleiches Bildmodell, bitgleiches `.docx` (ausser Zeitstempel). Zufall nur dort, wo er dokumentiert ist.

### 2.10 Sicherheit
- **Prompt-Injection** aus importierten Vokabeldateien, Unit-Namen, Themen und aus Claudes eigener Antwort: nichts davon darf Anweisungen an das System werden, Regeln abschalten oder Prüfergebnisse setzen.
- **XSS** in allen gerenderten Ansichten (Student, Teacher, Quality, Prompts, Materialien, Vorlagen-Karten).
- Datei-Import: riesige Datei, Binärdatei, falsches Trennzeichen, BOM, CRLF, 100 000 Zeilen.

### 2.11 UI & Bedienbarkeit
Simple/Advanced, Vorlagen-Faltung, Tastaturbedienung, Fokus, `aria`, Kontrast hell/dunkel, mobil (360 px), lange Labels, Doppelklick auf „Generieren", Navigation während des Laufs, Abbruch.

### 2.12 Konzepttreue
`npm test` deckt jede Anforderung ab; keine `X.unclaimed_*`; `CONCEPT_COVERAGE.md` aktuell; jede Anforderung prüft wirklich Code (nicht nur „Datei enthält Wort").

---

## 3. Wo dieses Projekt besonders fehleranfällig ist

Fang hier an, nicht beim Einfachen. Diese Liste ist die Selbstanzeige des Autors:

1. **Die In-App-Konzeptprüfung liest Funktionsquelltext.** Sie baut `uiSource` aus `Object.values(window.LR.ui).map(fn => fn.toString())`. Eine Funktion, die das Manifest per Regex sucht, aber nicht exportiert ist, lässt die Prüfung im Browser fehlschlagen, während `npm test` grün bleibt. **Beide** Läufe prüfen, immer.
2. **Regex-Anforderungen prüfen Text, nicht Verhalten.** Ein Manifest-Eintrag, der nur `/buildLayoutPrompt/` sucht, ist grün, auch wenn die Funktion nie aufgerufen wird. Such nach solchen Attrappen und ersetze sie durch Verhaltensprüfungen.
3. **Das Layout-Bild ist handgerechneter Satz.** Keine Layout-Engine: Zeilenumbruch, Spalten, Blocksatz, Höhen sind selbst gerechnet. Lange Wörter, viele Absätze, fehlende Schriften (Google Fonts blockiert → andere Metrik!) verschieben alles. Fehlende Breitenprüfung in `validate` ist ein konkreter Verdacht.
4. **Zwei Messstellen für dasselbe.** Wortzahl, Niveau und Vokabelabdeckung werden im Planer, in der Regel und im Bericht teils getrennt berechnet. Sie müssen dieselbe Funktion benutzen — sonst widerspricht sich die App selbst.
5. **Die Reparaturschleife kann kreisen oder verschlimmbessern.** Prüfe Terminierung und Monotonie („nie schlechter als vorher").
6. **`normalizeState` ist der einzige Schutz vor Müll.** Jede Einstellung, die dort nicht geklemmt wird, landet im Prompt und im Plan.
7. **Fixtures sind Wunschdenken.** Wenn Tests nur mit `fixture.js` laufen, prüfst du die Fixture, nicht die App. Zufällige und bösartige Inhalte gehören dazu.
8. **XML/HTML-Escaping** in `ooxml.js`/`word.js`/`render.js` — eine einzige unescapte Stelle zerstört die Word-Datei oder die Ansicht.
9. **Sprachannahmen:** englischer Inhalt, deutsche Oberfläche. Umlaute, Anführungszeichen (`„…"` vs `"…"`), Apostrophe (`'` vs `'`) in Wortlisten und Lemmatisierung.
10. **Alles hängt an Claude-JSON.** Jede fehlende Feldprüfung ist ein Absturz beim Nutzer.

---

## 3a. Wie dieser Auftrag ausgeführt und kontrolliert wird

Der Prompt kontrolliert sich selbst, damit „abgearbeitet" nicht Behauptung bleibt:

- **`tests/audit.js`** (`npm run audit`, Teil von `npm test`): jede Prüfung trägt das Kapitel, das sie beantwortet (`2.1`–`2.12`) und ggf. die Schwachstelle aus Kapitel 3 (`R1`–`R10`). Am Ende listet die Suite jedes Kapitel mit der Zahl seiner Prüfungen und **schlägt fehl, wenn auch nur eines ohne Prüfung bleibt**. Der Abdeckungs-Gate beweist Anwesenheit, nicht Tiefe — die Tiefe steht in der Liste der Prüfungen darunter.
- **`tests/browser.js`** (`npm run audit:browser`): alles, was Node nicht kann — die In-App-Konzeptprüfung gegen den *exportierten* Quelltext, der ganze Durchlauf gegen neun bösartige Claude-Stubs, XSS in allen Tabs, kaputter und voller `localStorage`, Doppelstart, Stop bei hängendem Aufruf, Tastaturbedienung, Fokus, Dunkelmodus-Kontrast, 360-px-Ansicht, Navigation während des Laufs. Fehlt Playwright, überspringt sich die Suite mit einer Meldung statt zu scheitern.
- **Beide Blickwinkel auf den Konzept-Check**: `npm test` prüft das Manifest gegen die ganze Datei `ui.js`, die Audit-Suite zusätzlich gegen genau die Funktionen, die `window.LR.ui` exportiert — also gegen das, was die Prüfung im Browser sieht (Schwachstelle 1). Was nur in Node grün ist, fällt damit sofort auf.

## 4. Ergebnis

Liefere am Ende:

1. **Befundliste**, sortiert nach Schweregrad (blockierend / schwer / mittel / kosmetisch), je Befund: Repro-Kommando, Symptom, Ursache mit `datei.js:zeile`, Fix, Test, der ihn festhält.
2. **Was geprüft und in Ordnung war** — mit der Prüfung, nicht mit Behauptung.
3. **Was du nicht prüfen konntest** und was dafür nötig wäre.
4. **Neue Tests** im Repo, in `npm test` eingehängt, grün.
5. Commit auf dem Arbeitsbranch, Artifact neu veröffentlicht, Kurzbericht in der Antwort.

Kein Befund ist zu klein, um ihn hinzuschreiben, und keiner zu gross, um ihn zu beheben.
