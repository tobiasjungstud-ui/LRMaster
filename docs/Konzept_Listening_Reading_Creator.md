# Listening & Reading Creator

## 1. Ziel der Anwendung

Die Anwendung dient dazu, auf Grundlage eines Lehrmittels und dessen Vocabulary-Datenbank automatisch hochwertige **Listenings** und **Readings** inklusive passender Aufgaben zu erstellen.

Ausgangspunkt ist eine hochgeladene Vocabulary-Datei eines Lehrmittels, beispielsweise:

**English Plus 4 → Unit 1**

Die Anwendung kennt anschließend die Vocabulary-Inhalte der jeweiligen Units. Beim Erstellen eines neuen Materials wird eine Unit ausgewählt. Thema, Sprache und ausgewählte Zielvokabeln des erstellten Textes sollen sich daran orientieren.

Dabei soll die Anwendung nicht lediglich Texte generieren, sondern didaktisch kontrollierbare Materialien erstellen. Schwierigkeit des Textes und Schwierigkeit der Fragen müssen unabhängig voneinander steuerbar sein.

---

# 2. Hauptnavigation

Auf der Startseite befinden sich zwei große Auswahlmöglichkeiten:

**Listening erstellen**

**Reading erstellen**

Zusätzlich:

**Vocabulary / Lehrmittel verwalten**

Dort können Lehrmittel angelegt und Vocabulary-Dateien importiert, aktualisiert oder ersetzt werden.

Beispiel:

> English Plus 4  
> Unit 1  
> Unit 2  
> Unit 3  
> ...

---

# 3. Grundaufbau des Creators

Nach Auswahl von **Listening** oder **Reading** wird der Creator geöffnet.

Die Seite sollte in logisch aufeinanderfolgenden Bereichen aufgebaut sein:

1. Source & Unit
2. Content
3. Language Level
4. Text / Audio Structure
5. Vocabulary
6. Worksheet & Questions
7. Advanced Settings
8. Generate

Nicht alle Einstellungen müssen permanent sichtbar sein. Erweiterte Optionen können unter **Advanced Settings** oder durch Aufklappen einzelner Bereiche erscheinen.

---

# 4. Source & Unit

## Lehrmittel

Dropdown:

> English Plus 4

## Unit

Dropdown:

> Unit 1

Optional kann zusätzlich gewählt werden:

**Use unit topic:** ON / OFF

Bei ON orientiert sich der Inhalt klar am Thema der Unit.

Bei OFF werden hauptsächlich die Vocabulary-Daten verwendet und das Thema kann frei gewählt werden.

---

# 5. Content

## Topic

Optionen:

**Use Unit Topic**

oder

**Custom Topic**

Freies Eingabefeld, z. B.:

> Teenagers discussing whether social media makes friendships better or worse.

Optional:

**Generate topic for me**

Dabei schlägt die Anwendung mehrere passende Szenarien auf Basis der Unit vor.

---

# 6. Language Level

CEFR-Auswahl:

> A2.1  
> A2.2  
> B1.1  
> B1.2  
> B2.1  
> B2.2

Optional zusätzlich als Regler:

**Language Complexity**

Simple ─────────●───────── Complex

Dieser Wert beeinflusst unter anderem:

- Satzlänge
- grammatische Komplexität
- Idiomatik
- Synonyme
- natürliche Gesprächssprache
- Explizitheit der Informationen

Wichtig:

**Language difficulty und Question difficulty sind voneinander unabhängig.**

Ein B1.2-Listening kann beispielsweise einfache B1.1-Fragen oder anspruchsvolle B2.1-Verständnisfragen erhalten.

---

# 7. Vocabulary Settings

## Vocabulary Usage

Regler:

Low ─────────●───────── High

Zusätzlich:

**Target vocabulary count**

z. B.:

> 8–12 words

Option:

**Select vocabulary manually**

Hier werden alle Vocabulary-Einträge der gewählten Unit angezeigt und können ausgewählt werden.

Die KI soll Vocabulary natürlich integrieren. Wörter dürfen nicht künstlich in einen Text gezwungen werden.

Optional:

**Highlight used target vocabulary in teacher version**

---

# 8. LISTENING – Audio Structure

Dieser Bereich erscheint nur bei einem Listening.

## Format

Auswahl:

**Monologue**

**Dialogue – 2 speakers**

**Conversation – X speakers**

Bei Conversation kann die Anzahl eingestellt werden:

> 3 / 4 / 5 / 6 speakers

---

# 9. Listening Presets

Zusätzlich gibt es sinnvolle **Conversation Presets**.

Diese verändern automatisch Gesprächsstruktur und Sprechanteile.

Beispiele:

### Natural Conversation
Relativ ausgeglichener Dialog mit natürlichen Wechseln.

### Interview
Ein Sprecher stellt überwiegend kurze Fragen.  
Der andere Sprecher gibt längere Antworten.

Beispiel:

Interviewer: 25 %

Guest: 75 %

### Podcast Interview
Moderator führt durch das Gespräch, Gast hat den größten Redeanteil. Rückfragen und Reaktionen sind natürlicher als bei einem klassischen Interview.

### Discussion
Mehrere Personen vertreten unterschiedliche Meinungen. Sprechanteile relativ ausgeglichen.

### Debate
Klare Positionen, Argumente und Gegenargumente.

### Teacher / Expert Explanation
Eine Person erklärt hauptsächlich. Zweite Person stellt gelegentlich Fragen.

### TED-Talk / Presentation
Fast ausschließlich ein Sprecher. Optional kurze Einführung durch Moderator.

### Storytelling
Ein Sprecher erzählt. Fokus auf Handlung und narrative Struktur.

### News Report
Moderator + Reporter / Interviewpartner.

### Casual Conversation
Natürliches Gespräch mit kurzen Sprecherwechseln, Reaktionen, Unterbrechungen und unterschiedlicher Länge der Beiträge.

### Phone Call
Stärker alternierende Sprecherwechsel und normalerweise relativ kurze Turns.

---

# 10. Speaker Distribution

Die Sprechanteile sollen unabhängig vom Preset kontrollierbar sein.

## Speaker Balance

Optionen:

**Balanced**

Alle sprechen ungefähr gleich viel.

**Natural Variation**

Unterschiedliche Sprechanteile, ohne klaren Hauptsprecher.

**Main Speaker**

Eine Person spricht deutlich mehr.

**Custom**

Manuelle Definition.

Beispiel:

> Speaker A – 20 %  
> Speaker B – 65 %  
> Speaker C – 15 %

Die Summe ergibt 100 %.

---

# 11. Turn Length

Zusätzlich wird gesteuert, wie lange einzelne Sprecher jeweils sprechen.

## Speaking Turn Length

Short ─────────●───────── Long

oder als Preset:

**Quick exchange**

> meistens 1–2 Sätze

**Natural**

> Mischung aus kurzen und mittleren Turns

**Extended**

> mehrere längere Aussagen

## Turn Length Variability

Low ─────────●───────── High

**Low Variability**

Alle Beiträge sind ungefähr ähnlich lang.

**High Variability**

Manche Sprecher sagen nur:

> Really?  
> Why?  
> I don't agree.

während andere mehrere Sätze am Stück sprechen.

Gerade für natürliche Dialoge sollte die Variabilität standardmäßig relativ hoch sein.

---

# 12. Audio Length

Auswahl über Zeit:

> 1:00  
> 1:30  
> 2:00  
> 2:30  
> 3:00  
> 4:00  
> 5:00  
> Custom

Die Anwendung berechnet daraus automatisch eine sinnvolle ungefähre Wortzahl.

Optional:

**Speaking Speed**

Slow ─────────●───────── Natural ─────────●───────── Fast

---

# 13. Speaker Profiles

Optional können Sprecher genauer definiert werden.

Beispiel:

**Speaker A**

Name: Maya  
Age: 16  
Role: Student  
Personality: confident, humorous

**Speaker B**

Name: Leo  
Age: 17  
Role: Student  
Personality: slightly nervous, thoughtful

Diese Informationen sollen das Gespräch beeinflussen, müssen aber nicht zwingend im Text genannt werden.

---

# 14. Emotion & Delivery Tags

Bei Listenings können emotionale oder sprecherische Anweisungen direkt im Skript verwendet werden.

Format:

> [excited]  
> [nervous]  
> [laughing]  
> [sarcastic]  
> [hesitant]  
> [surprised]  
> [annoyed]  
> [quietly]  
> [confused]  
> [relieved]  
> [thoughtful]  
> [serious]

Beispiel:

> Maya: [hesitant] I'm not sure that's actually a good idea.

> Leo: [laughing] You said exactly the same thing last week!

Option:

**Use emotion tags**

OFF / Low / Medium / High

Dabei gilt:

Emotionen sollen **gezielt und funktional** eingesetzt werden und nicht vor jedem Sprecherbeitrag stehen.

Insbesondere können diese Tags später für TTS-Systeme verwendet werden.

---

# 15. Natural Speech Settings

Optionaler Bereich:

## Naturalness

Clean / Educational ─────────●───────── Authentic

Je höher der Wert, desto eher verwendet das Listening:

- contractions
- fillers
- hesitation
- short reactions
- unfinished thoughts
- reformulations
- interruptions
- natural discourse markers

Beispiele:

> Well...  
> Actually,  
> I mean,  
> You know,  
> Wait, what?  
> That's not what I meant.

Für Unterrichtsmaterial muss die Natürlichkeit immer dem gewählten CEFR-Level angepasst bleiben.

---

# 16. Information Explicitness

Ein besonders wichtiger Regler:

**Information Explicitness**

Very Explicit ─────────●───────── Highly Implicit

Dies beeinflusst, wie leicht Informationen aus dem Audio entnommen werden können.

### Explicit

> I didn't go to the party because I was sick.

### Less Explicit

> Everyone was posting pictures from the party. I spent the evening on the sofa with a fever.

Die zweite Variante ermöglicht anspruchsvollere Inference-Fragen.

---

# 17. READING – Text Structure

Beim Reading werden anstelle der Listening-spezifischen Einstellungen passende Textformate angeboten.

## Text Type

- Story
- Article
- Blog Post
- Interview
- Email
- Forum Discussion
- Review
- News Article
- Report
- Diary Entry
- Informational Text
- Opinion Text
- Dialogue
- Custom

## Length

wahlweise:

- word count
- approximate A4 length

Beispiel:

> 450 words

---

# 18. Worksheet

Schalter:

**Create Worksheet**

ON / OFF

Bei OFF wird lediglich Listening-Skript bzw. Reading-Text erstellt.

Bei ON erscheinen die Question Settings.

---

# 19. Number of Questions

Beispielsweise:

> 5  
> 8  
> 10  
> 12  
> 15  
> Custom

---

# 20. Listening / Reading Skills

Die Aufgaben sollen nicht nur über ihre äußere Form definiert werden, sondern vor allem darüber, **welche Verstehensleistung erforderlich ist**.

Es gibt folgende Hauptkategorien:

## 1. Gist / Global Understanding

Gesamtthema, Hauptidee oder zentrale Message verstehen.

Beispiele:

> What is the conversation mainly about?

> Which statement best summarizes the speaker's message?

---

## 2. Specific Information

Einzelne Informationen gezielt finden.

Beispiele:

- Personen
- Orte
- Zeiten
- Zahlen
- konkrete Handlungen
- einzelne Fakten

Beispiel:

> What time does Maya arrive?

---

## 3. Detailed Understanding

Inhalte genau verstehen.

Dazu gehören beispielsweise:

- Gründe
- Konsequenzen
- Bedingungen
- Abläufe
- Vergleiche
- Problem und Lösung

---

## 4. Connecting Information

Informationen aus mehreren Stellen miteinander verbinden.

Beispiele:

- Aussagen vergleichen
- Ursache und Folge verbinden
- Veränderungen erkennen
- Aussagen verschiedener Sprecher kombinieren
- Widersprüche erkennen

Beispiel:

> Why does Leo change his opinion later in the conversation?

---

## 5. Inference / Implicit Meaning

Informationen erschließen, die nicht explizit gesagt werden.

Beispiele:

> What can we infer about Maya's relationship with her parents?

> Why does Leo probably hesitate?

---

## 6. Attitude, Emotion & Opinion

Erkennen von:

- Emotion
- Einstellung
- Zustimmung
- Ablehnung
- Sicherheit / Unsicherheit
- Begeisterung
- Frustration
- Ironie
- Skepsis

Bei Listenings können hierfür zusätzlich Tonfall und Emotion-Tags relevant sein.

---

## 7. Purpose & Intention

Verstehen, warum jemand etwas sagt.

Beispielsweise:

- persuade
- complain
- apologise
- reassure
- warn
- suggest
- refuse
- justify
- criticise
- explain

Beispiel:

> Why does Maya mention what happened last summer?

---

## 8. Context

Aus Informationen eine Situation erschließen.

Beispiele:

> Where are the speakers probably talking?

> What is their relationship?

> Who is the speaker most likely talking to?

---

# 21. Higher-Order Thinking

Zusätzliche Aufgaben können über das reine Textverständnis hinausgehen.

Separater Schalter:

**Higher-Order Questions**

OFF / ON

Typen:

### Interpretation
Bedeutung stärker deuten.

### Transfer
Information auf eine neue Situation anwenden.

### Evaluation
Eine Entscheidung oder Position anhand des Textes beurteilen.

Beispiel:

> Based on the discussion, which solution would probably work best for Maya?

Diese Aufgaben sollten nicht mit klassischen Listening-Comprehension-Fragen vermischt werden, da sie zusätzliches Denken verlangen.

---

# 22. Question Difficulty

Regler:

Easy ─────────●───────── Challenging

Die Schwierigkeit darf nicht allein über den Fragetyp bestimmt werden.

Sie wird unter anderem beeinflusst durch:

- Explizitheit der Information
- Abstand zwischen Information und Frage
- Verwendung von Synonymen
- benötigte Verknüpfung mehrerer Informationen
- Distraktoren
- Inference-Anteil
- sprachliche Komplexität der Frage

Beispiel:

### Easy

Audio:

> I moved to London in 2024.

Question:

> When did she move to London?

### Harder

Audio:

> It's been about two years since I left Manchester.

Question:

> Approximately when did she move away from Manchester?

---

# 23. Automatic Skill Mix

Default:

**Balanced Question Mix**

Die Anwendung verteilt die Fragen automatisch sinnvoll.

Beispiel für 10 Fragen:

> 1 × Gist  
> 3 × Specific Information  
> 2 × Detailed Understanding  
> 1 × Connecting Information  
> 1 × Inference  
> 1 × Attitude / Purpose  
> 1 × Context

Bei zunehmender Schwierigkeit verschiebt sich die Gewichtung automatisch von **direktem Informationsabruf** hin zu **Connecting, Inference, Attitude und Purpose**.

---

# 24. Manual Skill Mix

Alternativ:

**Custom Question Mix**

Der Nutzer kann beispielsweise einstellen:

Gist: 1

Specific Information: 2

Detailed Understanding: 2

Connecting Information: 2

Inference: 2

Attitude: 1

Purpose: 0

Context: 0

---

# 25. Question Formats

Unabhängig von den Listening Skills wird definiert, **wie die SuS antworten**.

Mögliche Formate:

- Multiple Choice
- True / False
- True / False + Correction
- Short Answer
- Wh-Questions
- Sentence Completion
- Gap Fill
- Matching
- Who said it?
- Ordering
- Table Completion
- Select all that apply
- Best Summary
- Note Taking

Mehrere Formate können gleichzeitig aktiviert werden.

Option:

**Automatic balanced mix**

Die Anwendung sorgt dann für Variation.

---

# 26. Question Order

Bei Listenings standardmäßig:

**Follow audio chronology: ON**

Die Fragen erscheinen möglichst in derselben Reihenfolge wie die Informationen im Audio.

Ausnahme:

Gist- oder Global-Understanding-Fragen können am Anfang oder Ende stehen.

Bei Readings kann alternativ gewählt werden:

**Follow text order**

---

# 27. Pre-Listening / Pre-Reading

Optional:

**Create Pre-Task**

Mögliche Formen:

### Prediction

> Look at the title. What do you think the speakers will discuss?

### Vocabulary Activation

2–4 relevante Wörter vorentlasten.

### Speaking Prompt

Kurze Partnerfrage zum Thema.

Diese Aufgaben dürfen keine Antworten aus dem eigentlichen Listening vorwegnehmen.

---

# 28. Output

Die Anwendung erzeugt getrennte Bereiche.

## Student Version

Enthält:

- Titel
- kurze Instruktion
- Pre-Task, falls gewählt
- Fragen / Aufgaben
- gegebenenfalls Reading-Text

Beim Listening **nicht automatisch das Skript**.

## Teacher Version

Enthält:

- vollständiges Skript / Text
- verwendete Vocabulary Items
- Lösungsschlüssel
- Zuordnung jeder Frage zum Listening Skill
- Difficulty
- relevante Textstelle bzw. Audio-Stelle
- kurze Begründung für schwierigere Inference-Fragen

Beispiel:

> Q7  
> Skill: Inference  
> Difficulty: B2.1  
> Evidence: Speaker B avoids answering directly and changes the topic.  
> Correct answer: C

---

# 29. Quality Check vor der Ausgabe

Vor dem Erstellen des endgültigen Materials führt die Anwendung automatisch eine Qualitätskontrolle durch.

Sie prüft:

**Content**
- Thema passt zur Unit.
- Zielvokabular wurde sinnvoll verwendet.
- Text ist kohärent.
- Gespräch wirkt natürlich.

**Listening**
- Sprechanteile entsprechen den Einstellungen.
- Sprecher sind eindeutig unterscheidbar.
- Emotion-Tags sind sinnvoll verteilt.
- keine unnötig künstlichen Sprecherwechsel.

**Questions**
- jede Frage ist eindeutig beantwortbar.
- richtige Antwort ist tatsächlich aus dem Material ableitbar.
- Distraktoren sind plausibel.
- Fragen stehen möglichst in Audio-/Textreihenfolge.
- keine zwei Fragen prüfen exakt dieselbe Information.
- Skill-Verteilung entspricht den Einstellungen.
- Difficulty entspricht der gewünschten Stufe.
- Inference-Fragen sind tatsächlich inferentiell und nicht bloß versteckte Detailfragen.

---

# 30. Advanced Settings

Für Nutzer, die maximale Kontrolle wünschen:

**Audio**
- number of speakers
- individual speaker share
- average turn length
- turn variability
- speaking speed
- natural speech
- emotion frequency
- information explicitness

**Text**
- word count
- paragraph length
- dialogue proportion
- narrative vs. informational style

**Language**
- CEFR
- grammar complexity
- vocabulary difficulty
- target vocabulary density
- idiomatic language

**Questions**
- number
- difficulty
- skill distribution
- response formats
- distractor difficulty
- inference level
- chronology

---

# 31. Simple Mode vs. Advanced Mode

Damit die Oberfläche trotz der vielen Möglichkeiten übersichtlich bleibt, sollte es zwei Modi geben.

## Simple Mode

Nur:

> Unit  
> Topic  
> Level  
> Length  
> Format  
> Question Difficulty  
> Number of Questions  
> Generate

Alle anderen Werte werden sinnvoll automatisch gewählt.

## Advanced Mode

Öffnet sämtliche beschriebenen Einstellungen.

So bleibt das Tool sowohl für schnelles Erstellen als auch für sehr gezielte Unterrichtsplanung geeignet.

---

# 32. Beispielkonfiguration

**Listening**

English Plus 4  
Unit 8 – Movies

Level:

> B1.2

Format:

> Podcast Interview

Length:

> 3 minutes

Speakers:

> 2

Speaker Distribution:

> Host 30 %  
> Guest 70 %

Turn Variability:

> High

Naturalness:

> Medium

Emotion Tags:

> Medium

Vocabulary:

> 10 target words

Worksheet:

> Yes

Questions:

> 10

Question Difficulty:

> Medium → Challenging

Skill Mix:

> Gist 1  
> Specific Information 3  
> Detail 2  
> Connecting 1  
> Inference 1  
> Attitude 1  
> Purpose 1

Question Formats:

> Multiple Choice  
> Short Answer  
> Matching

Question Order:

> Follow audio chronology

Output:

> Student Worksheet  
> Teacher Script  
> Answer Key