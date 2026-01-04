# ai-autopilot (ioBroker Adapter)

**ai-autopilot** ist ein experimenteller, aber modular aufgebauter ioBroker-Adapter zur
Analyse von Energie-, Wasser-, Temperatur- und weiteren Haushaltsdaten.  
Er kombiniert **Live-Daten** mit **historischen Daten** (InfluxDB / SQL) und erzeugt
strukturierte **Auswertungen, Statistiken und Handlungsempfehlungen**.

> ⚠️ **Status:**  
> Der Adapter befindet sich im Aufbau. Struktur, APIs und Konfiguration können sich
> noch ändern. Für produktive Systeme nur mit Vorsicht einsetzen.

---

## 🎯 Ziel des Adapters

Ziel ist ein **intelligenter Analyse- und Entscheidungs-Adapter**, der:

- **alle potenziellen Datenquellen automatisch erkennt**
  (Shelly, Sonoff, Homematic, Modbus, M-Bus, MQTT, Zigbee, …)
- diese **im Admin konfigurierbar** macht
- dem Nutzer erlaubt, **die Rolle jedes Datenpunkts festzulegen**
- **Live- und Historien-Daten** gemeinsam auswertet
- daraus **klare Statistiken und verständliche Berichte** erstellt
- **keine Aktoren automatisch schaltet**, sondern Empfehlungen liefert

---

## ✨ Kernfunktionen

### 🔍 Automatische Datenquellen-Erkennung
- Scan aller installierten ioBroker-Adapter
- Erkennung typischer Messrollen:
  - Leistung (W)
  - Energie (Wh / kWh)
  - Temperatur (°C)
  - Wasser (l / m³)
- Vorschläge werden angezeigt, aber **nicht automatisch aktiviert**

---

### ⚙️ Flexible Zuordnung im Admin (Custom React UI)

Für **jeden Datenpunkt** kann festgelegt werden:

- ✅ Aktiv / Inaktiv
- 🔌 Typ:
  - Gesamtverbrauch
  - Einzelverbraucher
  - Stromquelle (z. B. PV)
  - Netzbezug / Einspeisung
  - Batterie
  - Wallbox / EV
  - Wasser / Leckage
  - Temperatur / Raum / Außen
- 📊 Rolle für Auswertung
- 📈 Optionaler Tages- oder Zählerwert

Alles ist **erweiterbar**, eigene Datenpunkte können jederzeit ergänzt werden.

---

### 📊 Live- & Historien-Auswertung

- Live-Daten über `getForeignStateAsync`
- Historische Daten:
  - InfluxDB
  - SQL / MySQL
- Automatische Prüfung:
  - Ist ein History-Adapter installiert?
  - Sind für den Datenpunkt Daten vorhanden?
- Berechnung u. a.:
  - Durchschnitt
  - Min / Max
  - Tag / Nacht-Baseline
  - Trends
  - Abweichungen

---

### 🧠 Intelligenz-Ebene

- Zusammenfassung des aktuellen Zustands
- Erkennung von Auffälligkeiten
- Ableitung von **Handlungsempfehlungen**
- Optional:
  - GPT / OpenAI zur Text- und Kontextverbesserung
  - rein beratend, keine Pflicht

---

### 📬 Telegram (optional)

- Versand von:
  - Analyse-Berichten
  - Tageszusammenfassungen
  - Handlungsvorschlägen
- Inline-Buttons:
  - ✅ Freigeben
  - ❌ Ablehnen
  - ✏️ Ändern
- Adapter funktioniert **vollständig ohne Telegram**

---

### ⏱ Zeitgesteuerte Berichte (optional)

- Tägliche Reports
- Uhrzeit frei konfigurierbar
- Zeitzonen-Unterstützung
- Nur Auswertung, keine Schaltaktionen

---

## 🧱 Architektur & Code-Struktur

Der Adapter ist **konsequent modular aufgebaut**:

├── main.js
├── io-package.json
├── package.json
├── admin/
│   ├── index.html
│   ├── assets/
│   └── src/
└── lib/
├── state.js        # Alle States & State-Handling
├── config.js       # Konfigurations-Normalisierung & Validierung
├── discovery.js    # Automatische Datenpunkt-Erkennung
├── liveContext.js  # Live-Daten-Erfassung
├── history.js      # InfluxDB / SQL Zugriff
├── stats.js        # Statistiken & Kennzahlen
├── rules.js        # Abweichungen & Regeln
├── actions.js     # Aktions-Lifecycle
├── report.js       # Berichte (Text / Markdown)
├── telegram.js    # Telegram-Anbindung
├── gpt.js          # OpenAI / GPT (optional)
└── scheduler.js    # Zeitsteuerung

🧩 Wichtige States

Steuerung & Status
	•	ai-autopilot.0.control.run
	•	ai-autopilot.0.info.connection
	•	ai-autopilot.0.info.lastError

Reports
	•	ai-autopilot.0.report.last
	•	ai-autopilot.0.report.stats
	•	ai-autopilot.0.report.actions
	•	ai-autopilot.0.report.actionHistory

Meta
	•	ai-autopilot.0.meta.running
	•	ai-autopilot.0.meta.lastRun
	•	ai-autopilot.0.meta.lastDailyReportTs

Lernen / Historie
	•	ai-autopilot.0.memory.feedback
	•	ai-autopilot.0.memory.learning
	•	ai-autopilot.0.memory.history
	•	ai-autopilot.0.memory.policy

## 🔧 Admin Build

```
npm i
npm run build-admin
iobroker upload ai-autopilot
```

📜 Lizenz

MIT License

Ideen, Feedback und Pull Requests sind willkommen.
Bitte:
	•	modular bleiben
	•	sauber kommentieren
	•	ioBroker-Standards einhalten
