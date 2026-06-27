const fs = require('fs');

// Hent API-nøgler fra GitHubs sikre miljøvariabler
const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

async function run() {
  try {
    console.log("Henter Access Token fra Blizzard...");
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const authRes = await fetch("https://oauth.battle.net/token", {
      method: "POST",
      headers: { "Authorization": `Basic ${authHeader}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials"
    });
    const authJson = await authRes.json();
    const token = authJson.access_token;

    console.log("Henter auktionsdata for Spineshatter EU (1301)...");
    const aucRes = await fetch("https://eu.api.blizzard.com/data/wow/connected-realm/1301/auctions?namespace=dynamic-classic-eu&locale=en_GB", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const aucJson = await aucRes.json();

    // De specifikke Item ID'er fra din markedsanalyse
    const itemsToTrack = {
      22789: "Terocone",
      22450: "Arcane Tome",
      22445: "Arcane Dust"
    };

    const dato = new Date().toISOString().split('T')[0];
    const ugedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
    const ugedag = ugedage[new Date().getDay()];

    let nyeLinjer = "";

    for (const [id, name] of Object.entries(itemsToTrack)) {
      const activeAuctions = aucJson.auctions.filter(a => a.item.id == id);
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

        // Format til dit regneark: Dato;Ugedag;Item;Gennemsnitspris;Udbud[cite: 1, 2]
        nyeLinjer += `${dato};${ugedag};${name};${guldPris};${udbud}\n`;
      }
    }

    if (nyeLinjer) {
      // Gemmer data i en lokal CSV-fil i dit repo
      const filnavn = "markedsdata.csv";
      if (!fs.existsSync(filnavn)) {
        fs.writeFileSync(filnavn, "Dato;Ugedag;Item;Gennemsnitspris (Guld);Udbud (Supply)\n");[cite: 1, 2]
      }
      fs.appendFileSync(filnavn, nyeLinjer);
      console.log("Data gemt succesfuldt i markedsdata.csv");
    }

  } catch (error) {
    console.error("Fejl:", error);
    process.exit(1);
  }
}

run();
