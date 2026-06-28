const fs = require('fs');

const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

async function run() {
  try {
    console.log("Henter Access Token...");
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const authRes = await fetch("https://oauth.battle.net/token", {
      method: "POST",
      headers: { "Authorization": `Basic ${authHeader}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials"
    });
    const authJson = await authRes.json();
    const token = authJson.access_token;

    // Test-kandidater for Classic Connected Realms i EU
    const candidateRealms = [500, 501, 502, 503, 504, 505, 11, 44];
    let chosenRealmId = null;
    let fallbackAucJson = null;

    console.log("Scanner realms for at finde aktive data...");

    for (const realmId of candidateRealms) {
      try {
        const url = `https://eu.api.blizzard.com/data/wow/connected-realm/${realmId}/auctions?namespace=dynamic-classic-eu&locale=en_GB`;
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        
        if (res.status === 200) {
          const json = await res.json();
          if (json && json.auctions && json.auctions.length > 0) {
            // Tjek om Ghost Mushroom (8845) findes på dette realm
            const hasGhostMushroom = json.auctions.some(a => a && a.item && a.item.id == 8845);
            console.log(`Realm ID: ${realmId} er aktivt (${json.auctions.length} auktioner). Ghost Mushroom fundet: ${hasGhostMushroom}`);
            
            if (hasGhostMushroom && !chosenRealmId) {
              chosenRealmId = realmId;
              fallbackAucJson = json;
            }
          }
        }
      } catch (e) {
        // Gå videre ved fejl
      }
    }

    if (!chosenRealmId) {
      throw new Error("Kunne ikke finde et aktivt realm med Ghost Mushroom data.");
    }

    console.log(`Bruger endeligt Realm ID: ${chosenRealmId}`);
    const aucJson = fallbackAucJson;

    // Test-katalog med Ghost Mushroom
    const itemsToTrack = {
      8845: "Ghost Mushroom"
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

    if (nyeLinjer) {
      const filnavn = "markedsdata.csv";
      fs.writeFileSync(filnavn, "Dato;Ugedag;Item;Gennemsnitspris (Guld);Udbud (Supply)\n");
      fs.appendFileSync(filnavn, nyeLinjer);
      console.log(`Test udført! Data skrevet til markedsdata.csv baseret på Realm ID ${chosenRealmId}`);
    }

  } catch (error) {
    console.error("Fejl under kørsel:", error.message);
    process.exit(1);
  }
}

run();
