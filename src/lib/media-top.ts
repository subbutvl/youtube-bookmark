/**
 * Starter lists: 100 top-rated movies and 100 top-rated TV shows, taken from IMDb's Top 250 charts
 * (IMDb's chart pages can't be read by apps, so the lists are kept here). Only the name and year are
 * stored; everything else is looked up after the import.
 */
export const TOP_MOVIES: [string, number][] = [
  ['The Shawshank Redemption', 1994], ['The Godfather', 1972], ['The Dark Knight', 2008], ['The Godfather Part II', 1974],
  ['12 Angry Men', 1957], ['The Lord of the Rings: The Return of the King', 2003], ["Schindler's List", 1993], ['Pulp Fiction', 1994],
  ['The Lord of the Rings: The Fellowship of the Ring', 2001], ['The Good, the Bad and the Ugly', 1966], ['Forrest Gump', 1994],
  ['The Lord of the Rings: The Two Towers', 2002], ['Fight Club', 1999], ['Inception', 2010], ['The Empire Strikes Back', 1980],
  ['The Matrix', 1999], ['Goodfellas', 1990], ['Interstellar', 2014], ["One Flew Over the Cuckoo's Nest", 1975], ['Se7en', 1995],
  ["It's a Wonderful Life", 1946], ['The Silence of the Lambs', 1991], ['Seven Samurai', 1954], ['Saving Private Ryan', 1998],
  ['City of God', 2002], ['The Green Mile', 1999], ['Life Is Beautiful', 1997], ['Terminator 2: Judgment Day', 1991],
  ['Star Wars', 1977], ['Back to the Future', 1985], ['Spirited Away', 2001], ['The Pianist', 2002], ['Parasite', 2019],
  ['Psycho', 1960], ['Gladiator', 2000], ['The Lion King', 1994], ['Spider-Man: Across the Spider-Verse', 2023], ['The Departed', 2006],
  ['Whiplash', 2014], ['Léon: The Professional', 1994], ['The Prestige', 2006], ['Harakiri', 1962], ['American History X', 1998],
  ['Grave of the Fireflies', 1988], ['The Usual Suspects', 1995], ['Casablanca', 1942], ['Cinema Paradiso', 1988],
  ['The Intouchables', 2011], ['Modern Times', 1936], ['Alien', 1979], ['Rear Window', 1954], ['Once Upon a Time in the West', 1968],
  ['Django Unchained', 2012], ['City Lights', 1931], ['Apocalypse Now', 1979], ['Memento', 2000], ['WALL·E', 2008],
  ['Raiders of the Lost Ark', 1981], ['Avengers: Infinity War', 2018], ['The Lives of Others', 2006], ['Sunset Boulevard', 1950],
  ['Spider-Man: Into the Spider-Verse', 2018], ['Paths of Glory', 1957], ['The Shining', 1980], ['Witness for the Prosecution', 1957],
  ['Avengers: Endgame', 2019], ['The Great Dictator', 1940], ['Aliens', 1986], ['Inglourious Basterds', 2009], ['Dune: Part Two', 2024],
  ['The Dark Knight Rises', 2012], ['Oldboy', 2003], ['Coco', 2017], ['Amadeus', 1984], ['Toy Story', 1995], ['Dr. Strangelove', 1964],
  ['Braveheart', 1995], ['Good Will Hunting', 1997], ['Joker', 2019], ['American Beauty', 1999], ['Das Boot', 1981],
  ['High and Low', 1963], ['Princess Mononoke', 1997], ['3 Idiots', 2009], ['Your Name.', 2016], ['Once Upon a Time in America', 1984],
  ['Toy Story 3', 2010], ['Capernaum', 2018], ['Requiem for a Dream', 2000], ["Singin' in the Rain", 1952], ['Come and See', 1985],
  ['Return of the Jedi', 1983], ['Eternal Sunshine of the Spotless Mind', 2004], ['2001: A Space Odyssey', 1968], ['Reservoir Dogs', 1992],
  ['Ikiru', 1952], ['The Hunt', 2012], ['Lawrence of Arabia', 1962], ['Citizen Kane', 1941], ['M', 1931],
];

export const TOP_TV: [string, number][] = [
  ['Planet Earth II', 2016], ['Breaking Bad', 2008], ['Planet Earth', 2006], ['Band of Brothers', 2001], ['Chernobyl', 2019],
  ['The Wire', 2002], ['Avatar: The Last Airbender', 2005], ['Blue Planet II', 2017], ['The Sopranos', 1999],
  ['Cosmos: A Spacetime Odyssey', 2014], ['Cosmos', 1980], ['Our Planet', 2019], ['Game of Thrones', 2011], ['Bluey', 2018],
  ['The World at War', 1973], ['Fullmetal Alchemist: Brotherhood', 2009], ['Rick and Morty', 2013], ['Life', 2009], ['The Last Dance', 2020],
  ['Attack on Titan', 2013], ['The Twilight Zone', 1959], ['Sherlock', 2010], ['Arcane', 2021], ['The Vietnam War', 2017],
  ['Better Call Saul', 2015], ['Scam 1992: The Harshad Mehta Story', 2020], ['The Office', 2005], ['Frozen Planet', 2011],
  ['Human Planet', 2011], ['Hunter x Hunter', 2011], ['Death Note', 2006], ['The Blue Planet', 2001], ['Firefly', 2002], ['Seinfeld', 1989],
  ['True Detective', 2014], ["Clarkson's Farm", 2021], ['Cowboy Bebop', 1998], ['Gravity Falls', 2012], ['Only Fools and Horses', 1981],
  ['Fargo', 2014], ['Batman: The Animated Series', 1992], ['Friends', 1994], ['Succession', 2018], ['Dekalog', 1989], ['Twin Peaks', 1990],
  ['Shōgun', 2024], ["Frieren: Beyond Journey's End", 2023], ['Monster', 2004], ['The Bear', 2022], ['Planet Earth III', 2023], ['Dark', 2017],
  ['Pride and Prejudice', 1995], ['Last Week Tonight with John Oliver', 2014], ['Severance', 2022], ['Vinland Saga', 2019],
  ['Steins;Gate', 2011], ['Fawlty Towers', 1975], ['Freaks and Geeks', 1999], ['Blackadder Goes Forth', 1989], ['Kota Factory', 2019],
  ['Panchayat', 2020], ['Gullak', 2019], ['Aspirants', 2021], ['TVF Pitchers', 2015], ['The Family Man', 2019], ['Peaky Blinders', 2013],
  ['Mr. Robot', 2015], ['Stranger Things', 2016], ['The Boys', 2019], ['Narcos', 2015], ['Mad Men', 2007], ['House', 2004],
  ['Six Feet Under', 2001], ['Curb Your Enthusiasm', 2000], ['One Piece', 1999], ['Rome', 2005], ["It's Always Sunny in Philadelphia", 2005],
  ['The Simpsons', 1989], ['Arrested Development', 2003], ['Generation Kill', 2008], ['The Marvelous Mrs. Maisel', 2017], ['Black Mirror', 2011],
  ['BoJack Horseman', 2014], ['Downton Abbey', 2010], ["Chappelle's Show", 2003], ['The Last of Us', 2023], ['The Mandalorian', 2019],
  ['Atlanta', 2016], ['Ted Lasso', 2020], ['Jujutsu Kaisen', 2020], ['Neon Genesis Evangelion', 1995], ['Invincible', 2021],
  ['Normal People', 2020], ['When They See Us', 2019], ['Over the Garden Wall', 2014], ['Mindhunter', 2017], ['Westworld', 2016],
  ['Hannibal', 2013], ['The West Wing', 1999], ['Sacred Games', 2018],
];
