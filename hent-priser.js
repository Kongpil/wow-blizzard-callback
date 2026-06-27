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

    console.log("Henter auktionsdata for Spineshatter EU (1301)...");
    // Vi bruger det korrekte dynamiske navnerum til Classic/Anniversary
    const url = "https://eu.api.blizzard.com/data/wow/connected-realm/1301/auctions?namespace=dynamic-classic-eu&locale=en_GB";
    
    const aucRes = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const aucJson = await aucRes.json();

    // SIKKERHEDSTJEK: Hvis Blizzard returnerer en fejl eller en anden struktur
    if (!aucJson || !aucJson.auctions) {
      console.error("Modtog uventet dataformat fra Blizzard API.");
      console.log("Svar fra Blizzard:", JSON.stringify(aucJson).substring(0, 500));
      throw new Error("Feltet 'auctions' mangler i API-svaret. Tjek navnerum eller Realm ID.");
    }

    console.log(`Modtog ${aucJson.auctions.length} aktive auktioner. Matcher mod TBC katalog...`);

    // Det fulde TBC Consumables katalog
    const itemsToTrack = {
      22829: "Super Healing Potion",
      22832: "Super Mana Potion",
      22839: "Destruction Potion",
      22838: "Haste Potion",
      22828: "Insane Strength Potion",
      22849: "Ironshield Potion",
      22847: "Major Dreamless Sleep Potion",
      22850: "Heroic Potion",
      22853: "Flask of Pure Death",
      22861: "Flask of Blinding Light",
      22866: "Flask of Mighty Restoration",
      22854: "Flask of Relentless Assault",
      22840: "Major Rejuvenation Potion",
      22831: "Elixir of Major Agility",
      22833: "Elixir of Major Mageblood",
      22848: "Elixir of Major Defense",
      22825: "Elixir of Healing Power",
      22827: "Elixir of Mastery",
      22834: "Elixir of Major Shadow Power",
      22835: "Elixir of Major Firepower",
      27657: "Blackened Basilisk",
      27664: "Grilled Mudfish",
      27655: "Spicy Hot Talbuk",
      33872: "Spicy Fried Herring",
      27659: "Poached Bluefish",
      27667: "Golden Fish Sticks",
      22450: "Arcane Tome",
      22445: "Arcane Dust",
      22789: "Terocone",
      22451: "Primal Fire",
      21884: "Primal Mana",
      22452: "Primal Earth",
      22456: "Primal Shadow",
      22457: "Primal Water",
      22573: "Primal Might"
    };

    const dato = new Date().toISOString().split('T')[0];
    const ugedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
    const ugedag = ugedage[new Date().getDay()];

    let nyeLinjer = "";

    for (const [id, name] of Object.entries(itemsToTrack)) {
      // Robust tjek på om item og id eksisterer på den enkelte auktion
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
      if (!fs.existsSync(filnavn)) {
        fs.writeFileSync(filnavn, "Dato;Ugedag;Item;Gennemsnitspris (Guld);Udbud (Supply)\n");
      }
      fs.appendFileSync(filnavn, nyeLinjer);
      console.log("Alle TBC Consumables er opdateret i markedsdata.csv");
    }

  } catch (error) {
    console.error("Fejl under kørsel:", error.message);
    process.exit(1);
  }
}

run();
