const fs = require('fs');

const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

async function run() {
  try {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const authRes = await fetch("https://oauth.battle.net/token", {
      method: "POST",
      headers: { "Authorization": `Basic ${authHeader}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials"
    });
    const authJson = await authRes.json();
    const token = authJson.access_token;

    // Vi tjekker det primære progressive navnerum
    const namespace = "dynamic-classic-eu";
    const listUrl = `https://eu.api.blizzard.com/data/wow/connected-realm/index?namespace=${namespace}&locale=en_GB`;
    const listRes = await fetch(listUrl, { headers: { "Authorization": `Bearer ${token}` } });
    const listJson = await listRes.json();

    const validIds = listJson.connected_realms.map(cr => {
      const matches = cr.href.match(/connected-realm\/(\d+)/);
      return matches ? parseInt(matches[1]) : null;
    }).filter(id => id !== null);

    let targetRealmId = null;

    // Systematisk lokalisering af Spineshatter uden gætteri
    for (const id of validIds) {
      try {
        const realmRes = await fetch(`https://eu.api.blizzard.com/data/wow/connected-realm/${id}?namespace=${namespace}&locale=en_GB`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (realmRes.status === 200) {
          const realmJson = await realmRes.json();
          const isSpineshatter = realmJson.realms.some(r => r.name.toLowerCase() === "spineshatter");
          if (isSpineshatter) {
            targetRealmId = id;
            break;
          }
        }
      } catch (e) {
        // Fortsæt ved netværksfejl
      }
    }

    if (!targetRealmId) {
      throw new Error("Kunne ikke lokalisere Spineshatter på EU Classic API'et.");
    }

    // Hent data fra det korrekte auktionshus
    const url = `https://eu.api.blizzard.com/data/wow/connected-realm/${targetRealmId}/auctions?namespace=${namespace}&locale=en_GB`;
    const aucRes = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    const aucJson = await aucRes.json();

    // Hele kataloget (inkluderer test på Ghost Mushroom og dine TBC consumables)
    const itemsToTrack = {
      8845: "Ghost Mushroom",
      22445: "Arcane Dust",
      22450: "Arcane Tome",
      22789: "Terocone",
      22829: "Super Healing Potion",
      22832: "Super Mana Potion",
      22839: "Destruction Potion",
      22838: "Haste Potion"
    };

    const dato = new Date().toISOString().split('T')[0];
    const ugedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
    const ugedag = ugedage[new Date().getDay()];

    let nyeLinjer = "";

    for (const [id, name] of Object.entries(itemsToTrack)) {
      const activeAuctions = aucJson.auctions.filter(a => a && a.item && a.item.id == id);
      
      if (activeAuctions.length > 0) {
        let totalCopper = 0;
        let count = 0;
        activeAuctions.forEach(auc => {
          if (auc.buyout) {
            const quantity = auc.quantity || 1;
            totalCopper += (auc.buyout / quantity);
            count++;
          }
        });
        const guldPris = count > 0 ? (totalCopper / count / 10000).toFixed(2) : 0;
        const udbud = activeAuctions.reduce((sum, a) => sum + (a.quantity || 1), 0);
        nyeLinjer += `${dato};${ugedag};${name};${guldPris};${udbud}\n`;
      } else {
        nyeLinjer += `${dato};${ugedag};${name};0.00;0\n`;
      }
    }

    const filnavn = "markedsdata.csv";
    fs.writeFileSync(filnavn, "Dato;Ugedag;Item;Gennemsnitspris (Guld);Udbud (Supply)\n");
    fs.appendFileSync(filnavn, nyeLinjer);
    console.log(`Færdig! Data hentet direkte fra Spineshatter (ID: ${targetRealmId}) og skrevet til CSV.`);

  } catch (error) {
    console.error("Fejl under kørsel:", error.message);
    process.exit(1);
  }
}

run();
