# Konzept-Abdeckung (generiert)

Erzeugt von `npm run coverage`. Jede Zeile ist eine Anforderung aus `docs/Konzept_Listening_Reading_Creator.md`, gebunden an die Stelle im Code, die sie umsetzt, und das Ergebnis der automatischen Prüfung (`npm test`).

**Ergebnis: 284 von 284 Anforderungen bestanden.**

Prüfarten: **setting** – Steuerelement vorhanden und Änderung des Werts verändert nachweislich den Prompt an Claude · **function** – Verhalten wird mit echten Eingaben ausgeführt und verglichen · **rule** – Qualitätsregel existiert als Messung oder Claude-Review-Kriterium · **render** – Ausgabe wird auf einer Fixture gerendert und inhaltlich geprüft · **ui** – Navigations-/Strukturelement existiert.

## §1 Ziel der Anwendung (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S01.pipeline` | Listening/Reading inkl. Aufgaben aus Lehrmittel + Vocabulary-Datenbank erzeugen | function | Funktion (siehe Check im Manifest) |
| ✅ | `S01.unit_selection` | Beim Erstellen wird eine Unit gewählt; Thema, Sprache und Zielvokabeln orientieren sich daran | function | Funktion (siehe Check im Manifest) |
| ✅ | `S01.independent_difficulty` | Textschwierigkeit und Frageschwierigkeit unabhängig steuerbar | function | Funktion (siehe Check im Manifest) |

## §2 Hauptnavigation (15/15)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S02.nav_listening` | Startseite: „Listening erstellen“ | ui | Element `#nav-listening` |
| ✅ | `S02.nav_reading` | Startseite: „Reading erstellen“ | ui | Element `#nav-reading` |
| ✅ | `S02.nav_vocab` | Startseite: „Vocabulary / Lehrmittel verwalten“ | ui | Element `#nav-vocab` |
| ✅ | `S02.textbook_create` | Lehrmittel anlegen | ui | Element `#btn-new-textbook` |
| ✅ | `S02.vocab_import` | Vocabulary-Dateien importieren (CSV/TSV/XLSX/Text) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.vocab_update_replace` | Vocabulary aktualisieren oder ersetzen | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.new_list_button` | Neues Lehrmittel (neue Vokabelliste) anlegen – ohne vorhandene Liste | ui | Element `#btn-new-textbook` |
| ✅ | `S02.new_list_in_import` | Import kann direkt in ein NEU anzulegendes Lehrmittel gehen | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.unit_modes` | Unit-Zuordnung wählbar: aus der Liste erkennen / alles in eine neue Unit / von Claude erkennen lassen | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.claude_detects_units` | Fehlen Unit-Titel, erkennt Claude die Units aus dem Inhalt der Liste | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.claude_no_word_lost` | Unit-Erkennung verliert keine Vokabel (Lücken und Überlappungen werden geschlossen) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.claude_derives_topics` | Themen der Units werden von Claude aus dem Wortschatz abgeleitet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.frozen_store_edit` | Gespeicherte (schreibgeschützte) Lehrmittel lassen sich bearbeiten: Themen, Umbenennen, Löschen ändern Kopien statt Originale | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.dialogs_in_page` | Anlegen, Umbenennen und Löschen laufen über seiteneigene Dialoge (im Artifact-Frame sind window.prompt/confirm nicht verlässlich) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S02.unit_listing` | Lehrmittel zeigt Units (Unit 1, Unit 2, …) | ui | Element `#textbook-list` |

## §3 Grundaufbau des Creators (11/11)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S03.section_1` | Creator-Bereich 1: Source & Unit | ui | Element `#sec-source[data-step="1"]` |
| ✅ | `S03.section_2` | Creator-Bereich 2: Content | ui | Element `#sec-content[data-step="2"]` |
| ✅ | `S03.section_3` | Creator-Bereich 3: Language Level | ui | Element `#sec-level[data-step="3"]` |
| ✅ | `S03.section_4` | Creator-Bereich 4: Text / Audio Structure | ui | Element `#sec-structure[data-step="4"]` |
| ✅ | `S03.section_5` | Creator-Bereich 5: Vocabulary | ui | Element `#sec-vocab[data-step="5"]` |
| ✅ | `S03.section_6` | Creator-Bereich 6: Worksheet & Questions | ui | Element `#sec-worksheet[data-step="6"]` |
| ✅ | `S03.section_7` | Creator-Bereich 7: Pre-Task | ui | Element `#sec-pretask[data-step="7"]` |
| ✅ | `S03.section_8` | Creator-Bereich 8: Post-Task | ui | Element `#sec-posttask[data-step="8"]` |
| ✅ | `S03.section_9` | Creator-Bereich 9: Advanced Settings | ui | Element `#sec-advanced[data-step="9"]` |
| ✅ | `S03.section_10` | Creator-Bereich 10: Generate | ui | Element `#sec-generate[data-step="10"]` |
| ✅ | `S03.collapsible` | Bereiche einzeln auf-/zuklappbar | ui | Element `[data-toggle-step="4"]` |

## §4 Source & Unit (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S04.textbook` | Dropdown Lehrmittel | setting | Setting `textbookId` (core.SCHEMA → Control `[data-setting="textbookId"]` → prompts.js) |
| ✅ | `S04.unit` | Dropdown Unit | setting | Setting `unitId` (core.SCHEMA → Control `[data-setting="unitId"]` → prompts.js) |
| ✅ | `S04.use_unit_topic` | Use unit topic ON/OFF | setting | Setting `useUnitTopic` (core.SCHEMA → Control `[data-setting="useUnitTopic"]` → prompts.js) |

## §5 Content (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S05.topic_mode` | Topic: Use Unit Topic / Custom Topic | setting | Setting `topicMode` (core.SCHEMA → Control `[data-setting="topicMode"]` → prompts.js) |
| ✅ | `S05.custom_topic` | Freies Eingabefeld Custom Topic | setting | Setting `customTopic` (core.SCHEMA → Control `[data-setting="customTopic"]` → prompts.js) |
| ✅ | `S05.generate_topic` | Generate topic for me: Szenario-Vorschläge auf Basis der Unit (via Claude) | function | Funktion (siehe Check im Manifest) |

## §6 Language Level (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S06.cefr` | CEFR-Auswahl A2.1–B2.2 | setting | Setting `cefr` (core.SCHEMA → Control `[data-setting="cefr"]` → prompts.js) |
| ✅ | `S06.complexity` | Regler Language Complexity (Satzlänge, Grammatik, Idiomatik, Synonyme, Gesprächssprache, Explizitheit) | setting | Setting `languageComplexity` (core.SCHEMA → Control `[data-setting="languageComplexity"]` → prompts.js) |
| ✅ | `S06.independence` | Language difficulty und Question difficulty unabhängig | function | Funktion (siehe Check im Manifest) |

## §7 Vocabulary Settings (7/7)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S07.usage` | Regler Vocabulary Usage Low–High | setting | Setting `vocabUsage` (core.SCHEMA → Control `[data-setting="vocabUsage"]` → prompts.js) |
| ✅ | `S07.target_count_min` | Target vocabulary count (min) | setting | Setting `targetVocabMin` (core.SCHEMA → Control `[data-setting="targetVocabMin"]` → prompts.js) |
| ✅ | `S07.target_count_max` | Target vocabulary count (max) | setting | Setting `targetVocabMax` (core.SCHEMA → Control `[data-setting="targetVocabMax"]` → prompts.js) |
| ✅ | `S07.manual_mode` | Select vocabulary manually | setting | Setting `vocabSelectionMode` (core.SCHEMA → Control `[data-setting="vocabSelectionMode"]` → prompts.js) |
| ✅ | `S07.manual_list` | Alle Vocabulary-Einträge der Unit auswählbar | setting | Setting `selectedVocab` (core.SCHEMA → Control `[data-setting="selectedVocab"]` → prompts.js) |
| ✅ | `S07.natural` | Vocabulary natürlich integrieren, nicht erzwingen | function | Funktion (siehe Check im Manifest) |
| ✅ | `S07.highlight` | Highlight used target vocabulary in teacher version | setting | Setting `highlightVocab` (core.SCHEMA → Control `[data-setting="highlightVocab"]` → prompts.js) |

## §8 Listening – Audio Structure (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S08.format` | Format Monologue / Dialogue – 2 speakers / Conversation – X speakers | setting | Setting `format` (core.SCHEMA → Control `[data-setting="format"]` → prompts.js) |
| ✅ | `S08.speaker_count` | Conversation: 3 / 4 / 5 / 6 speakers | setting | Setting `speakerCount` (core.SCHEMA → Control `[data-setting="speakerCount"]` → prompts.js) |
| ✅ | `S08.listening_only` | Bereich erscheint nur bei einem Listening | function | Funktion (siehe Check im Manifest) |

## §9 Listening Presets (12/12)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S09.preset_natural` | Preset „natural“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_interview` | Preset „interview“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_podcast` | Preset „podcast“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_discussion` | Preset „discussion“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_debate` | Preset „debate“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_expert` | Preset „expert“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_presentation` | Preset „presentation“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_storytelling` | Preset „storytelling“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_news` | Preset „news“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_casual` | Preset „casual“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_phone` | Preset „phone“ verändert Gesprächsstruktur und Sprechanteile | function | Funktion (siehe Check im Manifest) |
| ✅ | `S09.preset_setting` | Preset-Auswahl im Creator | setting | Setting `preset` (core.SCHEMA → Control `[data-setting="preset"]` → prompts.js) |

## §10 Speaker Distribution (2/2)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S10.balance` | Speaker Balance: Balanced / Natural Variation / Main Speaker / Custom | setting | Setting `speakerBalance` (core.SCHEMA → Control `[data-setting="speakerBalance"]` → prompts.js) |
| ✅ | `S10.custom` | Custom: manuelle Anteile, Summe 100 % | setting | Setting `customShares` (core.SCHEMA → Control `[data-setting="customShares"]` → prompts.js) |

## §11 Turn Length (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S11.turn_length` | Speaking Turn Length Short–Long | setting | Setting `turnLength` (core.SCHEMA → Control `[data-setting="turnLength"]` → prompts.js) |
| ✅ | `S11.turn_presets` | Presets Quick exchange / Natural / Extended | function | Funktion (siehe Check im Manifest) |
| ✅ | `S11.variability` | Turn Length Variability Low–High, Default hoch für Dialoge | setting | Setting `turnVariability` (core.SCHEMA → Control `[data-setting="turnVariability"]` → prompts.js) |

## §12 Audio Length (4/4)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S12.length` | Audio Length 1:00 … 5:00 / Custom | setting | Setting `audioLength` (core.SCHEMA → Control `[data-setting="audioLength"]` → prompts.js) |
| ✅ | `S12.custom_length` | Custom-Länge in Sekunden | setting | Setting `audioLengthCustom` (core.SCHEMA → Control `[data-setting="audioLengthCustom"]` → prompts.js) |
| ✅ | `S12.word_estimate` | Automatische Wortzahl aus Zeit und Sprechtempo | function | Funktion (siehe Check im Manifest) |
| ✅ | `S12.speed` | Speaking Speed Slow–Natural–Fast | setting | Setting `speakingSpeed` (core.SCHEMA → Control `[data-setting="speakingSpeed"]` → prompts.js) |

## §13 Speaker Profiles (1/1)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S13.profiles` | Speaker Profiles: Name, Age, Role, Personality beeinflussen das Gespräch | setting | Setting `speakerProfiles` (core.SCHEMA → Control `[data-setting="speakerProfiles"]` → prompts.js) |

## §14 Emotion & Delivery Tags (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S14.tags` | Emotion & Delivery Tags im Skript ([excited] … [serious]) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S14.level` | Use emotion tags OFF / Low / Medium / High | setting | Setting `emotionTags` (core.SCHEMA → Control `[data-setting="emotionTags"]` → prompts.js) |
| ✅ | `S14.functional` | Tags gezielt/funktional, nicht vor jedem Beitrag | rule | Quality rule `listening.emotion_tags` (gemessen in quality.js) |

## §15 Natural Speech Settings (1/1)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S15.naturalness` | Naturalness Clean/Educational–Authentic (contractions, fillers, hesitation, reactions, unfinished thoughts, reformulations, interruptions, discourse markers) | setting | Setting `naturalness` (core.SCHEMA → Control `[data-setting="naturalness"]` → prompts.js) |

## §16 Information Explicitness (1/1)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S16.explicitness` | Information Explicitness Very Explicit–Highly Implicit | setting | Setting `explicitness` (core.SCHEMA → Control `[data-setting="explicitness"]` → prompts.js) |

## §17 Reading – Text Structure (5/5)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S17.text_type` | Text Type (Story … Dialogue, Custom) | setting | Setting `textType` (core.SCHEMA → Control `[data-setting="textType"]` → prompts.js) |
| ✅ | `S17.custom_type` | Custom text type | setting | Setting `customTextType` (core.SCHEMA → Control `[data-setting="customTextType"]` → prompts.js) |
| ✅ | `S17.length_mode` | Length: word count oder approximate A4 length | setting | Setting `lengthMode` (core.SCHEMA → Control `[data-setting="lengthMode"]` → prompts.js) |
| ✅ | `S17.word_count` | Word count (z. B. 450 words) | setting | Setting `wordCount` (core.SCHEMA → Control `[data-setting="wordCount"]` → prompts.js) |
| ✅ | `S17.a4` | A4-Länge wird in Wortzahl umgerechnet | setting | Setting `a4Pages` (core.SCHEMA → Control `[data-setting="a4Pages"]` → prompts.js) |

## §18 Worksheet (1/1)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S18.toggle` | Create Worksheet ON/OFF; OFF → nur Skript/Text | setting | Setting `createWorksheet` (core.SCHEMA → Control `[data-setting="createWorksheet"]` → prompts.js) |

## §19 Number of Questions (2/2)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S19.count` | Number of Questions 5 / 8 / 10 / 12 / 15 / Custom | setting | Setting `questionCount` (core.SCHEMA → Control `[data-setting="questionCount"]` → prompts.js) |
| ✅ | `S19.custom` | Custom number of questions | setting | Setting `questionCountCustom` (core.SCHEMA → Control `[data-setting="questionCountCustom"]` → prompts.js) |

## §20 Listening / Reading Skills (8/8)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S20.skill_gist` | Listening/Reading Skill „gist“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S20.skill_specific` | Listening/Reading Skill „specific“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S20.skill_detail` | Listening/Reading Skill „detail“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S20.skill_connecting` | Listening/Reading Skill „connecting“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S20.skill_inference` | Listening/Reading Skill „inference“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S20.skill_attitude` | Listening/Reading Skill „attitude“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S20.skill_purpose` | Listening/Reading Skill „purpose“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |
| ✅ | `S20.skill_context` | Listening/Reading Skill „context“ definiert und je Frage zugeordnet | function | Funktion (siehe Check im Manifest) |

## §21 Higher-Order Thinking (4/4)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S21.toggle` | Higher-Order Questions OFF/ON | setting | Setting `higherOrder` (core.SCHEMA → Control `[data-setting="higherOrder"]` → prompts.js) |
| ✅ | `S21.count` | Anzahl Higher-Order-Aufgaben | setting | Setting `higherOrderCount` (core.SCHEMA → Control `[data-setting="higherOrderCount"]` → prompts.js) |
| ✅ | `S21.types` | Typen Interpretation / Transfer / Evaluation | setting | Setting `higherOrderTypes` (core.SCHEMA → Control `[data-setting="higherOrderTypes"]` → prompts.js) |
| ✅ | `S21.separate` | Nicht mit Comprehension-Fragen vermischt (separate Sektion + Prüfung) | rule | Quality rule `questions.higher_order_separate` (gemessen in quality.js) |

## §22 Question Difficulty (2/2)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S22.slider` | Question Difficulty Easy–Challenging | setting | Setting `questionDifficulty` (core.SCHEMA → Control `[data-setting="questionDifficulty"]` → prompts.js) |
| ✅ | `S22.factors` | Schwierigkeit über Explizitheit, Abstand, Synonyme, Verknüpfung, Distraktoren, Inference-Anteil, Fragesprache | function | Funktion (siehe Check im Manifest) |

## §23 Automatic Skill Mix (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S23.auto_mix` | Balanced Question Mix: automatische Verteilung (Summe = Anzahl, Gist enthalten) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S23.shift` | Bei steigender Schwierigkeit verschiebt sich die Gewichtung zu Connecting/Inference/Attitude/Purpose | function | Funktion (siehe Check im Manifest) |
| ✅ | `S23.mode` | Skill mix automatic/custom umschaltbar | setting | Setting `skillMixMode` (core.SCHEMA → Control `[data-setting="skillMixMode"]` → prompts.js) |

## §24 Manual Skill Mix (1/1)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S24.custom_mix` | Custom Question Mix mit Zahlen je Skill | setting | Setting `customSkillMix` (core.SCHEMA → Control `[data-setting="customSkillMix"]` → prompts.js) |

## §25 Question Formats (2/2)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S25.formats` | 14 Frageformate, mehrere gleichzeitig aktivierbar | setting | Setting `questionFormats` (core.SCHEMA → Control `[data-setting="questionFormats"]` → prompts.js) |
| ✅ | `S25.auto_mix` | Automatic balanced mix sorgt für Variation | setting | Setting `autoFormatMix` (core.SCHEMA → Control `[data-setting="autoFormatMix"]` → prompts.js) |

## §26 Question Order (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S26.chronology` | Fragen folgen immer der Reihenfolge des Materials (Listening und Reading, Gist-Ausnahme) – kein Schalter, immer Pflicht | function | Funktion (siehe Check im Manifest) |
| ✅ | `S26.enforce` | Eingehende Fragebögen werden deterministisch in die Reihenfolge des Materials gebracht und neu nummeriert (jede Runde) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S26.check` | Reihenfolge wird anhand der Evidenzstellen geprüft | rule | Quality rule `questions.chronology` (gemessen in quality.js) |

## §27 Pre-Listening / Pre-Reading (3/3)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S27.toggle` | Create Pre-Task | setting | Setting `preTask` (core.SCHEMA → Control `[data-setting="preTask"]` → prompts.js) |
| ✅ | `S27.types` | Formen Prediction / Vocabulary Activation / Speaking Prompt (plus weitere Aufgabentypen, §35) | setting | Setting `preTaskTypes` (core.SCHEMA → Control `[data-setting="preTaskTypes"]` → prompts.js) |
| ✅ | `S27.no_spoilers` | Pre-Task nimmt keine Antworten vorweg | rule | Quality rule `pretask.no_spoilers` (Claude-Review über buildReviewPrompt) |

## §28 Output (15/15)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S28.student_title` | Student Version: Titel | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.student_instruction` | Student Version: kurze Instruktion | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.student_pretask` | Student Version: Pre-Task, falls gewählt | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.student_questions` | Student Version: Fragen/Aufgaben | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.student_reading_text` | Student Version: Reading-Text enthalten | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.student_no_script` | Student Version: beim Listening NICHT das Skript | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.student_no_answers` | Student Version: keine Lösungen | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.teacher_script` | Teacher Version: vollständiges Skript/Text | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.teacher_vocab` | Teacher Version: verwendete Vocabulary Items | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.teacher_key` | Teacher Version: Lösungsschlüssel | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.teacher_skill` | Teacher Version: Zuordnung jeder Frage zum Skill | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.teacher_difficulty` | Teacher Version: Difficulty je Frage | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.teacher_evidence` | Teacher Version: relevante Text-/Audio-Stelle | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S28.teacher_rationale` | Teacher Version: Begründung für Inference-Fragen | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `X.no_hardcoded_content` | Kontrolle: keine hartkodierten Textbausteine für Titel, Instruktion, Fragen, Pre-Tasks oder Themen | function | Funktion (siehe Check im Manifest) |

## §29 Quality Check (32/32)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S29.content.topic_unit` | Quality Check – Content: Thema passt zur Unit | rule | Quality rule `content.topic_unit` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.content.vocab_used` | Quality Check – Content: Zielvokabular sinnvoll verwendet | rule | Quality rule `content.vocab_used` (gemessen in quality.js) |
| ✅ | `S29.content.coherent` | Quality Check – Content: Text kohärent | rule | Quality rule `content.coherent` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.content.natural` | Quality Check – Content: Gespräch wirkt natürlich | rule | Quality rule `content.natural` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.listening.shares` | Quality Check – Listening: Sprechanteile entsprechen den Einstellungen | rule | Quality rule `listening.shares` (gemessen in quality.js) |
| ✅ | `S29.listening.distinguishable` | Quality Check – Listening: Sprecher eindeutig unterscheidbar | rule | Quality rule `listening.distinguishable` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.listening.emotion_tags` | Quality Check – Listening: Emotion-Tags sinnvoll verteilt | rule | Quality rule `listening.emotion_tags` (gemessen in quality.js) |
| ✅ | `S29.listening.no_artificial_switches` | Quality Check – Listening: keine künstlichen Sprecherwechsel | rule | Quality rule `listening.no_artificial_switches` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.questions.answerable` | Quality Check – Questions: jede Frage eindeutig beantwortbar | rule | Quality rule `questions.answerable` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.questions.derivable` | Quality Check – Questions: Antwort aus dem Material ableitbar | rule | Quality rule `questions.derivable` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.questions.distractors` | Quality Check – Questions: Distraktoren plausibel | rule | Quality rule `questions.distractors` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.questions.chronology` | Quality Check – Questions: Audio-/Textreihenfolge | rule | Quality rule `questions.chronology` (gemessen in quality.js) |
| ✅ | `S29.questions.no_duplicates` | Quality Check – Questions: keine zwei Fragen prüfen dieselbe Information | rule | Quality rule `questions.no_duplicates` (gemessen in quality.js) |
| ✅ | `S29.questions.skill_distribution` | Quality Check – Questions: Skill-Verteilung entspricht Einstellungen | rule | Quality rule `questions.skill_distribution` (gemessen in quality.js) |
| ✅ | `S29.questions.difficulty` | Quality Check – Questions: Difficulty entspricht Stufe | rule | Quality rule `questions.difficulty` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.questions.inference_genuine` | Quality Check – Questions: Inference-Fragen wirklich inferentiell | rule | Quality rule `questions.inference_genuine` (Claude-Review über buildReviewPrompt) |
| ✅ | `S29.before_output` | Qualitätskontrolle läuft automatisch vor der Ausgabe (deterministisch + Claude-Review, Revision bei Fehlern) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S29.auto_repair` | Gefundene Probleme werden automatisch behoben (Aus / nur Fehler / Fehler und Warnungen) | setting | Setting `autoFix` (core.SCHEMA → Control `[data-setting="autoFix"]` → prompts.js) |
| ✅ | `S29.auto_repair_rounds` | Mehrere Korrekturrunden, bis die Prüfung sauber ist (max. einstellbar) | setting | Setting `autoFixRounds` (core.SCHEMA → Control `[data-setting="autoFixRounds"]` → prompts.js) |
| ✅ | `S29.targeted_repair` | Beanstandete Fragen werden gezielt ersetzt, der Rest des Arbeitsblatts bleibt unverändert | function | Funktion (siehe Check im Manifest) |
| ✅ | `S29.repair_never_worse` | Eine Korrektur wird nur übernommen, wenn die Prüfung danach besser ausfällt | function | Funktion (siehe Check im Manifest) |
| ✅ | `S29.repair_reported` | Jede angewendete Korrektur wird im Qualitätsbericht ausgewiesen | function | Funktion (siehe Check im Manifest) |
| ✅ | `X.rule_content.vocab_natural` | Quality rule „content.vocab_natural“ (Vocabulary integrated naturally) – zusätzliche Regel über das Konzept hinaus | meta | `content.vocab_natural` — extra rule |
| ✅ | `X.rule_content.level` | Quality rule „content.level“ (Language matches the CEFR level) – zusätzliche Regel über das Konzept hinaus | meta | `content.level` — extra rule |
| ✅ | `X.rule_content.word_count` | Quality rule „content.word_count“ (Length matches the target) – zusätzliche Regel über das Konzept hinaus | meta | `content.word_count` — extra rule |
| ✅ | `X.rule_content.meta_fields` | Quality rule „content.meta_fields“ (Document details for the text type are complete) – zusätzliche Regel über das Konzept hinaus | meta | `content.meta_fields` — extra rule |
| ✅ | `X.rule_listening.speakers_present` | Quality rule „listening.speakers_present“ (All speakers present with the planned labels) – zusätzliche Regel über das Konzept hinaus | meta | `listening.speakers_present` — extra rule |
| ✅ | `X.rule_listening.turns` | Quality rule „listening.turns“ (Turn length and variability match the settings) – zusätzliche Regel über das Konzept hinaus | meta | `listening.turns` — extra rule |
| ✅ | `X.rule_questions.count` | Quality rule „questions.count“ (Number of questions matches) – zusätzliche Regel über das Konzept hinaus | meta | `questions.count` — extra rule |
| ✅ | `X.rule_questions.duplicates_llm` | Quality rule „questions.duplicates_llm“ (No two questions test exactly the same information (review)) – zusätzliche Regel über das Konzept hinaus | meta | `questions.duplicates_llm` — extra rule |
| ✅ | `X.rule_questions.formats` | Quality rule „questions.formats“ (Only enabled response formats are used) – zusätzliche Regel über das Konzept hinaus | meta | `questions.formats` — extra rule |
| ✅ | `X.rule_questions.evidence` | Quality rule „questions.evidence“ (Every question has verifiable evidence) – zusätzliche Regel über das Konzept hinaus | meta | `questions.evidence` — extra rule |

## §30 Advanced Settings (24/24)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S30.chronology` | Advanced: chronology – immer aktiv, kein Schalter (siehe §26) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.speakerCount` | Advanced: number of speakers (= Einstellung „speakerCount“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.customShares` | Advanced: individual speaker share (= Einstellung „customShares“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.turnLength` | Advanced: average turn length (= Einstellung „turnLength“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.turnVariability` | Advanced: turn variability (= Einstellung „turnVariability“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.speakingSpeed` | Advanced: speaking speed (= Einstellung „speakingSpeed“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.naturalness` | Advanced: natural speech (= Einstellung „naturalness“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.emotionTags` | Advanced: emotion frequency (= Einstellung „emotionTags“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.explicitness` | Advanced: information explicitness (= Einstellung „explicitness“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.wordCount` | Advanced: word count (= Einstellung „wordCount“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.paragraphLength` | Advanced: paragraph length | setting | Setting `paragraphLength` (core.SCHEMA → Control `[data-setting="paragraphLength"]` → prompts.js) |
| ✅ | `S30.dialogueProportion` | Advanced: dialogue proportion | setting | Setting `dialogueProportion` (core.SCHEMA → Control `[data-setting="dialogueProportion"]` → prompts.js) |
| ✅ | `S30.styleBalance` | Advanced: narrative vs. informational style | setting | Setting `styleBalance` (core.SCHEMA → Control `[data-setting="styleBalance"]` → prompts.js) |
| ✅ | `S30.cefr` | Advanced: CEFR (= Einstellung „cefr“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.grammarComplexity` | Advanced: grammar complexity | setting | Setting `grammarComplexity` (core.SCHEMA → Control `[data-setting="grammarComplexity"]` → prompts.js) |
| ✅ | `S30.vocabularyDifficulty` | Advanced: vocabulary difficulty | setting | Setting `vocabularyDifficulty` (core.SCHEMA → Control `[data-setting="vocabularyDifficulty"]` → prompts.js) |
| ✅ | `S30.vocabUsage` | Advanced: target vocabulary density (= Einstellung „vocabUsage“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.idiomaticLanguage` | Advanced: idiomatic language | setting | Setting `idiomaticLanguage` (core.SCHEMA → Control `[data-setting="idiomaticLanguage"]` → prompts.js) |
| ✅ | `S30.questionCount` | Advanced: number (questions) (= Einstellung „questionCount“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.questionDifficulty` | Advanced: difficulty (questions) (= Einstellung „questionDifficulty“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.skillMixMode` | Advanced: skill distribution (= Einstellung „skillMixMode“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.questionFormats` | Advanced: response formats (= Einstellung „questionFormats“) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S30.distractorDifficulty` | Advanced: distractor difficulty | setting | Setting `distractorDifficulty` (core.SCHEMA → Control `[data-setting="distractorDifficulty"]` → prompts.js) |
| ✅ | `S30.inferenceLevel` | Advanced: inference level | setting | Setting `inferenceLevel` (core.SCHEMA → Control `[data-setting="inferenceLevel"]` → prompts.js) |

## §31 Simple vs. Advanced Mode (2/2)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S31.toggle` | Simple Mode / Advanced Mode umschaltbar | ui | Element `#mode-toggle` |
| ✅ | `S31.simple_keys` | Simple Mode zeigt nur Unit, Topic, Level, Length, Format, Question Difficulty, Number of Questions, Generate | function | Funktion (siehe Check im Manifest) |

## §32 Beispielkonfiguration (1/1)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S32.example` | Beispielkonfiguration (Podcast Interview, B1.2, 3 min, 30/70, 10 Fragen, Skill-Mix, MC/Short Answer/Matching) ladbar | function | Funktion (siehe Check im Manifest) |

## §33 Word-Export (formatiert, typgerecht) (27/27)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S33.button_student` | Download „Word: Schülerversion“ | ui | Element `[data-download="docx-student"]` |
| ✅ | `S33.button_teacher` | Download „Word: Lehrerversion“ | ui | Element `[data-download="docx-teacher"]` |
| ✅ | `S33.filename` | Datei wird als .docx mit sprechendem Namen ausgeliefert | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.valid_package` | Erzeugte Word-Datei ist ein gültiges OOXML-Paket (Teile, Content-Types, Beziehungen, Elementreihenfolge) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_per_type` | Jeder Texttyp hat ein eigenes Dokument-Design (Schrift, Akzentfarbe, Satzspiegel) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_story` | Design „story“ (Story) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_article` | Design „article“ (Article) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_news` | Design „news“ (News Article) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_blog` | Design „blog“ (Blog Post) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_email` | Design „email“ (Email) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_forum` | Design „forum“ (Forum Discussion) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_interview` | Design „interview“ (Interview) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_review` | Design „review“ (Review) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_report` | Design „report“ (Report) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_diary` | Design „diary“ (Diary Entry) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_informational` | Design „informational“ (Informational Text) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_opinion` | Design „opinion“ (Opinion Text) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_dialogue` | Design „dialogue“ (Dialogue) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_custom` | Design „custom“ (Custom) enthält die typischen Elemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.design_script` | Listening-Skript wird als Aufnahme-Skript gesetzt (Zeilennummern, Sprecher, Emotion-Tags, Setting) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.student_no_script` | Word-Schülerversion enthält beim Listening kein Skript (ausser die Option „Skript auf der letzten Seite“ ist gewählt) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.student_worksheet` | Word-Schülerversion ist ein echtes Arbeitsblatt (Name/Klasse/Datum, Ankreuzkästchen, Schreiblinien, Seitenzahl) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.teacher_key` | Word-Lehrerversion enthält Skript/Text, Vokabeln, Lösungsschlüssel mit Skill, Difficulty, Evidenz und Qualitätsbericht | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.teacher_highlight` | Zielvokabular wird in der Word-Lehrerversion hervorgehoben (Schalter wirkt) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.meta_from_claude` | Dokument-Angaben (Byline, From/To/Subject, Usernames, Rating …) stammen von Claude, nicht aus dem Code | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.reading_text_in_student` | Word-Schülerversion enthält beim Reading den Text im Layout des Texttyps und danach das Arbeitsblatt | function | Funktion (siehe Check im Manifest) |
| ✅ | `S33.html_matches` | Die Bildschirmvorschau zeigt denselben Texttyp-Aufbau wie das Word-Dokument | function | Funktion (siehe Check im Manifest) |

## §34 Schwierigkeitsmesser & Niveau der Fragen (13/13)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S34.meter_setting` | Schalter „Schwierigkeit messen und nachsteuern“ (Ziel-Niveau = CEFR-Auswahl; Messwerte als Vorgaben im Prompt) | setting | Setting `levelMeter` (core.SCHEMA → Control `[data-setting="levelMeter"]` → prompts.js) |
| ✅ | `S34.dimensions` | Messer bewertet Satzlänge, Wortschatz (>2000 / >3500 Häufigkeitsrang), Nebensätze, anspruchsvolle Grammatik, Idiomatik und Beitragslänge | function | Funktion (siehe Check im Manifest) |
| ✅ | `S34.anchor` | Kalibrierung: das Podcast-Skript „Screen Time“ misst B1.2 (Ankerpunkt), A2- und B2-Beispiele ordnen sich monoton ein | function | Funktion (siehe Check im Manifest) |
| ✅ | `S34.descriptors` | Jede Stufe A2.1–B2.2 ist mit Hör-/Lese-Deskriptor (GER-Begleitband) und sprachlichen Merkmalen hinterlegt | function | Funktion (siehe Check im Manifest) |
| ✅ | `S34.rule` | Quality Check – gemessene Schwierigkeit gegen das Ziel-Niveau (Warnung bei 1 Stufe, Fehler ab 2 Stufen, mit konkreten Korrekturhinweisen) | rule | Quality rule `content.level_measured` (gemessen in quality.js) |
| ✅ | `S34.repair` | Abweichungen des Messers fliessen als Korrekturauftrag in die Textüberarbeitung ein (automatische Korrektur) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S34.output` | Messung wird im Quality-Tab, in der Lehrerversion (HTML, Markdown, Word) ausgewiesen | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S34.page` | Seite „Niveau messen“: Skript/Text einfügen, messen, Zweitmeinung von Claude | ui | Element `#nav-level` |
| ✅ | `S34.question_level` | Meta-Einstellung Niveau der Fragen: Niveau B = B1.1, Niveau A = B1.2–B2.1, „Beide“ erzeugt zwei Fragebögen | setting | Setting `questionLevel` (core.SCHEMA → Control `[data-setting="questionLevel"]` → prompts.js) |
| ✅ | `S34.variants_output` | „Beide“: je eine Schülerversion pro Niveau (Bildschirm, HTML, Word A/B), Lehrerversion mit beiden Lösungen, Prüfung je Fragebogen | render | render.js (renderStudentHTML / renderTeacherHTML) |
| ✅ | `S34.band_rule` | Quality Check – jede Frage trägt eine Stufe innerhalb des erlaubten Fragen-Niveaus | rule | Quality rule `questions.level_band` (gemessen in quality.js) |
| ✅ | `S34.glossary` | Option „Fremdwörter auf der 1. Seite erklärt“: Messer wählt die Wörter über dem Niveau (ohne Zielvokabular), Claude erklärt sie; Ausgabe auf Seite 1 (HTML, Word) | setting | Setting `glossary` (core.SCHEMA → Control `[data-setting="glossary"]` → prompts.js) |
| ✅ | `S34.append_script` | Option „Skript auf der letzten Seite abgebildet“ (Listening): Schülerversion endet mit dem Skript (HTML, Word, Markdown) | setting | Setting `appendScript` (core.SCHEMA → Control `[data-setting="appendScript"]` → prompts.js) |

## §35 Pre-Task: Typen, Sozialformen, Anforderungsniveau (30/30)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S35.section` | Eigener Creator-Bereich „Pre-Task“ | ui | Element `#sec-pretask[data-step="7"]` |
| ✅ | `S35.focus` | Pre-Task ums Thema, ums Vokabular oder um beides | setting | Setting `preTaskFocus` (core.SCHEMA → Control `[data-setting="preTaskFocus"]` → prompts.js) |
| ✅ | `S35.count` | Anzahl der Pre-Task-Aufgaben einstellbar | setting | Setting `preTaskCount` (core.SCHEMA → Control `[data-setting="preTaskCount"]` → prompts.js) |
| ✅ | `S35.types` | Aufgabentypen wählbar: Konfrontation, Vorwissen, Wortfeld, Ranking, Umfrage, Sprechimpuls, Wortschatz, Hypothesen, Prediction | setting | Setting `preTaskTypes` (core.SCHEMA → Control `[data-setting="preTaskTypes"]` → prompts.js) |
| ✅ | `S35.confrontation` | Konfrontationsaufgabe: zugespitzte These/Dilemma, beidseitig vertretbar, ohne das Material lösbar | function | Funktion (siehe Check im Manifest) |
| ✅ | `S35.social_mode` | Sozialformen automatisch verteilen oder selbst festlegen | setting | Setting `preTaskSocialMode` (core.SCHEMA → Control `[data-setting="preTaskSocialMode"]` → prompts.js) |
| ✅ | `S35.social_custom` | Wie viele Einzel-, Partner-, Gruppen- und Plenumsarbeiten | setting | Setting `customPreTaskSocial` (core.SCHEMA → Control `[data-setting="customPreTaskSocial"]` → prompts.js) |
| ✅ | `S35.oral` | Wie viele Aufgaben mündlich gelöst werden (nur mit interaktiver Sozialform) | setting | Setting `preTaskOralCount` (core.SCHEMA → Control `[data-setting="preTaskOralCount"]` → prompts.js) |
| ✅ | `S35.social_auto` | Automatische Sozialformen: genug interaktive Formen für die mündlichen Aufgaben, feste Zuordnung pro Aufgabe | function | Funktion (siehe Check im Manifest) |
| ✅ | `S35.difficulty` | Kriterienorientiertes Anforderungsniveau der Pre-Task (reproduktiv bis Position beziehen) | setting | Setting `preTaskDifficulty` (core.SCHEMA → Control `[data-setting="preTaskDifficulty"]` → prompts.js) |
| ✅ | `S35.scaffolding` | Hilfestellungen (Beispiel, Wortspeicher, Satzanfänge, Musterlösung) | setting | Setting `preTaskScaffolding` (core.SCHEMA → Control `[data-setting="preTaskScaffolding"]` → prompts.js) |
| ✅ | `S35.level` | Sprachniveau der Aufgabenstellung (wie die Fragen, Niveau A oder B) | setting | Setting `preTaskLevel` (core.SCHEMA → Control `[data-setting="preTaskLevel"]` → prompts.js) |
| ✅ | `S35.criteria` | Gelingenskriterien pro Aufgabe (kriterienorientiert), auf dem Arbeitsblatt ausgewiesen | setting | Setting `preTaskCriteria` (core.SCHEMA → Control `[data-setting="preTaskCriteria"]` → prompts.js) |
| ✅ | `S35.minutes` | Zeitbudget der Pre-Task, auf die Aufgaben verteilt | setting | Setting `preTaskMinutes` (core.SCHEMA → Control `[data-setting="preTaskMinutes"]` → prompts.js) |
| ✅ | `S35.rule_present` | Kontrolle: Anzahl und Typen der Pre-Task-Aufgaben stimmen | rule | Quality rule `pretask.present` (gemessen in quality.js) |
| ✅ | `S35.rule_social` | Kontrolle: Sozialformen entsprechen den Einstellungen | rule | Quality rule `pretask.social_forms` (gemessen in quality.js) |
| ✅ | `S35.rule_modes` | Kontrolle: mündliche und schriftliche Aufgaben wie eingestellt, mündlich nie in Einzelarbeit | rule | Quality rule `pretask.modes` (gemessen in quality.js) |
| ✅ | `S35.rule_focus` | Kontrolle: Wortschatzaufgaben arbeiten mit dem Zielvokabular, Themenaufgaben mit dem Thema | rule | Quality rule `pretask.focus` (gemessen in quality.js) |
| ✅ | `S35.rule_criteria` | Kontrolle: Gelingenskriterien vorhanden und kurz | rule | Quality rule `pretask.criteria` (gemessen in quality.js) |
| ✅ | `S35.rule_time` | Kontrolle: Zeitangaben vorhanden und im Budget | rule | Quality rule `pretask.time` (gemessen in quality.js) |
| ✅ | `S35.rule_language` | Kontrolle: Aufgabenstellung bleibt auf dem eingestellten Sprachniveau | rule | Quality rule `pretask.language` (gemessen in quality.js) |
| ✅ | `S35.rule_spoilers` | Kontrolle (Claude): Pre-Task nimmt keine Antwort vorweg | rule | Quality rule `pretask.no_spoilers` (Claude-Review über buildReviewPrompt) |
| ✅ | `S35.rule_solvable` | Kontrolle (Claude): Pre-Task ist ohne das Material lösbar | rule | Quality rule `pretask.solvable_before` (Claude-Review über buildReviewPrompt) |
| ✅ | `S35.rule_social_fits` | Kontrolle (Claude): Sozialform und Arbeitsweise passen zur Aufgabe | rule | Quality rule `pretask.social_fits` (Claude-Review über buildReviewPrompt) |
| ✅ | `S35.rule_confrontation` | Kontrolle (Claude): Konfrontationsaufgabe konfrontiert wirklich | rule | Quality rule `pretask.confrontation` (Claude-Review über buildReviewPrompt) |
| ✅ | `S35.presets` | Schnellwahl: typische Pre-Task-Folgen mit einem Klick (Aufgabentypen, Sozialformen, Zeit, Anforderungsniveau) | ui | Element `#pre-task-presets` |
| ✅ | `S35.preview` | Vorschau im Creator: geplante Abfolge mit Sozialform, Arbeitsweise und Minuten, Probleme schon vor dem Generieren | ui | Element `#pre-task-preview` |
| ✅ | `S35.simple_access` | Auch im Simple Mode bedienbar: Schnellwahl und Vorschau stehen ausserhalb der Advanced-Steuerelemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S35.repair` | Beanstandete Pre-Task wird gezielt neu erstellt, die Fragen bleiben unverändert | function | Funktion (siehe Check im Manifest) |
| ✅ | `S35.output` | Sozialform, Arbeitsweise, Zeit und Kriterien stehen auf dem Arbeitsblatt (Bildschirm, Word, Markdown); Lehrerversion mit Pre-Task-Übersicht | render | render.js (renderStudentHTML / renderTeacherHTML) |

## §36 Post-Task: Typen, Sozialformen, Anforderungsniveau (31/31)

| Status | ID | Anforderung | Art | Umsetzung |
|---|---|---|---|---|
| ✅ | `S36.section` | Eigener Creator-Bereich „Post-Task“ | ui | Element `#sec-posttask[data-step="8"]` |
| ✅ | `S36.toggle` | Post-Task erstellen (Aufgaben nach dem Hören/Lesen) | setting | Setting `postTask` (core.SCHEMA → Control `[data-setting="postTask"]` → prompts.js) |
| ✅ | `S36.focus` | Post-Task um den Inhalt, ums Vokabular oder um beides | setting | Setting `postTaskFocus` (core.SCHEMA → Control `[data-setting="postTaskFocus"]` → prompts.js) |
| ✅ | `S36.count` | Anzahl der Post-Task-Aufgaben einstellbar | setting | Setting `postTaskCount` (core.SCHEMA → Control `[data-setting="postTaskCount"]` → prompts.js) |
| ✅ | `S36.types` | Aufgabentypen: Diskussion, Debatte, Rollenspiel, Transfer, Sprachmittlung, Stellungnahme, kreatives Produkt, Wortschatz, Recherche, Partnerfeedback | setting | Setting `postTaskTypes` (core.SCHEMA → Control `[data-setting="postTaskTypes"]` → prompts.js) |
| ✅ | `S36.social_mode` | Sozialformen automatisch verteilen oder selbst festlegen | setting | Setting `postTaskSocialMode` (core.SCHEMA → Control `[data-setting="postTaskSocialMode"]` → prompts.js) |
| ✅ | `S36.social_custom` | Wie viele Einzel-, Partner-, Gruppen- und Plenumsarbeiten | setting | Setting `customPostTaskSocial` (core.SCHEMA → Control `[data-setting="customPostTaskSocial"]` → prompts.js) |
| ✅ | `S36.oral` | Wie viele Aufgaben mündlich gelöst werden (nur mit interaktiver Sozialform) | setting | Setting `postTaskOralCount` (core.SCHEMA → Control `[data-setting="postTaskOralCount"]` → prompts.js) |
| ✅ | `S36.difficulty` | Kriterienorientiertes Anforderungsniveau (wiedergeben bis eigenes Produkt und Kritik) | setting | Setting `postTaskDifficulty` (core.SCHEMA → Control `[data-setting="postTaskDifficulty"]` → prompts.js) |
| ✅ | `S36.scaffolding` | Hilfestellungen (Beispiel, Wortspeicher, Satzanfänge, Musterlösung) | setting | Setting `postTaskScaffolding` (core.SCHEMA → Control `[data-setting="postTaskScaffolding"]` → prompts.js) |
| ✅ | `S36.level` | Sprachniveau der Aufgabenstellung (wie die Fragen, Niveau A oder B) | setting | Setting `postTaskLevel` (core.SCHEMA → Control `[data-setting="postTaskLevel"]` → prompts.js) |
| ✅ | `S36.criteria` | Gelingenskriterien pro Aufgabe, auf dem Arbeitsblatt ausgewiesen | setting | Setting `postTaskCriteria` (core.SCHEMA → Control `[data-setting="postTaskCriteria"]` → prompts.js) |
| ✅ | `S36.minutes` | Zeitbudget der Post-Task, auf die Aufgaben verteilt | setting | Setting `postTaskMinutes` (core.SCHEMA → Control `[data-setting="postTaskMinutes"]` → prompts.js) |
| ✅ | `S36.shared_planner` | Pre- und Post-Task werden von derselben geprüften Mechanik geplant (Typ, Sozialform, Arbeitsweise, Zeit pro Position) | function | Funktion (siehe Check im Manifest) |
| ✅ | `S36.rule_present` | Kontrolle: Anzahl und Typen der Post-Task-Aufgaben stimmen | rule | Quality rule `posttask.present` (gemessen in quality.js) |
| ✅ | `S36.rule_social` | Kontrolle: Sozialformen entsprechen den Einstellungen | rule | Quality rule `posttask.social_forms` (gemessen in quality.js) |
| ✅ | `S36.rule_modes` | Kontrolle: mündliche und schriftliche Aufgaben wie eingestellt, mündlich nie in Einzelarbeit | rule | Quality rule `posttask.modes` (gemessen in quality.js) |
| ✅ | `S36.rule_focus` | Kontrolle: Inhalt weitergedacht, Zielvokabular produktiv verwendet | rule | Quality rule `posttask.focus` (gemessen in quality.js) |
| ✅ | `S36.rule_criteria` | Kontrolle: Gelingenskriterien vorhanden und kurz | rule | Quality rule `posttask.criteria` (gemessen in quality.js) |
| ✅ | `S36.rule_time` | Kontrolle: Zeitangaben vorhanden und im Budget | rule | Quality rule `posttask.time` (gemessen in quality.js) |
| ✅ | `S36.rule_language` | Kontrolle: Aufgabenstellung bleibt auf dem eingestellten Sprachniveau | rule | Quality rule `posttask.language` (gemessen in quality.js) |
| ✅ | `S36.rule_product` | Kontrolle: jede Aufgabe nennt ihren Ansatzpunkt im Material und ihr Produkt | rule | Quality rule `posttask.product` (gemessen in quality.js) |
| ✅ | `S36.rule_uses_material` | Kontrolle (Claude): Post-Task setzt am Material an | rule | Quality rule `posttask.uses_material` (Claude-Review über buildReviewPrompt) |
| ✅ | `S36.rule_beyond` | Kontrolle (Claude): Post-Task geht über die Verständnisfragen hinaus | rule | Quality rule `posttask.beyond_questions` (Claude-Review über buildReviewPrompt) |
| ✅ | `S36.rule_social_fits` | Kontrolle (Claude): Sozialform und Arbeitsweise passen zur Aufgabe | rule | Quality rule `posttask.social_fits` (Claude-Review über buildReviewPrompt) |
| ✅ | `S36.rule_mediation` | Kontrolle (Claude): Sprachmittlung nennt Adressat und Zweck | rule | Quality rule `posttask.mediation` (Claude-Review über buildReviewPrompt) |
| ✅ | `S36.presets` | Schnellwahl: typische Post-Task-Folgen mit einem Klick (Aufgabentypen, Sozialformen, Zeit, Anforderungsniveau) | ui | Element `#post-task-presets` |
| ✅ | `S36.preview` | Vorschau im Creator: geplante Abfolge mit Sozialform, Arbeitsweise und Minuten, Probleme schon vor dem Generieren | ui | Element `#post-task-preview` |
| ✅ | `S36.simple_access` | Auch im Simple Mode bedienbar: Schnellwahl und Vorschau stehen ausserhalb der Advanced-Steuerelemente | function | Funktion (siehe Check im Manifest) |
| ✅ | `S36.repair` | Beanstandete Post-Task wird gezielt neu erstellt, Fragen und Pre-Task bleiben unverändert | function | Funktion (siehe Check im Manifest) |
| ✅ | `S36.output` | Post-Task steht nach den Fragen auf dem Arbeitsblatt (Bildschirm, Word, Markdown) mit Sozialform, Arbeitsweise, Zeit, Produkt und Kriterien; Lehrerversion mit Übersicht | render | render.js (renderStudentHTML / renderTeacherHTML) |

## Einstellungen (core.SCHEMA)

| Key | Typ | Bereich | Modus | Simple Mode | Default |
|---|---|---|---|---|---|
| `textbookId` | select | 1 | both | ja | `""` |
| `unitId` | select | 1 | both | ja | `""` |
| `useUnitTopic` | toggle | 1 | both | nein | `true` |
| `topicMode` | select | 2 | both | ja | `"unit"` |
| `customTopic` | text | 2 | both | ja | `""` |
| `cefr` | select | 3 | both | ja | `"B1.1"` |
| `levelMeter` | toggle | 3 | both | ja | `true` |
| `languageComplexity` | range | 3 | both | nein | `50` |
| `grammarComplexity` | range | 9 | both | nein | `50` |
| `vocabularyDifficulty` | range | 9 | both | nein | `50` |
| `idiomaticLanguage` | range | 9 | both | nein | `40` |
| `format` | select | 4 | listening | ja | `"dialogue"` |
| `speakerCount` | select | 4 | listening | ja | `3` |
| `preset` | select | 4 | listening | ja | `"natural"` |
| `speakerBalance` | select | 4 | listening | nein | `"natural"` |
| `customShares` | list | 4 | listening | nein | `[50,50]` |
| `turnLength` | range | 4 | listening | nein | `45` |
| `turnVariability` | range | 4 | listening | nein | `70` |
| `audioLength` | select | 4 | listening | ja | `"120"` |
| `audioLengthCustom` | number | 4 | listening | ja | `200` |
| `speakingSpeed` | range | 4 | listening | nein | `50` |
| `speakerProfiles` | list | 4 | listening | nein | `[]` |
| `emotionTags` | select | 4 | listening | nein | `"medium"` |
| `naturalness` | range | 4 | listening | nein | `50` |
| `explicitness` | range | 4 | both | nein | `40` |
| `textType` | select | 4 | reading | ja | `"Article"` |
| `customTextType` | text | 4 | reading | ja | `""` |
| `lengthMode` | select | 4 | reading | ja | `"words"` |
| `wordCount` | number | 4 | reading | ja | `450` |
| `a4Pages` | select | 4 | reading | ja | `"1"` |
| `paragraphLength` | select | 9 | reading | nein | `"medium"` |
| `dialogueProportion` | range | 9 | reading | nein | `20` |
| `styleBalance` | range | 9 | reading | nein | `50` |
| `vocabUsage` | range | 5 | both | nein | `50` |
| `targetVocabMin` | number | 5 | both | nein | `8` |
| `targetVocabMax` | number | 5 | both | nein | `12` |
| `vocabSelectionMode` | select | 5 | both | nein | `"auto"` |
| `selectedVocab` | list | 5 | both | nein | `[]` |
| `highlightVocab` | toggle | 5 | both | nein | `true` |
| `createWorksheet` | toggle | 6 | both | ja | `true` |
| `questionCount` | select | 6 | both | ja | `"10"` |
| `questionCountCustom` | number | 6 | both | ja | `7` |
| `questionDifficulty` | range | 6 | both | ja | `50` |
| `skillMixMode` | select | 6 | both | nein | `"auto"` |
| `customSkillMix` | map | 6 | both | nein | `{"gist":1,"specific":2,"detail":2,"connecting":2,"inference":2,"attitude":1,"purpose":0,"context":0}` |
| `questionFormats` | multiselect | 6 | both | nein | `["multiple_choice","true_false","short_answer","wh_question","sentence_completion"]` |
| `autoFormatMix` | toggle | 6 | both | nein | `true` |
| `questionLevel` | select | 6 | both | ja | `"auto"` |
| `glossary` | toggle | 6 | both | ja | `false` |
| `appendScript` | toggle | 6 | listening | ja | `false` |
| `higherOrder` | toggle | 6 | both | nein | `false` |
| `higherOrderCount` | number | 6 | both | nein | `2` |
| `higherOrderTypes` | multiselect | 6 | both | nein | `["interpretation","transfer","evaluation"]` |
| `distractorDifficulty` | range | 9 | both | nein | `50` |
| `inferenceLevel` | range | 9 | both | nein | `50` |
| `autoFix` | select | 9 | both | nein | `"all"` |
| `autoFixRounds` | number | 9 | both | nein | `2` |
| `preTask` | toggle | 7 | both | nein | `false` |
| `preTaskFocus` | select | 7 | both | nein | `"both"` |
| `preTaskCount` | number | 7 | both | nein | `2` |
| `preTaskTypes` | multiselect | 7 | both | nein | `["prediction","vocabulary"]` |
| `preTaskSocialMode` | select | 7 | both | nein | `"auto"` |
| `customPreTaskSocial` | map | 7 | both | nein | `{"single":1,"pair":1,"group":0,"plenary":0}` |
| `preTaskOralCount` | number | 7 | both | nein | `1` |
| `preTaskDifficulty` | range | 7 | both | nein | `40` |
| `preTaskLevel` | select | 7 | both | nein | `"auto"` |
| `preTaskScaffolding` | range | 7 | both | nein | `50` |
| `preTaskCriteria` | toggle | 7 | both | nein | `true` |
| `preTaskMinutes` | number | 7 | both | nein | `8` |
| `postTask` | toggle | 8 | both | nein | `false` |
| `postTaskFocus` | select | 8 | both | nein | `"both"` |
| `postTaskCount` | number | 8 | both | nein | `2` |
| `postTaskTypes` | multiselect | 8 | both | nein | `["discussion","transfer"]` |
| `postTaskSocialMode` | select | 8 | both | nein | `"auto"` |
| `customPostTaskSocial` | map | 8 | both | nein | `{"single":1,"pair":1,"group":0,"plenary":0}` |
| `postTaskOralCount` | number | 8 | both | nein | `1` |
| `postTaskDifficulty` | range | 8 | both | nein | `60` |
| `postTaskLevel` | select | 8 | both | nein | `"auto"` |
| `postTaskScaffolding` | range | 8 | both | nein | `50` |
| `postTaskCriteria` | toggle | 8 | both | nein | `true` |
| `postTaskMinutes` | number | 8 | both | nein | `15` |

## Qualitätsregeln (quality.RULES)

| ID | Gruppe | Art | Blockierend | Titel |
|---|---|---|---|---|
| `content.topic_unit` | content | llm | nein | Topic fits the unit |
| `content.vocab_used` | content | deterministic | ja | Target vocabulary used sensibly |
| `content.vocab_natural` | content | llm | nein | Vocabulary integrated naturally |
| `content.coherent` | content | llm | ja | Text is coherent |
| `content.natural` | content | llm | nein | Conversation/text sounds natural |
| `content.level` | content | llm | ja | Language matches the CEFR level |
| `content.level_measured` | content | deterministic | nein | Measured difficulty matches the CEFR level |
| `content.word_count` | content | deterministic | ja | Length matches the target |
| `content.meta_fields` | content | deterministic | nein | Document details for the text type are complete |
| `listening.shares` | listening | deterministic | ja | Speaking shares match the settings |
| `listening.speakers_present` | listening | deterministic | ja | All speakers present with the planned labels |
| `listening.distinguishable` | listening | llm | nein | Speakers are clearly distinguishable |
| `listening.emotion_tags` | listening | deterministic | nein | Emotion tags are distributed sensibly |
| `listening.turns` | listening | deterministic | nein | Turn length and variability match the settings |
| `listening.no_artificial_switches` | listening | llm | nein | No unnecessarily artificial speaker changes |
| `questions.count` | questions | deterministic | ja | Number of questions matches |
| `questions.answerable` | questions | llm | ja | Every question is answerable unambiguously |
| `questions.derivable` | questions | llm | ja | Correct answer follows from the material |
| `questions.distractors` | questions | llm | nein | Distractors are plausible |
| `questions.chronology` | questions | deterministic | ja | Questions follow the timeline of the audio/text |
| `questions.no_duplicates` | questions | deterministic | nein | No two questions test the same information |
| `questions.duplicates_llm` | questions | llm | nein | No two questions test exactly the same information (review) |
| `questions.skill_distribution` | questions | deterministic | ja | Skill distribution matches the settings |
| `questions.formats` | questions | deterministic | ja | Only enabled response formats are used |
| `questions.level_band` | questions | deterministic | nein | Question bands stay within the question level |
| `questions.difficulty` | questions | llm | nein | Difficulty matches the requested level |
| `questions.inference_genuine` | questions | llm | ja | Inference questions are genuinely inferential |
| `questions.evidence` | questions | deterministic | nein | Every question has verifiable evidence |
| `questions.higher_order_separate` | questions | deterministic | nein | Higher-order tasks are separate and complete |
| `pretask.present` | pretask | deterministic | ja | Number and types of the pre-tasks match the plan |
| `pretask.social_forms` | pretask | deterministic | ja | Social forms match the settings (individual, partner, group, plenary) |
| `pretask.modes` | pretask | deterministic | ja | Oral and written tasks as configured |
| `pretask.focus` | pretask | deterministic | nein | Pre-task prepares topic and target vocabulary as configured |
| `pretask.criteria` | pretask | deterministic | nein | Every pre-task carries observable success criteria |
| `pretask.time` | pretask | deterministic | nein | Time budget of the pre-task is kept |
| `pretask.language` | pretask | deterministic | nein | Pre-task instructions stay at the configured level |
| `pretask.no_spoilers` | pretask | llm | ja | Pre-task does not give away answers |
| `pretask.solvable_before` | pretask | llm | ja | Pre-task is solvable without the material |
| `pretask.social_fits` | pretask | llm | nein | Social form and working mode fit the task |
| `pretask.confrontation` | pretask | llm | nein | Confrontation task really confronts |
| `posttask.present` | posttask | deterministic | ja | Number and types of the post-tasks match the plan |
| `posttask.social_forms` | posttask | deterministic | ja | Social forms match the settings (individual, partner, group, plenary) |
| `posttask.modes` | posttask | deterministic | ja | Oral and written tasks as configured |
| `posttask.focus` | posttask | deterministic | nein | Post-task takes the content further and uses the target vocabulary as configured |
| `posttask.criteria` | posttask | deterministic | nein | Every post-task carries observable success criteria |
| `posttask.time` | posttask | deterministic | nein | Time budget of the post-task is kept |
| `posttask.language` | posttask | deterministic | nein | Post-task instructions stay at the configured level |
| `posttask.product` | posttask | deterministic | nein | Every post-task names what it starts from and what is produced |
| `posttask.uses_material` | posttask | llm | ja | Post-task builds on the material |
| `posttask.beyond_questions` | posttask | llm | ja | Post-task goes beyond the comprehension questions |
| `posttask.social_fits` | posttask | llm | nein | Social form and working mode fit the task |
| `posttask.mediation` | posttask | llm | nein | Mediation task names addressee and purpose |
