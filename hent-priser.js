const fs = require('fs');

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

    console.log("Henter auktionsdata for Spineshatter EU Anniversary (Realm ID: 503)...");
    
    // Vi bruger det korrekte Retail/Anniversary endpoint og navnerum
    const url = "https://eu.api.blizzard.com/data/wow/connected-realm/503/auctions?namespace=dynamic-eu&locale=en_GB";
    
    const aucRes = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const aucJson = await aucRes.json();

    if (!aucJson || !aucJson.auctions) {
      throw new Error("Modtog uventet dataformat eller tomme data fra Blizzard API.");
    }

    console.log(`Modtog ${aucJson.auctions.length} aktive auktioner.`);

    // Dine TBC varer samt test-svampen
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
          // Retail/Anniversary API-strukturen kan bruge auc.buyout eller auc.unit_price
          const price = auc.buyout || auc.unit_price || (auc.bid && auc.bid * 1.05);
          if (price) {
            const quantity = auc.quantity || 1;
            // Hvis det er unit_price skal der ikke divideres med antal, da det er stykpris
            totalCopper += auc.unit_price ? price : (price / quantity);
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
    if (!fs.existsSync(filnavn)) {
      fs.writeFileSync(filnavn, "Dato;Ugedag;Item;Gennemsnitspris (Guld);Udbud (Supply)\n");
    }
    fs.appendFileSync(filnavn, nyeLinjer);
    console.log("Markedsdata.csv er opdateret med priser fra Spineshatter Anniversary!");

  } catch (error) {
    console.error("Fejl under kørsel:", error.message);
    process.exit(1);
  }
}

run();
