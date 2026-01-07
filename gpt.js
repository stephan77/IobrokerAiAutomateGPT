"use strict";

const OpenAI = require("openai");

module.exports = (adapter) => {

  /* =====================================================
     Hilfsfunktion: bekannte Energy-Daten aus stats
  ===================================================== */
  function getKnownEnergyKeys(stats) {
    const known = new Set();

    if (stats.energy?.houseConsumption != null) known.add("energy.houseConsumption");
    if (stats.energy?.pvPower != null)          known.add("energy.pvPower");
    if (stats.energy?.gridPower != null)        known.add("energy.gridPower");
    if (stats.energy?.batterySoc != null)       known.add("energy.batterySoc");
    if (stats.energy?.batteryPower != null)     known.add("energy.batteryPower");
    if (stats.energy?.wallboxPower != null)     known.add("energy.wallboxPower");

    return known;
  }

  /* =====================================================
     Hauptfunktion
  ===================================================== */
  async function enrichActions(config, actions, stats) {
    const apiKey = config.gpt?.openaiApiKey || config.openaiApiKey;
    const model  = config.gpt?.model || "gpt-4o-mini";

    if (!apiKey) {
      adapter.log.info("[GPT] deaktiviert (kein API-Key)");
      return actions;
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      adapter.log.debug("[GPT] keine Aktionen → übersprungen");
      return actions;
    }

    adapter.log.info(`[GPT] OpenAI aktiv (${model}), ${actions.length} Aktionen`);

    const openai = new OpenAI({ apiKey });
    const knownEnergyKeys = getKnownEnergyKeys(stats);

    for (const action of actions) {
      try {
        const prompt = buildPrompt(action, stats);

        const response = await openai.chat.completions.create({
          model,
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content:
                "Du bist ein Energie- und Smart-Home-Experte. " +
                "Antworte sachlich, technisch korrekt und ohne Floskeln.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const text = response?.choices?.[0]?.message?.content?.trim();
        if (!text) {
          adapter.log.warn(`[GPT] Leere Antwort für Action ${action.id}`);
          continue;
        }

        /* =========================
           missingData extrahieren
        ========================= */
        let missingData = [];
        const match = text.match(/MISSING_DATA_JSON:\s*(\[[^\]]*\])/s);

        if (match) {
          try {
            missingData = JSON.parse(match[1]);
          } catch (e) {
            adapter.log.warn("[GPT] missingData JSON konnte nicht geparst werden");
          }
        }

        /* =========================
           🔥 Feinschliff:
           bereits bekannte Daten entfernen
        ========================= */
        if (Array.isArray(missingData)) {
          missingData = missingData.filter(
            key => !knownEnergyKeys.has(key)
          );
        }

        /* =========================
           Ergebnis speichern
        ========================= */

        // Sichtbar im Report (ohne JSON-Zeile)
        action.description =
          "🤖 KI-Analyse:\n" +
          text.replace(/MISSING_DATA_JSON:\s*\[[^\]]*\]/s, "").trim();

        // Strukturiert für Logik / UI / Lernen
        action.gpt = {
          model,
          prompt,
          response: text,
          missingData,
          tokens: response.usage || null,
          timestamp: new Date().toISOString(),
        };

      } catch (err) {
        adapter.log.warn(
          `[GPT] Fehler bei Action ${action.id}: ${err.message}`
        );
      }
    }

    return actions;
  }

  /* =====================================================
     Prompt
  ===================================================== */
  function buildPrompt(action, stats) {
    return `
Es liegt folgende Situation in einem Smart-Home-Energiesystem vor.

WICHTIG:
- Batterie-Ladestand ist immer in Prozent (%)
- Leistungen sind immer in Watt (W)
- Verwechsele keine Prozentwerte mit Leistungswerten

Kategorie: ${action.category}
Priorität: ${action.priority}

Batterie-Zustand:
- Aktueller Batterie-Ladestand: ${stats.energy?.batterySoc ?? "n/a"} %
- Kritische Untergrenze Batterie-Ladestand: 20 %

Aktuelle bekannte Systemwerte:
- Hausverbrauch: ${stats.energy?.houseConsumption ?? "n/a"} W
- PV-Leistung: ${stats.energy?.pvPower ?? "n/a"} W
- Wallbox-Leistung: ${stats.energy?.wallboxPower ?? "n/a"} W
- Batterie-Leistung: ${stats.energy?.batteryPower ?? "n/a"} W
- Batterie-Zustand: ${stats.energy?.batteryState ?? "active"}

Aufgabe:
1. Analysiere die Situation technisch.
2. Erkläre die wahrscheinliche Ursache.
3. Gib eine konkrete, umsetzbare Empfehlung.
4. Liste zusätzlich alle Datenpunkte auf, die für eine genauere Analyse fehlen oder hilfreich wären.

Vorgaben:
- Antworte sachlich und technisch.
- Maximal 6–8 Sätze.
- Der letzte Abschnitt MUSS mit „Zusätzliche benötigte Daten:“ beginnen.
- Füge am Ende zusätzlich eine maschinenlesbare Zeile hinzu:

MISSING_DATA_JSON: ["energy.pvPower","energy.gridPower","energy.batteryPower"]
`;
  }

  return { enrichActions };
};