/**
 * Starter list: 500 of the most acclaimed and most played games on PC, Xbox, PlayStation 4/5, VR and mobile,
 * roughly in order of acclaim. Nintendo-only games are left out (no platform for them here).
 *
 * One game per line: name | year | platforms | genres | origin | type | hours | Wikipedia article (when not the name)
 * - platforms: pc xb (Xbox One / Series) ps (PS4 / PS5) vr mob (iOS / Android)
 * - genres and type: the codes in game-types.ts
 * - origin: the lead developer's country (ISO code)
 * - hours: about how long the main story takes; 0 = no ending (online or endless games)
 *
 * Links (official site, IGN, Wikipedia, trailer) and covers are looked up after the list is added.
 */
export const TOP_GAMES_TEXT = `
The Witcher 3: Wild Hunt|2015|pc xb ps|rpg ow act|PL|sp|52
Red Dead Redemption 2|2018|pc xb ps|act adv ow|US|sp mp|50
Elden Ring|2022|pc xb ps|rpg act ow|JP|sp mp co|58
Grand Theft Auto V|2013|pc xb ps|act ow|GB|sp mp|32
Baldur's Gate 3|2023|pc xb ps|rpg str|BE|sp mp co|75
The Last of Us Part I|2022|pc ps|act adv hor|US|sp|15
God of War|2018|pc ps|act adv|US|sp|21|God of War (2018 video game)
Half-Life 2|2004|pc|fps|US|sp|13
Minecraft|2011|pc xb ps mob|san sur|SE|sp mp co|0
Portal 2|2011|pc|puz|US|sp co|8.5
The Last of Us Part II|2020|pc ps|act adv hor|US|sp|24
Mass Effect Legendary Edition|2021|pc xb ps|rpg fps|CA|sp|90
Hades|2020|pc xb ps mob|rog act|US|sp|22|Hades (video game)
Hollow Knight|2017|pc xb ps|mv pla act|AU|sp|27
Cyberpunk 2077|2020|pc xb ps|rpg fps ow|PL|sp|25
Sekiro: Shadows Die Twice|2019|pc xb ps|act adv|JP|sp|30
Stardew Valley|2016|pc xb ps mob|sim rpg|US|sp co|53
Disco Elysium|2019|pc xb ps|rpg|EE|sp|22
Bloodborne|2015|ps|rpg act hor|JP|sp co|35
Dark Souls III|2016|pc xb ps|rpg act|JP|sp mp co|32
Persona 5 Royal|2019|pc xb ps|rpg|JP|sp|100
God of War Ragnarök|2022|pc ps|act adv|US|sp|26
Terraria|2011|pc xb ps mob|san act sur|US|sp mp co|52
Red Dead Redemption|2010|pc xb ps|act adv ow|US|sp mp|23
Outer Wilds|2019|pc xb ps|adv puz|US|sp|17
Resident Evil 4|2023|pc xb ps|hor act|JP|sp|16|Resident Evil 4 (2023 video game)
The Elder Scrolls V: Skyrim|2011|pc xb ps vr|rpg ow|US|sp|34
Ghost of Tsushima|2020|pc ps|act adv ow ste|US|sp co|25
Celeste|2018|pc xb ps|pla|CA|sp|8|Celeste (video game)
Undertale|2015|pc xb ps|rpg|US|sp|7
Dark Souls Remastered|2018|pc xb ps|rpg act|JP|sp mp co|42|Dark Souls (video game)
Metal Gear Solid V: The Phantom Pain|2015|pc xb ps|ste act ow|JP|sp mp|46
Final Fantasy VII Rebirth|2024|pc ps|rpg act ow|JP|sp|45
Final Fantasy VII Remake|2020|pc ps|rpg act|JP|sp|34
Clair Obscur: Expedition 33|2025|pc xb ps|rpg|FR|sp|30
Astro Bot|2024|ps|pla|JP|sp|11|Astro Bot (video game)
Resident Evil 2|2019|pc xb ps|hor act|JP|sp|9|Resident Evil 2 (2019 video game)
Divinity: Original Sin 2|2017|pc xb ps|rpg str|BE|sp co|60
Inside|2016|pc xb ps mob|puz pla|DK|sp|3.5|Inside (video game)
Return of the Obra Dinn|2018|pc xb ps|puz adv|US|sp|9
Slay the Spire|2019|pc xb ps mob|car rog str|US|sp|25
Fortnite|2017|pc xb ps mob|br fps san|US|mp co f2p|0
Hollow Knight: Silksong|2025|pc xb ps|mv pla act|AU|sp|30
Marvel's Spider-Man|2018|pc ps|act adv ow|US|sp|17|Spider-Man (2018 video game)
Horizon Zero Dawn|2017|pc ps|act rpg ow|NL|sp|22
Uncharted 4: A Thief's End|2016|pc ps|act adv|US|sp mp|15
Monster Hunter: World|2018|pc xb ps|act rpg|JP|sp co|47
Death Stranding|2019|pc xb ps|act adv ow|JP|sp|40
Balatro|2024|pc xb ps mob|car rog|GB|sp|12
Half-Life: Alyx|2020|vr|fps adv|US|sp|12
Dead Cells|2018|pc xb ps mob|rog act mv|FR|sp|25
Cuphead|2017|pc xb ps|pla act|CA|sp co|11
Nier: Automata|2017|pc xb ps|act rpg|JP|sp|21
Devil May Cry 5|2019|pc xb ps|act|JP|sp|11
Yakuza 0|2015|pc xb ps|act adv|JP|sp|31
Black Myth: Wukong|2024|pc xb ps|act rpg|CN|sp|38
Kingdom Come: Deliverance II|2025|pc xb ps|rpg ow|CZ|sp|50
Ori and the Will of the Wisps|2020|pc xb|pla mv|AT|sp|10
It Takes Two|2021|pc xb ps|pla adv|SE|co|14|It Takes Two (video game)
Forza Horizon 5|2021|pc xb ps|rac ow|GB|sp mp co|0
Halo: The Master Chief Collection|2014|pc xb|fps|US|sp mp co|50
Doom Eternal|2020|pc xb ps|fps|US|sp mp|14
Fallout: New Vegas|2010|pc xb|rpg fps ow|US|sp|27
Titanfall 2|2016|pc xb ps|fps|US|sp mp|6
Final Fantasy XIV|2013|pc xb ps|mmo rpg|JP|mp co|0
Journey|2012|pc ps mob|adv|US|sp mp|2|Journey (2012 video game)
Portal|2007|pc|puz|US|sp|3|Portal (video game)
Ghost of Yōtei|2025|ps|act adv ow|US|sp|30
Marvel's Spider-Man 2|2023|pc ps|act ow|US|sp|18|Spider-Man 2 (2023 video game)
Horizon Forbidden West|2022|pc ps|act rpg ow|NL|sp|30
Alan Wake 2|2023|pc xb ps|hor act|FI|sp|18
Control|2019|pc xb ps|act adv|FI|sp|12|Control (video game)
Batman: Arkham City|2011|pc xb ps|act adv|GB|sp|13
Batman: Arkham Knight|2015|pc xb ps|act adv ow|GB|sp|17
BioShock|2007|pc xb ps|fps|US|sp|12|BioShock (video game)
BioShock Infinite|2013|pc xb ps|fps|US|sp|12
Fallout 4|2015|pc xb ps vr|rpg fps ow|US|sp|27
Monster Hunter Wilds|2025|pc xb ps|act rpg|JP|sp co|20
Lies of P|2023|pc xb ps|act rpg|KR|sp|30
Street Fighter 6|2023|pc xb ps|fig|JP|sp mp|0
Tekken 8|2024|pc xb ps|fig|JP|sp mp|0
Resident Evil Village|2021|pc xb ps vr|hor act|JP|sp|10
Resident Evil 7: Biohazard|2017|pc xb ps vr|hor|JP|sp|9
Hitman: World of Assassination|2023|pc xb ps vr|ste act|DK|sp|30
Dishonored 2|2016|pc xb ps|ste act|FR|sp|15
Dishonored|2012|pc xb ps|ste act|FR|sp|12
Prey|2017|pc xb ps|fps act|US|sp|17|Prey (2017 video game)
Psychonauts 2|2021|pc xb ps|pla adv|US|sp|15
Sea of Stars|2023|pc xb ps|rpg|CA|sp|30
Metaphor: ReFantazio|2024|pc xb ps|rpg|JP|sp|65
Persona 3 Reload|2024|pc xb ps|rpg|JP|sp|60
Persona 4 Golden|2012|pc xb ps|rpg|JP|sp|60
Yakuza: Like a Dragon|2020|pc xb ps|rpg|JP|sp|47
Like a Dragon: Infinite Wealth|2024|pc xb ps|rpg|JP|sp|50
Dragon Quest XI S: Echoes of an Elusive Age|2017|pc xb ps|rpg|JP|sp|60|Dragon Quest XI
Final Fantasy XVI|2023|pc ps|rpg act|JP|sp|35
Final Fantasy VII|1997|pc xb ps mob|rpg|JP|sp|37
Kingdom Hearts III|2019|pc xb ps|rpg act|JP|sp|28
Octopath Traveler II|2023|pc xb ps|rpg|JP|sp|65
Tales of Arise|2021|pc xb ps|rpg act|JP|sp|43
Monster Hunter Rise|2021|pc xb ps|act rpg|JP|sp co|20
Dragon's Dogma 2|2024|pc xb ps|rpg act ow|JP|sp|33
Armored Core VI: Fires of Rubicon|2023|pc xb ps|act|JP|sp mp|17
Nioh 2|2020|pc ps|act rpg|JP|sp co|45
Ōkami HD|2006|pc xb ps|act adv|JP|sp|33|Ōkami
Death Stranding 2: On the Beach|2025|ps|act adv|JP|sp|45
Metal Gear Solid Delta: Snake Eater|2025|pc xb ps|ste act|JP|sp|15
Demon's Souls|2020|ps|rpg act|US|sp mp co|25|Demon's Souls (2020 video game)
Returnal|2021|pc ps|rog fps|FI|sp co|20
Ratchet & Clank: Rift Apart|2021|pc ps|act pla|US|sp|11
Marvel's Spider-Man: Miles Morales|2020|pc ps|act ow|US|sp|8|Spider-Man: Miles Morales
Uncharted: The Lost Legacy|2017|pc ps|act adv|US|sp|8
Days Gone|2019|pc ps|act sur ow|US|sp|36
Until Dawn|2015|pc ps|hor adv|GB|sp|9
Detroit: Become Human|2018|pc ps|adv|FR|sp|12
Heavy Rain|2010|pc ps|adv|FR|sp|10
Gran Turismo 7|2022|ps vr|rac sim|JP|sp mp|0
Helldivers 2|2024|pc xb ps|fps|SE|co|0
Stellar Blade|2024|pc ps|act|KR|sp|23
Rise of the Ronin|2024|pc ps|act rpg ow|JP|sp|40
Starfield|2023|pc xb|rpg ow|US|sp|35
Halo Infinite|2021|pc xb|fps|US|sp mp co f2p|11
Gears 5|2019|pc xb|fps act|CA|sp mp co|11
Forza Horizon 4|2018|pc xb|rac ow|GB|sp mp|0
Forza Motorsport|2023|pc xb|rac sim|US|sp mp|0|Forza Motorsport (2023 video game)
Microsoft Flight Simulator|2020|pc xb vr|sim|FR|sp mp|0|Microsoft Flight Simulator (2020 video game)
Microsoft Flight Simulator 2024|2024|pc xb vr|sim|FR|sp mp|0
Sea of Thieves|2018|pc xb ps|act adv|GB|mp co|0
Hi-Fi Rush|2023|pc xb ps|act rhy|JP|sp|10
Ori and the Blind Forest|2015|pc xb|pla mv|AT|sp|8
State of Decay 2|2018|pc xb|sur act|US|sp co|25
Grounded|2022|pc xb ps|sur|US|sp co|40|Grounded (video game)
Senua's Saga: Hellblade II|2024|pc xb ps|act adv|GB|sp|6
Hellblade: Senua's Sacrifice|2017|pc xb ps vr|act adv|GB|sp|8
Avowed|2025|pc xb ps|rpg act|US|sp|25
Pentiment|2022|pc xb ps|adv|US|sp|17|Pentiment (video game)
South of Midnight|2025|pc xb|act adv|CA|sp|12
Indiana Jones and the Great Circle|2024|pc xb ps|act adv|SE|sp|16
Doom|2016|pc xb ps|fps|US|sp mp|11|Doom (2016 video game)
Doom: The Dark Ages|2025|pc xb ps|fps|US|sp|13
Wolfenstein II: The New Colossus|2017|pc xb ps|fps|SE|sp|11
Wolfenstein: The New Order|2014|pc xb ps|fps|SE|sp|12
The Elder Scrolls IV: Oblivion Remastered|2025|pc xb ps|rpg ow|US|sp|30
Fallout 3|2008|pc xb|rpg fps ow|US|sp|23
The Elder Scrolls Online|2014|pc xb ps|mmo rpg|US|mp co|0
Fallout 76|2018|pc xb ps|rpg fps ow sur|US|mp co|0
The Outer Worlds|2019|pc xb ps|rpg fps|US|sp|14
Grand Theft Auto: San Andreas|2004|pc xb ps mob|act ow|GB|sp|31
Grand Theft Auto IV|2008|pc xb|act ow|GB|sp mp|28
L.A. Noire|2011|pc xb ps|act adv|AU|sp|21
Mafia: Definitive Edition|2020|pc xb ps|act adv|US|sp|12
Sleeping Dogs|2012|pc xb ps|act ow|CA|sp|17|Sleeping Dogs (video game)
Middle-earth: Shadow of Mordor|2014|pc xb ps|act ow|US|sp|16
Middle-earth: Shadow of War|2017|pc xb ps|act ow|US|sp|30
Batman: Arkham Asylum|2009|pc xb ps|act adv|GB|sp|12
Marvel's Guardians of the Galaxy|2021|pc xb ps|act adv|CA|sp|19|Guardians of the Galaxy (video game)
Hogwarts Legacy|2023|pc xb ps|act rpg ow|US|sp|26
Star Wars Jedi: Survivor|2023|pc xb ps|act adv|US|sp|25
Star Wars Jedi: Fallen Order|2019|pc xb ps|act adv|US|sp|17
Star Wars Outlaws|2024|pc xb ps|act adv ow|SE|sp|20
Star Wars Battlefront II|2017|pc xb ps|fps|SE|sp mp|6|Star Wars Battlefront II (2017 video game)
Star Wars: Knights of the Old Republic|2003|pc mob|rpg|CA|sp|30
Star Wars: Squadrons|2020|pc xb ps vr|sim act|CA|sp mp|8
Lego Star Wars: The Skywalker Saga|2022|pc xb ps|act adv|GB|sp co|18
Dragon Age: Inquisition|2014|pc xb ps|rpg|CA|sp|47
Dragon Age: Origins|2009|pc|rpg|CA|sp|42
Pillars of Eternity|2015|pc xb ps|rpg|US|sp|38
Pathfinder: Wrath of the Righteous|2021|pc xb ps|rpg|CY|sp|80
Warhammer 40,000: Rogue Trader|2023|pc xb ps|rpg str|CY|sp|70
Wasteland 3|2020|pc xb ps|rpg str|US|sp co|45
Kingdom Come: Deliverance|2018|pc xb ps|rpg ow|CZ|sp|42
Deus Ex: Mankind Divided|2016|pc xb ps|rpg fps ste|CA|sp|22
Deus Ex|2000|pc|rpg fps|US|sp|22|Deus Ex (video game)
System Shock|2023|pc xb ps|fps act|US|sp|17|System Shock (2023 video game)
Metro Exodus|2019|pc xb ps|fps sur|UA|sp|16
S.T.A.L.K.E.R. 2: Heart of Chornobyl|2024|pc xb|fps sur ow|UA|sp|40
Atomic Heart|2023|pc xb ps|fps act|CY|sp|19
Dying Light|2015|pc xb ps|act sur hor ow|PL|sp co|17
Dying Light 2 Stay Human|2022|pc xb ps|act sur ow|PL|sp co|24
Frostpunk|2018|pc xb ps|str sur|PL|sp|13
Frostpunk 2|2024|pc xb ps|str sur|PL|sp|15
Ghostrunner|2020|pc xb ps|act pla|PL|sp|7
Superhot|2016|pc xb ps|fps puz|PL|sp|2|Superhot
Manor Lords|2024|pc xb|str sim|PL|sp|0
Silent Hill 2|2024|pc ps|hor|PL|sp|15|Silent Hill 2 (2024 video game)
Silent Hill f|2025|pc xb ps|hor|TW|sp|12
Dead Space|2023|pc xb ps|hor fps|CA|sp|12|Dead Space (2023 video game)
Alien: Isolation|2014|pc xb ps mob|hor ste|GB|sp|18
Amnesia: The Dark Descent|2010|pc xb ps|hor|SE|sp|7
Soma|2015|pc xb ps|hor adv|SE|sp|10|Soma (video game)
Outlast|2013|pc xb ps|hor|CA|sp|5|Outlast (video game)
The Evil Within 2|2017|pc xb ps|hor act|JP|sp|16
Little Nightmares|2017|pc xb ps mob|hor pla|SE|sp|4
Five Nights at Freddy's|2014|pc xb ps mob|hor|US|sp|4|Five Nights at Freddy's (video game)
Resident Evil 3|2020|pc xb ps|hor act|JP|sp|6|Resident Evil 3 (2020 video game)
Dead by Daylight|2016|pc xb ps mob|hor|CA|mp|0
Phasmophobia|2020|pc xb ps vr|hor|GB|co|0
Lethal Company|2023|pc|hor|US|co|0
R.E.P.O.|2025|pc|hor par|SE|co|0
Peak|2025|pc|adv par|SE|co|0|Peak (video game)
Left 4 Dead 2|2009|pc xb|fps hor|US|co mp|7
Team Fortress 2|2007|pc|fps|US|mp f2p|0
Counter-Strike 2|2023|pc|fps|US|mp f2p|0
Dota 2|2013|pc|moba str|US|mp f2p|0
League of Legends|2009|pc|moba str|US|mp f2p|0
Valorant|2020|pc xb ps|fps|US|mp f2p|0
Overwatch 2|2022|pc xb ps|fps|US|mp f2p|0
Apex Legends|2019|pc xb ps|br fps|US|mp f2p|0
PUBG: Battlegrounds|2017|pc xb ps|br fps|KR|mp f2p|0
Call of Duty: Warzone|2020|pc xb ps|br fps|US|mp f2p|0
Tom Clancy's Rainbow Six Siege|2015|pc xb ps|fps ste|CA|mp f2p|0
Destiny 2|2017|pc xb ps|fps mmo|US|mp co f2p|0
Warframe|2013|pc xb ps mob|act fps|CA|mp co f2p|0
Marvel Rivals|2024|pc xb ps|fps|CN|mp f2p|0
The Finals|2023|pc xb ps|fps|SE|mp f2p|0
Rocket League|2015|pc xb ps|spo rac|US|mp f2p|0
Fall Guys|2020|pc xb ps|par br|GB|mp f2p|0
Among Us|2018|pc xb ps mob|par|US|mp|0
Genshin Impact|2020|pc xb ps mob|rpg act ow|CN|sp f2p|0
Honkai: Star Rail|2023|pc ps mob|rpg str|CN|sp f2p|0
Zenless Zone Zero|2024|pc xb ps mob|act|CN|sp f2p|0
Wuthering Waves|2024|pc ps mob|act rpg ow|CN|sp f2p|0
Path of Exile|2013|pc xb ps|rpg act|NZ|sp co f2p|0
Path of Exile 2|2024|pc xb ps|rpg act|NZ|sp co|0
Diablo IV|2023|pc xb ps|rpg act|US|sp co|25
Diablo III|2012|pc xb ps|rpg act|US|sp co|20
Diablo II: Resurrected|2021|pc xb ps|rpg act|US|sp co|25
World of Warcraft|2004|pc|mmo rpg|US|mp co|0
Guild Wars 2|2012|pc|mmo rpg|US|mp co|0
Lost Ark|2019|pc|mmo rpg act|KR|mp co f2p|0
Black Desert|2015|pc xb ps|mmo rpg|KR|mp|0|Black Desert Online
EVE Online|2003|pc|mmo sim|IS|mp|0
Old School RuneScape|2013|pc mob|mmo rpg|GB|mp f2p|0
Call of Duty: Black Ops 6|2024|pc xb ps|fps|US|sp mp co|8
Call of Duty: Modern Warfare II|2022|pc xb ps|fps|US|sp mp co|6|Call of Duty: Modern Warfare II (2022 video game)
Call of Duty 4: Modern Warfare|2007|pc xb ps|fps|US|sp mp|6
Battlefield 6|2025|pc xb ps|fps|SE|sp mp|6
Battlefield 1|2016|pc xb ps|fps|SE|sp mp|6
Battlefield 4|2013|pc xb ps|fps|SE|sp mp|6
Borderlands 3|2019|pc xb ps|fps rpg|US|sp co|30
Borderlands 2|2012|pc xb ps|fps rpg|US|sp co|30
Far Cry 3|2012|pc xb ps|fps ow|CA|sp|19
Far Cry 5|2018|pc xb ps|fps ow|CA|sp co|19
Far Cry 6|2021|pc xb ps|fps ow|CA|sp co|23
Assassin's Creed Shadows|2025|pc xb ps|act rpg ow|CA|sp|35
Assassin's Creed Valhalla|2020|pc xb ps|act rpg ow|CA|sp|60
Assassin's Creed Odyssey|2018|pc xb ps|act rpg ow|CA|sp|45
Assassin's Creed Origins|2017|pc xb ps|act rpg ow|CA|sp|30
Assassin's Creed IV: Black Flag|2013|pc xb ps|act ow|CA|sp|23
Assassin's Creed II|2009|pc xb ps|act ow|CA|sp|20
Assassin's Creed Mirage|2023|pc xb ps mob|act ste|FR|sp|15
Watch Dogs 2|2016|pc xb ps|act ow|CA|sp mp|18
Tom Clancy's The Division 2|2019|pc xb ps|fps rpg|SE|sp co|25
Tom Clancy's Ghost Recon Wildlands|2017|pc xb ps|fps ow|FR|sp co|38
Prince of Persia: The Lost Crown|2024|pc xb ps mob|mv pla act|FR|sp|20
Rayman Legends|2013|pc xb ps|pla|FR|sp co|10
Tomb Raider|2013|pc xb ps|act adv|US|sp|12|Tomb Raider (2013 video game)
Rise of the Tomb Raider|2015|pc xb ps|act adv|US|sp|16
Shadow of the Tomb Raider|2018|pc xb ps|act adv|CA|sp|16
A Plague Tale: Requiem|2022|pc xb ps|adv ste|FR|sp|16
A Plague Tale: Innocence|2019|pc xb ps|adv ste|FR|sp|11
Stray|2022|pc xb ps|adv|FR|sp|5|Stray (video game)
Sifu|2022|pc xb ps|act fig|FR|sp|10
Life Is Strange|2015|pc xb ps mob|adv|FR|sp|14|Life Is Strange (video game)
The Walking Dead|2012|pc xb ps mob|adv|US|sp|13|The Walking Dead (video game)
The Wolf Among Us|2013|pc xb ps mob|adv|US|sp|9
Firewatch|2016|pc xb ps|adv|US|sp|4
What Remains of Edith Finch|2017|pc xb ps|adv|US|sp|2
Oxenfree|2016|pc xb ps mob|adv|US|sp|4
Gris|2018|pc ps mob|pla adv|ES|sp|4
Brothers: A Tale of Two Sons|2013|pc xb ps mob|adv puz|SE|sp|3
Limbo|2010|pc xb ps mob|puz pla|DK|sp|3.5|Limbo (video game)
The Witness|2016|pc xb ps mob|puz|US|sp|20|The Witness (2016 video game)
The Talos Principle 2|2023|pc xb ps|puz|HR|sp|25
Baba Is You|2019|pc mob|puz|FI|sp|20
The Stanley Parable: Ultra Deluxe|2022|pc xb ps|adv|US|sp|5
Papers, Please|2013|pc mob|sim puz|US|sp|5
Untitled Goose Game|2019|pc xb ps|puz|AU|sp co|3
Unpacking|2021|pc xb ps mob|puz|AU|sp|4|Unpacking (video game)
A Short Hike|2019|pc xb ps|adv|CA|sp|2
Spiritfarer|2020|pc xb ps mob|sim adv|CA|sp|30
Night in the Woods|2017|pc xb ps mob|adv|US|sp|9
Dredge|2023|pc xb ps mob|adv sim|NZ|sp|10|Dredge (video game)
Tunic|2022|pc xb ps|act adv|CA|sp|12|Tunic (video game)
Death's Door|2021|pc xb ps|act adv|GB|sp|9
Hyper Light Drifter|2016|pc xb ps|act adv|US|sp|8
Inscryption|2021|pc xb ps|car puz hor|CA|sp|11
Cult of the Lamb|2022|pc xb ps|rog sim|AU|sp co|21
Hades II|2025|pc|rog act|US|sp|30
Risk of Rain 2|2020|pc xb ps|rog fps|US|sp co|9
Enter the Gungeon|2016|pc xb ps|rog act|US|sp co|15
The Binding of Isaac: Rebirth|2014|pc xb ps mob|rog act|US|sp co|20
Spelunky 2|2020|pc xb ps|rog pla|US|sp co|0
Noita|2020|pc|rog act|FI|sp|0|Noita (video game)
Darkest Dungeon|2016|pc xb ps mob|rog rpg str|CA|sp|50
Into the Breach|2018|pc xb ps mob|str rog|CN|sp|8
FTL: Faster Than Light|2012|pc mob|str rog|CN|sp|13
Vampire Survivors|2022|pc xb ps mob|rog act|GB|sp co|15
Brotato|2023|pc xb ps mob|rog act|FR|sp|0
Shovel Knight|2014|pc xb ps|pla|US|sp|7
Blasphemous|2019|pc xb ps mob|mv act|ES|sp|14|Blasphemous (video game)
Animal Well|2024|pc xb ps|mv puz|US|sp|9
Pizza Tower|2023|pc|pla|US|sp|7
Hotline Miami|2012|pc xb ps|act|SE|sp|5
Fez|2012|pc xb ps mob|pla puz|CA|sp|6|Fez (video game)
Braid|2008|pc xb ps|pla puz|US|sp|5|Braid (video game)
Bastion|2011|pc xb ps mob|act rpg|US|sp|7|Bastion (video game)
Transistor|2014|pc xb ps mob|act rpg|US|sp|6|Transistor (video game)
Crash Bandicoot N. Sane Trilogy|2017|pc xb ps|pla|US|sp|17
Spyro Reignited Trilogy|2018|pc xb ps|pla|US|sp|25
Sonic Frontiers|2022|pc xb ps|pla ow|JP|sp|19
Tetris Effect: Connected|2018|pc xb ps vr|puz rhy|JP|sp mp|5|Tetris Effect
Thumper|2016|pc xb ps vr|rhy|US|sp|8|Thumper (video game)
Dragon Ball Z: Kakarot|2020|pc xb ps|act rpg|JP|sp|38
Dragon Ball FighterZ|2018|pc xb ps|fig|JP|sp mp|0
Guilty Gear Strive|2021|pc xb ps|fig|JP|sp mp|0
Mortal Kombat 1|2023|pc xb ps|fig|US|sp mp|0|Mortal Kombat 1 (2023 video game)
Brawlhalla|2017|pc xb ps mob|fig|US|mp f2p|0
For Honor|2017|pc xb ps|act fig|CA|sp mp|10
Mount & Blade II: Bannerlord|2022|pc xb ps|rpg str act|TR|sp mp|0
Ace Combat 7: Skies Unknown|2019|pc xb ps vr|sim act|JP|sp mp|11
Final Fantasy XV|2016|pc xb ps|rpg ow|JP|sp|29
Final Fantasy XII: The Zodiac Age|2017|pc xb ps|rpg|JP|sp|53
Chrono Trigger|1995|pc mob|rpg|JP|sp|23
Shin Megami Tensei V: Vengeance|2024|pc xb ps|rpg|JP|sp|70
Phoenix Wright: Ace Attorney Trilogy|2019|pc xb ps mob|adv puz|JP|sp|65
Ghost Trick: Phantom Detective|2023|pc xb ps mob|adv puz|JP|sp|13
Her Story|2015|pc mob|adv puz|GB|sp|2|Her Story (video game)
The Case of the Golden Idol|2022|pc xb ps mob|puz adv|LV|sp|10
Civilization VI|2016|pc xb ps mob|str|US|sp mp|0|Civilization VI
Civilization VII|2025|pc xb ps|str|US|sp mp|0|Civilization VII
XCOM 2|2016|pc xb ps|str|US|sp|35
Total War: Warhammer III|2022|pc|str|GB|sp mp|0
Crusader Kings III|2020|pc xb ps|str sim|SE|sp mp|0
Stellaris|2016|pc xb ps|str|SE|sp mp|0|Stellaris (video game)
Europa Universalis IV|2013|pc|str|SE|sp mp|0
Hearts of Iron IV|2016|pc|str|SE|sp mp|0
Age of Empires II: Definitive Edition|2019|pc xb ps|str|US|sp mp|0
Age of Empires IV|2021|pc xb ps|str|CA|sp mp|15
Age of Mythology: Retold|2024|pc xb ps|str|US|sp mp|20
StarCraft II: Wings of Liberty|2010|pc|str|US|sp mp f2p|15
Cities: Skylines|2015|pc xb ps|sim str|FI|sp|0
Factorio|2020|pc|sim str san|CZ|sp co|40
RimWorld|2018|pc xb ps|sim str sur|CA|sp|0
Oxygen Not Included|2019|pc|sim sur|CA|sp|0
Dwarf Fortress|2022|pc|sim str|US|sp|0
Anno 1800|2019|pc xb ps|str sim|DE|sp mp|0
Satisfactory|2024|pc xb ps|sim san|SE|sp co|0|Satisfactory (video game)
Kerbal Space Program|2015|pc xb ps|sim|MX|sp|0
Jurassic World Evolution 2|2021|pc xb ps|sim|GB|sp|15
Planet Coaster|2016|pc xb ps|sim|GB|sp|0
Two Point Hospital|2018|pc xb ps|sim|GB|sp|20
The Sims 4|2014|pc xb ps|sim|US|sp f2p|0
PowerWash Simulator|2022|pc xb ps vr|sim|GB|sp co|20
Euro Truck Simulator 2|2012|pc vr|sim rac|CZ|sp mp|0
Farming Simulator 25|2024|pc xb ps|sim|CH|sp mp|0
BeamNG.drive|2015|pc|sim rac san|DE|sp mp|0
Valheim|2021|pc xb|sur san act|SE|sp co|0
Subnautica|2018|pc xb ps vr|sur adv|US|sp|31
The Forest|2018|pc ps vr|sur hor|CA|sp co|15|The Forest (video game)
Sons of the Forest|2024|pc|sur hor|CA|sp co|20
Don't Starve Together|2016|pc xb ps|sur|CA|co mp|0
The Long Dark|2017|pc xb ps|sur|CA|sp|30
Project Zomboid|2013|pc|sur hor|GB|sp mp|0
Green Hell|2019|pc xb ps vr|sur|PL|sp co|20
Enshrouded|2024|pc xb ps|sur rpg san|DE|sp co|0
V Rising|2024|pc ps|sur act|NO|sp mp co|0
Palworld|2024|pc xb ps|sur san|JP|sp co|35
Rust|2018|pc xb ps|sur|GB|mp|0|Rust (video game)
ARK: Survival Evolved|2017|pc xb ps mob|sur|US|sp mp|0
DayZ|2018|pc xb ps|sur|CZ|mp|0|DayZ (video game)
No Man's Sky|2016|pc xb ps vr|sur san ow|GB|sp co|33
Elite Dangerous|2014|pc xb ps vr|sim|GB|sp mp|0
Deep Rock Galactic|2020|pc xb ps|fps|DK|co|0
Remnant II|2023|pc xb ps|act fps rpg|US|sp co|18
Warhammer 40,000: Space Marine 2|2024|pc xb ps|act fps|US|sp co|10
Elden Ring Nightreign|2025|pc xb ps|act rog|JP|co|15
Hunt: Showdown 1896|2019|pc xb ps|fps hor|DE|mp|0|Hunt: Showdown
Escape from Tarkov|2017|pc|fps sur|RU|mp|0
Ready or Not|2023|pc xb ps|fps|IE|sp co|10|Ready or Not (video game)
World of Tanks|2010|pc xb ps|act sim|CY|mp f2p|0
War Thunder|2013|pc xb ps vr|sim act|HU|mp f2p|0
Garry's Mod|2006|pc|san|GB|mp|0
Roblox|2006|pc xb ps mob vr|san par|US|mp f2p|0
Minecraft Dungeons|2020|pc xb ps|act rpg|SE|sp co|8
Overcooked! 2|2018|pc xb ps|par sim|GB|co mp|10
Split Fiction|2025|pc xb ps|act adv|SE|co|13
A Way Out|2018|pc xb ps|act adv|SE|co|6|A Way Out (video game)
EA Sports FC 25|2024|pc xb ps|spo|CA|sp mp|0
eFootball|2021|pc xb ps mob|spo|JP|sp mp f2p|0
NBA 2K25|2024|pc xb ps|spo|US|sp mp|0
Madden NFL 25|2024|pc xb ps|spo|US|sp mp|0
Cricket 24|2023|pc xb ps|spo|AU|sp mp|0
Football Manager 2024|2023|pc xb ps mob|spo sim|GB|sp|0
Tony Hawk's Pro Skater 1 + 2|2020|pc xb ps|spo|US|sp mp|6
F1 24|2024|pc xb ps|rac|GB|sp mp|0
Assetto Corsa Competizione|2019|pc xb ps vr|rac sim|IT|sp mp|0
iRacing|2008|pc vr|rac sim|US|mp|0
Dirt Rally 2.0|2019|pc xb ps vr|rac sim|GB|sp mp|0
Need for Speed Heat|2019|pc xb ps|rac ow|SE|sp mp|20
Burnout Paradise Remastered|2018|pc xb ps|rac ow|GB|sp mp|10|Burnout Paradise
Trackmania|2020|pc xb ps|rac|FR|sp mp f2p|0|Trackmania (2020 video game)
Hearthstone|2014|pc mob|car str|US|mp f2p|0
Marvel Snap|2022|pc mob|car|US|mp f2p|0
Magic: The Gathering Arena|2019|pc mob|car|US|mp f2p|0
Teamfight Tactics|2019|pc mob|str|US|mp f2p|0
Beat Saber|2019|vr|rhy|CZ|sp mp|0
Superhot VR|2016|vr|fps puz|PL|sp|2
Boneworks|2019|vr|act san|US|sp|6
Bonelab|2022|vr|act san|US|sp|5
The Walking Dead: Saints & Sinners|2020|vr|hor act sur|US|sp|15
Pistol Whip|2019|vr|rhy fps|US|sp|0
Moss|2018|vr|pla puz|US|sp|3|Moss (video game)
Moss: Book II|2022|vr|pla puz|US|sp|5
Astro Bot Rescue Mission|2018|vr|pla|JP|sp|7
Horizon Call of the Mountain|2023|vr|act adv|GB|sp|7
Asgard's Wrath 2|2023|vr|rpg act|US|sp|50
Asgard's Wrath|2019|vr|rpg act|US|sp|30
Lone Echo|2017|vr|adv|US|sp|6
Batman: Arkham Shadow|2024|vr|act|US|sp|12
Assassin's Creed Nexus VR|2023|vr|act ste|CA|sp|15
Marvel's Iron Man VR|2020|vr|act|US|sp|8
Vader Immortal: A Star Wars VR Series|2019|vr|act adv|US|sp|2
Metro Awakening|2024|vr|fps hor|NL|sp|8
Arizona Sunshine|2016|vr|fps hor|NL|sp co|5
Arizona Sunshine 2|2023|vr|fps hor|NL|sp co|8
Blade & Sorcery|2018|vr|act san|FR|sp|0
Into the Radius|2020|vr|sur fps|CY|sp|25
Red Matter|2018|vr|adv puz|ES|sp|4
Red Matter 2|2022|vr|adv puz|ES|sp|6
Population: One|2020|vr|br fps|US|mp f2p|0
Gorilla Tag|2021|vr|par|US|mp f2p|0
Rec Room|2016|pc xb ps mob vr|par san|US|mp f2p|0
VRChat|2017|pc vr|san par|US|mp f2p|0
Onward|2016|vr|fps|US|mp co|0|Onward (video game)
Job Simulator|2016|vr|sim|US|sp|3
Vacation Simulator|2019|vr|sim|US|sp|6
I Expect You to Die|2016|vr|puz|US|sp|4
The Room VR: A Dark Matter|2020|vr|puz|GB|sp|5
Synth Riders|2019|vr|rhy|CL|sp mp|0
Walkabout Mini Golf|2020|vr|spo|US|sp mp|0
Demeo|2021|pc ps vr|str rpg|SE|co|0
Clash of Clans|2012|mob|str|FI|mp f2p|0
Clash Royale|2016|mob|str car|FI|mp f2p|0
Brawl Stars|2018|mob|act|FI|mp f2p|0
Hay Day|2012|mob|sim|FI|sp f2p|0
Pokémon Go|2016|mob|adv|US|mp f2p|0
Pokémon Unite|2021|mob|moba|CN|mp f2p|0
Pokémon TCG Pocket|2024|mob|car|JP|sp mp f2p|0
Monster Hunter Now|2023|mob|act|US|mp f2p|0
Candy Crush Saga|2012|pc mob|puz|SE|sp f2p|0
Royal Match|2021|mob|puz|TR|sp f2p|0
Subway Surfers|2012|mob|act|DK|sp f2p|0
Temple Run 2|2013|mob|act|US|sp f2p|0
Angry Birds 2|2015|mob|puz|FI|sp f2p|0
Fruit Ninja|2010|mob vr|act|AU|sp|0
Plants vs. Zombies|2009|pc mob|str|US|sp|7
Plants vs. Zombies 2|2013|mob|str|US|sp f2p|0
Monument Valley|2014|pc mob|puz|GB|sp|2
Monument Valley 2|2017|pc mob|puz|GB|sp|2
Alto's Adventure|2015|pc mob|spo|CA|sp|0
Alto's Odyssey|2018|pc mob|spo|CA|sp|0
The Room|2012|pc mob|puz|GB|sp|3|The Room (video game)
Florence|2018|pc mob|adv|AU|sp|1|Florence (video game)
Call of Duty: Mobile|2019|mob|fps br|CN|mp f2p|0
PUBG Mobile|2018|mob|br fps|CN|mp f2p|0
Free Fire|2017|mob|br fps|SG|mp f2p|0|Free Fire (video game)
Battlegrounds Mobile India|2021|mob|br fps|KR|mp f2p|0
Mobile Legends: Bang Bang|2016|mob|moba|CN|mp f2p|0
Honor of Kings|2015|mob|moba|CN|mp f2p|0
League of Legends: Wild Rift|2020|mob|moba|US|mp f2p|0
Arknights|2019|mob|str|CN|sp f2p|0
Fate/Grand Order|2015|mob|rpg|JP|sp f2p|0
Blue Archive|2021|pc mob|rpg str|KR|sp f2p|0
Puzzle & Dragons|2012|mob|puz rpg|JP|sp f2p|0
Summoners War|2014|mob|rpg|KR|sp mp f2p|0|Summoners War: Sky Arena
Raid: Shadow Legends|2019|pc mob|rpg|IL|sp f2p|0
Diablo Immortal|2022|pc mob|rpg act|US|sp co f2p|0
Rise of Kingdoms|2018|pc mob|str|CN|mp f2p|0
Cookie Run: Kingdom|2021|mob|rpg sim|KR|sp f2p|0
Sky: Children of the Light|2019|pc ps mob|adv|US|mp co f2p|0
Geometry Dash|2013|pc mob|pla rhy|SE|sp|0
Asphalt Legends|2018|pc xb ps mob|rac|ES|sp mp f2p|0
Real Racing 3|2013|mob|rac sim|AU|sp mp f2p|0
Hill Climb Racing|2012|mob|rac|FI|sp f2p|0
8 Ball Pool|2010|mob|spo|IL|mp f2p|0
Ludo King|2016|pc mob|par|IN|mp f2p|0
Stumble Guys|2021|pc mob|par br|UY|mp f2p|0
Bloons TD 6|2018|pc xb ps mob|str|NZ|sp co|0
Kingdom Rush|2011|pc mob|str|UY|sp|8
Kingdom Two Crowns|2018|pc xb ps mob|str|NL|sp co|12
Crossy Road|2014|pc mob|act|AU|sp f2p|0
Jetpack Joyride|2011|pc mob|act|AU|sp f2p|0
Soul Knight|2017|mob|rog act|CN|sp co|0
Archero|2019|mob|rog act|CN|sp f2p|0
Mini Metro|2015|pc mob|puz str|NZ|sp|0
The Battle of Polytopia|2016|pc mob|str|SE|sp mp|0
Reigns|2016|pc mob|car adv|GB|sp|3|Reigns (video game)
80 Days|2014|pc mob|adv|GB|sp|3|80 Days (2014 video game)
RollerCoaster Tycoon Classic|2016|pc mob|sim|GB|sp|0
`;
