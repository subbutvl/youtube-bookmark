/**
 * Starter lists for the Books section: 881 of the best-known and most-read books in English (novels, plays,
 * poetry and non-fiction, including great works read in English translation), then 119 Tamil classics and modern
 * Tamil novels. 1000 in all, roughly in order of how well known they are.
 *
 * English, one per line: title | author | year | Wikipedia article (when not the title)
 * Tamil, one per line: title in English letters | author | year | English Wikipedia article | title in Tamil
 * (the Tamil title is also used to find the Tamil Wikipedia article when there's no English one).
 *
 * Synopsis, cover, Goodreads page and the films and shows made from each book are looked up after the list is added.
 */
export const TOP_BOOKS_TEXT = `
Nineteen Eighty-Four|George Orwell|1949
To Kill a Mockingbird|Harper Lee|1960
Pride and Prejudice|Jane Austen|1813
The Great Gatsby|F. Scott Fitzgerald|1925
The Lord of the Rings|J. R. R. Tolkien|1954
The Hobbit|J. R. R. Tolkien|1937
Harry Potter and the Philosopher's Stone|J. K. Rowling|1997
Animal Farm|George Orwell|1945
The Catcher in the Rye|J. D. Salinger|1951
Jane Eyre|Charlotte Brontë|1847
Wuthering Heights|Emily Brontë|1847
Moby-Dick|Herman Melville|1851
Frankenstein|Mary Shelley|1818
Brave New World|Aldous Huxley|1932
Lord of the Flies|William Golding|1954
Great Expectations|Charles Dickens|1861
A Tale of Two Cities|Charles Dickens|1859
Alice's Adventures in Wonderland|Lewis Carroll|1865
Dracula|Bram Stoker|1897
The Picture of Dorian Gray|Oscar Wilde|1890
Of Mice and Men|John Steinbeck|1937
The Grapes of Wrath|John Steinbeck|1939
Fahrenheit 451|Ray Bradbury|1953
Ulysses|James Joyce|1922|Ulysses (novel)
The Adventures of Huckleberry Finn|Mark Twain|1884|Adventures of Huckleberry Finn
The Adventures of Tom Sawyer|Mark Twain|1876
Little Women|Louisa May Alcott|1868
Gulliver's Travels|Jonathan Swift|1726
Robinson Crusoe|Daniel Defoe|1719
Treasure Island|Robert Louis Stevenson|1883
Strange Case of Dr Jekyll and Mr Hyde|Robert Louis Stevenson|1886
The Chronicles of Narnia|C. S. Lewis|1950
The Lion, the Witch and the Wardrobe|C. S. Lewis|1950
Dune|Frank Herbert|1965|Dune (novel)
The Hitchhiker's Guide to the Galaxy|Douglas Adams|1979|The Hitchhiker's Guide to the Galaxy (novel)
Catch-22|Joseph Heller|1961
Slaughterhouse-Five|Kurt Vonnegut|1969
Beloved|Toni Morrison|1987|Beloved (novel)
The Color Purple|Alice Walker|1982
Invisible Man|Ralph Ellison|1952
Their Eyes Were Watching God|Zora Neale Hurston|1937
The Sun Also Rises|Ernest Hemingway|1926
The Old Man and the Sea|Ernest Hemingway|1952
A Farewell to Arms|Ernest Hemingway|1929
For Whom the Bell Tolls|Ernest Hemingway|1940
Mrs Dalloway|Virginia Woolf|1925
To the Lighthouse|Virginia Woolf|1927
Orlando: A Biography|Virginia Woolf|1928
Heart of Darkness|Joseph Conrad|1899
Lord Jim|Joseph Conrad|1900
Middlemarch|George Eliot|1871
Emma|Jane Austen|1815|Emma (novel)
Sense and Sensibility|Jane Austen|1811
Persuasion|Jane Austen|1817|Persuasion (novel)
Northanger Abbey|Jane Austen|1817
Mansfield Park|Jane Austen|1814
Oliver Twist|Charles Dickens|1838
David Copperfield|Charles Dickens|1850
Bleak House|Charles Dickens|1853
A Christmas Carol|Charles Dickens|1843
Hard Times|Charles Dickens|1854|Hard Times (novel)
The Pickwick Papers|Charles Dickens|1836
Tess of the d'Urbervilles|Thomas Hardy|1891
Far from the Madding Crowd|Thomas Hardy|1874
Jude the Obscure|Thomas Hardy|1895
The Mayor of Casterbridge|Thomas Hardy|1886
Vanity Fair|William Makepeace Thackeray|1848|Vanity Fair (novel)
The Scarlet Letter|Nathaniel Hawthorne|1850
Uncle Tom's Cabin|Harriet Beecher Stowe|1852
The Call of the Wild|Jack London|1903
White Fang|Jack London|1906
The Time Machine|H. G. Wells|1895
The War of the Worlds|H. G. Wells|1898
The Invisible Man|H. G. Wells|1897
The Island of Doctor Moreau|H. G. Wells|1896
Twenty Thousand Leagues Under the Seas|Jules Verne|1870
Around the World in Eighty Days|Jules Verne|1872
Journey to the Center of the Earth|Jules Verne|1864
The Count of Monte Cristo|Alexandre Dumas|1844
The Three Musketeers|Alexandre Dumas|1844
Les Misérables|Victor Hugo|1862
The Hunchback of Notre-Dame|Victor Hugo|1831
Don Quixote|Miguel de Cervantes|1605
War and Peace|Leo Tolstoy|1869
Anna Karenina|Leo Tolstoy|1878
The Death of Ivan Ilyich|Leo Tolstoy|1886
Crime and Punishment|Fyodor Dostoevsky|1866
The Brothers Karamazov|Fyodor Dostoevsky|1880
The Idiot|Fyodor Dostoevsky|1869
Notes from Underground|Fyodor Dostoevsky|1864
Demons|Fyodor Dostoevsky|1872|Demons (Dostoevsky novel)
The Master and Margarita|Mikhail Bulgakov|1967
Doctor Zhivago|Boris Pasternak|1957|Doctor Zhivago (novel)
Lolita|Vladimir Nabokov|1955
Pale Fire|Vladimir Nabokov|1962
One Day in the Life of Ivan Denisovich|Aleksandr Solzhenitsyn|1962
The Gulag Archipelago|Aleksandr Solzhenitsyn|1973
Dead Souls|Nikolai Gogol|1842
Fathers and Sons|Ivan Turgenev|1862|Fathers and Sons (novel)
Eugene Onegin|Alexander Pushkin|1833
Madame Bovary|Gustave Flaubert|1856
The Stranger|Albert Camus|1942|The Stranger (Camus novel)
The Plague|Albert Camus|1947|The Plague (novel)
The Myth of Sisyphus|Albert Camus|1942
The Little Prince|Antoine de Saint-Exupéry|1943
In Search of Lost Time|Marcel Proust|1913
Candide|Voltaire|1759
The Metamorphosis|Franz Kafka|1915
The Trial|Franz Kafka|1925
The Castle|Franz Kafka|1926|The Castle (novel)
The Magic Mountain|Thomas Mann|1924
Death in Venice|Thomas Mann|1912
Siddhartha|Hermann Hesse|1922|Siddhartha (novel)
Steppenwolf|Hermann Hesse|1927|Steppenwolf (novel)
The Glass Bead Game|Hermann Hesse|1943
All Quiet on the Western Front|Erich Maria Remarque|1929
The Tin Drum|Günter Grass|1959
Perfume: The Story of a Murderer|Patrick Süskind|1985|Perfume (novel)
The Name of the Rose|Umberto Eco|1980
Foucault's Pendulum|Umberto Eco|1988
If on a winter's night a traveler|Italo Calvino|1979
Invisible Cities|Italo Calvino|1972
The Leopard|Giuseppe Tomasi di Lampedusa|1958
My Brilliant Friend|Elena Ferrante|2011
One Hundred Years of Solitude|Gabriel García Márquez|1967
Love in the Time of Cholera|Gabriel García Márquez|1985
Chronicle of a Death Foretold|Gabriel García Márquez|1981
The House of the Spirits|Isabel Allende|1982
Pedro Páramo|Juan Rulfo|1955
Ficciones|Jorge Luis Borges|1944
The Alchemist|Paulo Coelho|1988|The Alchemist (novel)
Blindness|José Saramago|1995|Blindness (novel)
The Shadow of the Wind|Carlos Ruiz Zafón|2001
Things Fall Apart|Chinua Achebe|1958
Half of a Yellow Sun|Chimamanda Ngozi Adichie|2006
Americanah|Chimamanda Ngozi Adichie|2013
Purple Hibiscus|Chimamanda Ngozi Adichie|2003
Season of Migration to the North|Tayeb Salih|1966
Midnight's Children|Salman Rushdie|1981
The Satanic Verses|Salman Rushdie|1988
The God of Small Things|Arundhati Roy|1997
A Suitable Boy|Vikram Seth|1993
The White Tiger|Aravind Adiga|2008
The Inheritance of Loss|Kiran Desai|2006
Interpreter of Maladies|Jhumpa Lahiri|1999
The Namesake|Jhumpa Lahiri|2003|The Namesake (novel)
A Fine Balance|Rohinton Mistry|1995
Train to Pakistan|Khushwant Singh|1956
Malgudi Days|R. K. Narayan|1943
The Guide|R. K. Narayan|1958|The Guide (novel)
Swami and Friends|R. K. Narayan|1935
Gitanjali|Rabindranath Tagore|1910
The Home and the World|Rabindranath Tagore|1916
Untouchable|Mulk Raj Anand|1935|Untouchable (novel)
The Discovery of India|Jawaharlal Nehru|1946
The Story of My Experiments with Truth|Mahatma Gandhi|1927
Wings of Fire|A. P. J. Abdul Kalam|1999|Wings of Fire (autobiography)
The Glass Palace|Amitav Ghosh|2000
Sea of Poppies|Amitav Ghosh|2008
The Shadow Lines|Amitav Ghosh|1988
The Palace of Illusions|Chitra Banerjee Divakaruni|2008
Five Point Someone|Chetan Bhagat|2004
2 States: The Story of My Marriage|Chetan Bhagat|2009
The Immortals of Meluha|Amish Tripathi|2010
Sacred Games|Vikram Chandra|2006|Sacred Games (novel)
Shantaram|Gregory David Roberts|2003
Life of Pi|Yann Martel|2001
The Kite Runner|Khaled Hosseini|2003
A Thousand Splendid Suns|Khaled Hosseini|2007
And the Mountains Echoed|Khaled Hosseini|2013
Snow Country|Yasunari Kawabata|1948
Norwegian Wood|Haruki Murakami|1987|Norwegian Wood (novel)
Kafka on the Shore|Haruki Murakami|2002
1Q84|Haruki Murakami|2009
The Wind-Up Bird Chronicle|Haruki Murakami|1994
Never Let Me Go|Kazuo Ishiguro|2005|Never Let Me Go (novel)
The Remains of the Day|Kazuo Ishiguro|1989
Klara and the Sun|Kazuo Ishiguro|2021
The Tale of Genji|Murasaki Shikibu|1010
Journey to the West|Wu Cheng'en|1592
Dream of the Red Chamber|Cao Xueqin|1791
Romance of the Three Kingdoms|Luo Guanzhong|1522
The Art of War|Sun Tzu|-500
Tao Te Ching|Laozi|-400
The Analects|Confucius|-475|Analects
The Three-Body Problem|Liu Cixin|2008|The Three-Body Problem (novel)
The Good Earth|Pearl S. Buck|1931
Wild Swans|Jung Chang|1991
The Odyssey|Homer|-700|Odyssey
The Iliad|Homer|-750|Iliad
The Aeneid|Virgil|-19|Aeneid
The Divine Comedy|Dante Alighieri|1320
The Canterbury Tales|Geoffrey Chaucer|1400
Paradise Lost|John Milton|1667
The Decameron|Giovanni Boccaccio|1353
One Thousand and One Nights|Various|800
The Epic of Gilgamesh|Unknown|-1800|Epic of Gilgamesh
Beowulf|Unknown|1000
The Republic|Plato|-375|Republic (Plato)
Meditations|Marcus Aurelius|180
The Prince|Niccolò Machiavelli|1532
Leviathan|Thomas Hobbes|1651|Leviathan (Hobbes book)
The Wealth of Nations|Adam Smith|1776
The Communist Manifesto|Karl Marx|1848
Das Kapital|Karl Marx|1867
On the Origin of Species|Charles Darwin|1859
Thus Spoke Zarathustra|Friedrich Nietzsche|1883
Beyond Good and Evil|Friedrich Nietzsche|1886
Critique of Pure Reason|Immanuel Kant|1781
The Second Sex|Simone de Beauvoir|1949
A Room of One's Own|Virginia Woolf|1929
Walden|Henry David Thoreau|1854
Leaves of Grass|Walt Whitman|1855
The Interpretation of Dreams|Sigmund Freud|1899
Man's Search for Meaning|Viktor Frankl|1946
The Diary of a Young Girl|Anne Frank|1947
Night|Elie Wiesel|1960|Night (memoir)
I Know Why the Caged Bird Sings|Maya Angelou|1969
The Autobiography of Malcolm X|Malcolm X and Alex Haley|1965
Long Walk to Freedom|Nelson Mandela|1994
Silent Spring|Rachel Carson|1962
A Brief History of Time|Stephen Hawking|1988
The Selfish Gene|Richard Dawkins|1976
Cosmos|Carl Sagan|1980|Cosmos (Sagan book)
Sapiens: A Brief History of Humankind|Yuval Noah Harari|2011
Homo Deus: A Brief History of Tomorrow|Yuval Noah Harari|2015
Guns, Germs, and Steel|Jared Diamond|1997
The Structure of Scientific Revolutions|Thomas Kuhn|1962
Gödel, Escher, Bach|Douglas Hofstadter|1979
Thinking, Fast and Slow|Daniel Kahneman|2011
Freakonomics|Steven Levitt and Stephen Dubner|2005
The Tipping Point|Malcolm Gladwell|2000
Outliers|Malcolm Gladwell|2008|Outliers (book)
The Immortal Life of Henrietta Lacks|Rebecca Skloot|2010
In Cold Blood|Truman Capote|1966
Breakfast at Tiffany's|Truman Capote|1958|Breakfast at Tiffany's (novella)
Into the Wild|Jon Krakauer|1996|Into the Wild (book)
Into Thin Air|Jon Krakauer|1997
Educated|Tara Westover|2018|Educated (memoir)
Becoming|Michelle Obama|2018|Becoming (book)
Dreams from My Father|Barack Obama|1995
Steve Jobs|Walter Isaacson|2011|Steve Jobs (book)
The Diary of Samuel Pepys|Samuel Pepys|1825|Diary of Samuel Pepys
Born a Crime|Trevor Noah|2016
When Breath Becomes Air|Paul Kalanithi|2016
Unbroken|Laura Hillenbrand|2010|Unbroken (book)
Seabiscuit: An American Legend|Laura Hillenbrand|2001
The Right Stuff|Tom Wolfe|1979|The Right Stuff (book)
The Bonfire of the Vanities|Tom Wolfe|1987
Fear and Loathing in Las Vegas|Hunter S. Thompson|1971
On the Road|Jack Kerouac|1957
Howl|Allen Ginsberg|1956|Howl (poem)
Naked Lunch|William S. Burroughs|1959
One Flew Over the Cuckoo's Nest|Ken Kesey|1962|One Flew Over the Cuckoo's Nest (novel)
The Bell Jar|Sylvia Plath|1963
Gone with the Wind|Margaret Mitchell|1936|Gone with the Wind (novel)
Rebecca|Daphne du Maurier|1938|Rebecca (novel)
My Cousin Rachel|Daphne du Maurier|1951
East of Eden|John Steinbeck|1952|East of Eden (novel)
Cannery Row|John Steinbeck|1945|Cannery Row (novel)
The Pearl|John Steinbeck|1947|The Pearl (novel)
Tender Is the Night|F. Scott Fitzgerald|1934
This Side of Paradise|F. Scott Fitzgerald|1920
The Sound and the Fury|William Faulkner|1929
As I Lay Dying|William Faulkner|1930
Light in August|William Faulkner|1932
Absalom, Absalom!|William Faulkner|1936
The Age of Innocence|Edith Wharton|1920
The House of Mirth|Edith Wharton|1905
Ethan Frome|Edith Wharton|1911
The Portrait of a Lady|Henry James|1881
The Turn of the Screw|Henry James|1898
The Awakening|Kate Chopin|1899|The Awakening (Chopin novel)
My Ántonia|Willa Cather|1918
Native Son|Richard Wright|1940
Go Tell It on the Mountain|James Baldwin|1953|Go Tell It on the Mountain (novel)
Giovanni's Room|James Baldwin|1956
The Fire Next Time|James Baldwin|1963
Song of Solomon|Toni Morrison|1977|Song of Solomon (novel)
The Bluest Eye|Toni Morrison|1970
Sula|Toni Morrison|1973|Sula (novel)
The Heart Is a Lonely Hunter|Carson McCullers|1940
A Good Man Is Hard to Find|Flannery O'Connor|1955|A Good Man Is Hard to Find (short story collection)
Wise Blood|Flannery O'Connor|1952
A Confederacy of Dunces|John Kennedy Toole|1980
Catch Me If You Can|Frank Abagnale|1980|Catch Me If You Can (book)
The Godfather|Mario Puzo|1969|The Godfather (novel)
Jaws|Peter Benchley|1974|Jaws (novel)
The Exorcist|William Peter Blatty|1971|The Exorcist (novel)
Rosemary's Baby|Ira Levin|1967|Rosemary's Baby (novel)
The Stepford Wives|Ira Levin|1972
Psycho|Robert Bloch|1959|Psycho (novel)
The Silence of the Lambs|Thomas Harris|1988|The Silence of the Lambs (novel)
Red Dragon|Thomas Harris|1981|Red Dragon (novel)
Hannibal|Thomas Harris|1999|Hannibal (Harris novel)
The Shining|Stephen King|1977|The Shining (novel)
It|Stephen King|1986|It (novel)
Carrie|Stephen King|1974|Carrie (novel)
Misery|Stephen King|1987|Misery (novel)
The Stand|Stephen King|1978
Pet Sematary|Stephen King|1983
'Salem's Lot|Stephen King|1975
The Green Mile|Stephen King|1996|The Green Mile (novel)
Different Seasons|Stephen King|1982
The Dark Tower: The Gunslinger|Stephen King|1982|The Dark Tower: The Gunslinger
11/22/63|Stephen King|2011
The Dead Zone|Stephen King|1979|The Dead Zone (novel)
Cujo|Stephen King|1981|Cujo (novel)
Christine|Stephen King|1983|Christine (novel)
Doctor Sleep|Stephen King|2013|Doctor Sleep (novel)
The Institute|Stephen King|2019|The Institute (novel)
The Outsider|Stephen King|2018|The Outsider (King novel)
Interview with the Vampire|Anne Rice|1976
Ghost Story|Peter Straub|1979|Ghost Story (novel)
The Haunting of Hill House|Shirley Jackson|1959
We Have Always Lived in the Castle|Shirley Jackson|1962
Hell House|Richard Matheson|1971|Hell House (novel)
I Am Legend|Richard Matheson|1954|I Am Legend (novel)
World War Z|Max Brooks|2006
The Road|Cormac McCarthy|2006
No Country for Old Men|Cormac McCarthy|2005
Blood Meridian|Cormac McCarthy|1985
All the Pretty Horses|Cormac McCarthy|1992|All the Pretty Horses (novel)
Lonesome Dove|Larry McMurtry|1985
The Last Picture Show|Larry McMurtry|1966
Terms of Endearment|Larry McMurtry|1975
True Grit|Charles Portis|1968|True Grit (novel)
Little Big Man|Thomas Berger|1964|Little Big Man (novel)
Gravity's Rainbow|Thomas Pynchon|1973
The Crying of Lot 49|Thomas Pynchon|1966
Infinite Jest|David Foster Wallace|1996
White Noise|Don DeLillo|1985|White Noise (novel)
Underworld|Don DeLillo|1997|Underworld (novel)
American Pastoral|Philip Roth|1997
Portnoy's Complaint|Philip Roth|1969
The Human Stain|Philip Roth|2000
Goodbye, Columbus|Philip Roth|1959
Rabbit, Run|John Updike|1960
Herzog|Saul Bellow|1964|Herzog (novel)
The Adventures of Augie March|Saul Bellow|1953
Humboldt's Gift|Saul Bellow|1975
The Naked and the Dead|Norman Mailer|1948
The Executioner's Song|Norman Mailer|1979
From Here to Eternity|James Jones|1951|From Here to Eternity (novel)
The Thin Red Line|James Jones|1962|The Thin Red Line (novel)
The Caine Mutiny|Herman Wouk|1951
The Winds of War|Herman Wouk|1971
The Young Lions|Irwin Shaw|1948
The Things They Carried|Tim O'Brien|1990
Matterhorn|Karl Marlantes|2010|Matterhorn (novel)
Band of Brothers|Stephen E. Ambrose|1992|Band of Brothers (book)
The Longest Day|Cornelius Ryan|1959|The Longest Day (book)
A Bridge Too Far|Cornelius Ryan|1974|A Bridge Too Far (book)
Black Hawk Down|Mark Bowden|1999|Black Hawk Down (book)
Schindler's Ark|Thomas Keneally|1982
Sophie's Choice|William Styron|1979|Sophie's Choice (novel)
The Book Thief|Markus Zusak|2005
All the Light We Cannot See|Anthony Doerr|2014
The Nightingale|Kristin Hannah|2015|The Nightingale (Hannah novel)
The Boy in the Striped Pyjamas|John Boyne|2006
Atonement|Ian McEwan|2001|Atonement (novel)
On Chesil Beach|Ian McEwan|2007
Enduring Love|Ian McEwan|1997
Saturday|Ian McEwan|2005|Saturday (novel)
The English Patient|Michael Ondaatje|1992
Birdsong|Sebastian Faulks|1993|Birdsong (novel)
Captain Corelli's Mandolin|Louis de Bernières|1994
Regeneration|Pat Barker|1991|Regeneration (novel)
Empire of the Sun|J. G. Ballard|1984|Empire of the Sun (novel)
Crash|J. G. Ballard|1973|Crash (Ballard novel)
High-Rise|J. G. Ballard|1975|High-Rise (novel)
A Clockwork Orange|Anthony Burgess|1962|A Clockwork Orange (novel)
Brideshead Revisited|Evelyn Waugh|1945
Scoop|Evelyn Waugh|1938|Scoop (novel)
A Handful of Dust|Evelyn Waugh|1934
Decline and Fall|Evelyn Waugh|1928
The End of the Affair|Graham Greene|1951
The Power and the Glory|Graham Greene|1940
Brighton Rock|Graham Greene|1938|Brighton Rock (novel)
The Quiet American|Graham Greene|1955
Our Man in Havana|Graham Greene|1958
The Third Man|Graham Greene|1949|The Third Man (novella)
A Passage to India|E. M. Forster|1924
A Room with a View|E. M. Forster|1908
Howards End|E. M. Forster|1910
Maurice|E. M. Forster|1971|Maurice (novel)
Sons and Lovers|D. H. Lawrence|1913
Women in Love|D. H. Lawrence|1920
Lady Chatterley's Lover|D. H. Lawrence|1928
Of Human Bondage|W. Somerset Maugham|1915
The Razor's Edge|W. Somerset Maugham|1944
The Moon and Sixpence|W. Somerset Maugham|1919
The Painted Veil|W. Somerset Maugham|1925|The Painted Veil (novel)
A Portrait of the Artist as a Young Man|James Joyce|1916
Dubliners|James Joyce|1914
Finnegans Wake|James Joyce|1939
Waiting for Godot|Samuel Beckett|1953
Murphy|Samuel Beckett|1938|Murphy (novel)
Under the Volcano|Malcolm Lowry|1947
The Prime of Miss Jean Brodie|Muriel Spark|1961
The Golden Notebook|Doris Lessing|1962
The French Lieutenant's Woman|John Fowles|1969
The Magus|John Fowles|1965|The Magus (novel)
The Collector|John Fowles|1963
Wide Sargasso Sea|Jean Rhys|1966
Possession|A. S. Byatt|1990|Possession (Byatt novel)
The Line of Beauty|Alan Hollinghurst|2004
Wolf Hall|Hilary Mantel|2009
Bring Up the Bodies|Hilary Mantel|2012
The Mirror & the Light|Hilary Mantel|2020
White Teeth|Zadie Smith|2000
On Beauty|Zadie Smith|2005
Brick Lane|Monica Ali|2003|Brick Lane (novel)
Small Island|Andrea Levy|2004|Small Island (novel)
The Buddha of Suburbia|Hanif Kureishi|1990|The Buddha of Suburbia (novel)
Trainspotting|Irvine Welsh|1993|Trainspotting (novel)
High Fidelity|Nick Hornby|1995|High Fidelity (novel)
About a Boy|Nick Hornby|1998|About a Boy (novel)
Fever Pitch|Nick Hornby|1992
Bridget Jones's Diary|Helen Fielding|1996
Notes on a Scandal|Zoë Heller|2003
Cloud Atlas|David Mitchell|2004|Cloud Atlas (novel)
The Bone Clocks|David Mitchell|2014
Shuggie Bain|Douglas Stuart|2020
Normal People|Sally Rooney|2018
Conversations with Friends|Sally Rooney|2017
Milkman|Anna Burns|2018|Milkman (novel)
The Sense of an Ending|Julian Barnes|2011
Flaubert's Parrot|Julian Barnes|1984
Money|Martin Amis|1984|Money (novel)
London Fields|Martin Amis|1989|London Fields (novel)
Lucky Jim|Kingsley Amis|1954
Room|Emma Donoghue|2010|Room (novel)
The Lovely Bones|Alice Sebold|2002
Life After Life|Kate Atkinson|2013|Life After Life (Atkinson novel)
Behind the Scenes at the Museum|Kate Atkinson|1995
The Curious Incident of the Dog in the Night-Time|Mark Haddon|2003
The Time Traveler's Wife|Audrey Niffenegger|2003
The Help|Kathryn Stockett|2009|The Help (novel)
Where the Crawdads Sing|Delia Owens|2018
Little Fires Everywhere|Celeste Ng|2017
Big Little Lies|Liane Moriarty|2014|Big Little Lies (novel)
The Secret Life of Bees|Sue Monk Kidd|2001
Water for Elephants|Sara Gruen|2006
The Notebook|Nicholas Sparks|1996|The Notebook (novel)
A Walk to Remember|Nicholas Sparks|1999|A Walk to Remember (novel)
The Bridges of Madison County|Robert James Waller|1992
Me Before You|Jojo Moyes|2012
The Fault in Our Stars|John Green|2012
Looking for Alaska|John Green|2005
Paper Towns|John Green|2008
The Perks of Being a Wallflower|Stephen Chbosky|1999
Eleanor & Park|Rainbow Rowell|2012
The Hate U Give|Angie Thomas|2017
Wonder|R. J. Palacio|2012|Wonder (Palacio novel)
Holes|Louis Sachar|1998|Holes (novel)
The Outsiders|S. E. Hinton|1967|The Outsiders (novel)
Bridge to Terabithia|Katherine Paterson|1977|Bridge to Terabithia (novel)
Hatchet|Gary Paulsen|1987|Hatchet (novel)
Where the Red Fern Grows|Wilson Rawls|1961
Island of the Blue Dolphins|Scott O'Dell|1960
A Wrinkle in Time|Madeleine L'Engle|1962
The Giver|Lois Lowry|1993
Number the Stars|Lois Lowry|1989
Tuck Everlasting|Natalie Babbitt|1975
Charlotte's Web|E. B. White|1952
Stuart Little|E. B. White|1945
Matilda|Roald Dahl|1988|Matilda (novel)
Charlie and the Chocolate Factory|Roald Dahl|1964
The BFG|Roald Dahl|1982
James and the Giant Peach|Roald Dahl|1961
The Witches|Roald Dahl|1983|The Witches (novel)
Fantastic Mr Fox|Roald Dahl|1970
Danny, the Champion of the World|Roald Dahl|1975
The Wind in the Willows|Kenneth Grahame|1908
Peter Pan|J. M. Barrie|1911|Peter and Wendy
The Jungle Book|Rudyard Kipling|1894
Kim|Rudyard Kipling|1901|Kim (novel)
Just So Stories|Rudyard Kipling|1902
Black Beauty|Anna Sewell|1877
Heidi|Johanna Spyri|1881
The Secret Garden|Frances Hodgson Burnett|1911
A Little Princess|Frances Hodgson Burnett|1905
Anne of Green Gables|Lucy Maud Montgomery|1908
Pippi Longstocking|Astrid Lindgren|1945
Winnie-the-Pooh|A. A. Milne|1926|Winnie-the-Pooh (book)
The Wonderful Wizard of Oz|L. Frank Baum|1900
Mary Poppins|P. L. Travers|1934|Mary Poppins (book)
The Hundred and One Dalmatians|Dodie Smith|1956
Watership Down|Richard Adams|1972
The Borrowers|Mary Norton|1952
The Railway Children|E. Nesbit|1906
Swallows and Amazons|Arthur Ransome|1930
The Phantom Tollbooth|Norton Juster|1961
The Tale of Peter Rabbit|Beatrix Potter|1902
Where the Wild Things Are|Maurice Sendak|1963
The Cat in the Hat|Dr. Seuss|1957
Green Eggs and Ham|Dr. Seuss|1960
How the Grinch Stole Christmas!|Dr. Seuss|1957
The Very Hungry Caterpillar|Eric Carle|1969
Goodnight Moon|Margaret Wise Brown|1947
The Giving Tree|Shel Silverstein|1964
The Polar Express|Chris Van Allsburg|1985
Jumanji|Chris Van Allsburg|1981|Jumanji (picture book)
The Gruffalo|Julia Donaldson|1999
Coraline|Neil Gaiman|2002
The Graveyard Book|Neil Gaiman|2008
American Gods|Neil Gaiman|2001
Good Omens|Terry Pratchett and Neil Gaiman|1990
Stardust|Neil Gaiman|1999|Stardust (Gaiman novel)
Neverwhere|Neil Gaiman|1996
The Ocean at the End of the Lane|Neil Gaiman|2013
Anansi Boys|Neil Gaiman|2005
Harry Potter and the Chamber of Secrets|J. K. Rowling|1998
Harry Potter and the Prisoner of Azkaban|J. K. Rowling|1999
Harry Potter and the Goblet of Fire|J. K. Rowling|2000
Harry Potter and the Order of the Phoenix|J. K. Rowling|2003
Harry Potter and the Half-Blood Prince|J. K. Rowling|2005
Harry Potter and the Deathly Hallows|J. K. Rowling|2007
The Fellowship of the Ring|J. R. R. Tolkien|1954
The Two Towers|J. R. R. Tolkien|1954
The Return of the King|J. R. R. Tolkien|1955
The Silmarillion|J. R. R. Tolkien|1977
The Hunger Games|Suzanne Collins|2008|The Hunger Games (novel)
Catching Fire|Suzanne Collins|2009
Mockingjay|Suzanne Collins|2010
Twilight|Stephenie Meyer|2005|Twilight (Meyer novel)
Divergent|Veronica Roth|2011|Divergent (novel)
The Maze Runner|James Dashner|2009|The Maze Runner (novel)
Percy Jackson & the Olympians: The Lightning Thief|Rick Riordan|2005|The Lightning Thief
Artemis Fowl|Eoin Colfer|2001|Artemis Fowl (novel)
Northern Lights|Philip Pullman|1995|Northern Lights (Pullman novel)
The Subtle Knife|Philip Pullman|1997
The Amber Spyglass|Philip Pullman|2000
Eragon|Christopher Paolini|2002
Inkheart|Cornelia Funke|2003
The NeverEnding Story|Michael Ende|1979
Momo|Michael Ende|1973|Momo (novel)
Howl's Moving Castle|Diana Wynne Jones|1986
A Wizard of Earthsea|Ursula K. Le Guin|1968
The Left Hand of Darkness|Ursula K. Le Guin|1969
The Dispossessed|Ursula K. Le Guin|1974
The Once and Future King|T. H. White|1958
The Sword in the Stone|T. H. White|1938|The Sword in the Stone (novel)
The Princess Bride|William Goldman|1973|The Princess Bride (novel)
The Last Unicorn|Peter S. Beagle|1968
A Game of Thrones|George R. R. Martin|1996
A Clash of Kings|George R. R. Martin|1998
A Storm of Swords|George R. R. Martin|2000
Fire & Blood|George R. R. Martin|2018|Fire & Blood (novel)
The Eye of the World|Robert Jordan|1990
The Name of the Wind|Patrick Rothfuss|2007
Mistborn: The Final Empire|Brandon Sanderson|2006
The Way of Kings|Brandon Sanderson|2010
The Colour of Magic|Terry Pratchett|1983
Mort|Terry Pratchett|1987
Guards! Guards!|Terry Pratchett|1989
Small Gods|Terry Pratchett|1992
Going Postal|Terry Pratchett|2004
Jonathan Strange & Mr Norrell|Susanna Clarke|2004
Piranesi|Susanna Clarke|2020|Piranesi (novel)
The Lies of Locke Lamora|Scott Lynch|2006
The Witcher: The Last Wish|Andrzej Sapkowski|1993|The Last Wish (book)
Blood of Elves|Andrzej Sapkowski|1994
Gardens of the Moon|Steven Erikson|1999
The Fifth Season|N. K. Jemisin|2015|The Fifth Season (novel)
Assassin's Apprentice|Robin Hobb|1995
Magician|Raymond E. Feist|1982|Magician (Feist novel)
Sword of Shannara|Terry Brooks|1977|The Sword of Shannara
The Belgariad: Pawn of Prophecy|David Eddings|1982|Pawn of Prophecy
Dragonflight|Anne McCaffrey|1968
Conan the Barbarian|Robert E. Howard|1932|Conan the Barbarian
The Mists of Avalon|Marion Zimmer Bradley|1983
Circe|Madeline Miller|2018|Circe (novel)
The Song of Achilles|Madeline Miller|2011
The Night Circus|Erin Morgenstern|2011
Shadow and Bone|Leigh Bardugo|2012
Six of Crows|Leigh Bardugo|2015
A Court of Thorns and Roses|Sarah J. Maas|2015
Fourth Wing|Rebecca Yarros|2023
Foundation|Isaac Asimov|1951|Foundation (Asimov novel)
I, Robot|Isaac Asimov|1950
The Caves of Steel|Isaac Asimov|1954
The End of Eternity|Isaac Asimov|1955
Childhood's End|Arthur C. Clarke|1953
2001: A Space Odyssey|Arthur C. Clarke|1968|2001: A Space Odyssey (novel)
Rendezvous with Rama|Arthur C. Clarke|1973
Stranger in a Strange Land|Robert A. Heinlein|1961
Starship Troopers|Robert A. Heinlein|1959
The Moon Is a Harsh Mistress|Robert A. Heinlein|1966
Do Androids Dream of Electric Sheep?|Philip K. Dick|1968
The Man in the High Castle|Philip K. Dick|1962
Ubik|Philip K. Dick|1969
A Scanner Darkly|Philip K. Dick|1977
Flowers for Algernon|Daniel Keyes|1966
Neuromancer|William Gibson|1984
Snow Crash|Neal Stephenson|1992
Cryptonomicon|Neal Stephenson|1999
Hyperion|Dan Simmons|1989|Hyperion (Simmons novel)
Ender's Game|Orson Scott Card|1985
Speaker for the Dead|Orson Scott Card|1986
The Forever War|Joe Haldeman|1974
Ringworld|Larry Niven|1970
The Mote in God's Eye|Larry Niven and Jerry Pournelle|1974
Solaris|Stanisław Lem|1961|Solaris (novel)
Roadside Picnic|Arkady and Boris Strugatsky|1972
We|Yevgeny Zamyatin|1924|We (novel)
The Handmaid's Tale|Margaret Atwood|1985
Oryx and Crake|Margaret Atwood|2003
Alias Grace|Margaret Atwood|1996
The Blind Assassin|Margaret Atwood|2000
The Testaments|Margaret Atwood|2019
Kindred|Octavia E. Butler|1979|Kindred (novel)
Parable of the Sower|Octavia E. Butler|1993|Parable of the Sower (novel)
The Martian Chronicles|Ray Bradbury|1950
Something Wicked This Way Comes|Ray Bradbury|1962|Something Wicked This Way Comes (novel)
Dandelion Wine|Ray Bradbury|1957
Cat's Cradle|Kurt Vonnegut|1963
The Sirens of Titan|Kurt Vonnegut|1959
Breakfast of Champions|Kurt Vonnegut|1973
The Martian|Andy Weir|2011|The Martian (Weir novel)
Project Hail Mary|Andy Weir|2021
Ready Player One|Ernest Cline|2011
Jurassic Park|Michael Crichton|1990|Jurassic Park (novel)
The Andromeda Strain|Michael Crichton|1969
Sphere|Michael Crichton|1987|Sphere (novel)
Congo|Michael Crichton|1980|Congo (novel)
Contact|Carl Sagan|1985|Contact (novel)
Altered Carbon|Richard K. Morgan|2002
Leviathan Wakes|James S. A. Corey|2011
Red Rising|Pierce Brown|2014|Red Rising (novel)
Ancillary Justice|Ann Leckie|2013
Station Eleven|Emily St. John Mandel|2014
Annihilation|Jeff VanderMeer|2014|Annihilation (VanderMeer novel)
The Restaurant at the End of the Universe|Douglas Adams|1980
Dirk Gently's Holistic Detective Agency|Douglas Adams|1987
Children of Time|Adrian Tchaikovsky|2015|Children of Time (novel)
Dark Matter|Blake Crouch|2016|Dark Matter (Crouch novel)
Wool|Hugh Howey|2011|Wool (novel series)
Brave New World Revisited|Aldous Huxley|1958
Island|Aldous Huxley|1962|Island (Huxley novel)
The Day of the Triffids|John Wyndham|1951
The Midwich Cuckoos|John Wyndham|1957
The Chrysalids|John Wyndham|1955
Planet of the Apes|Pierre Boulle|1963|Planet of the Apes (novel)
The Bridge over the River Kwai|Pierre Boulle|1952|The Bridge over the River Kwai (novel)
Logan's Run|William F. Nolan and George Clayton Johnson|1967|Logan's Run (novel)
Make Room! Make Room!|Harry Harrison|1966
The Stars My Destination|Alfred Bester|1956
A Canticle for Leibowitz|Walter M. Miller Jr.|1959
On the Beach|Nevil Shute|1957|On the Beach (novel)
A Town Like Alice|Nevil Shute|1950
The Hound of the Baskervilles|Arthur Conan Doyle|1902
A Study in Scarlet|Arthur Conan Doyle|1887
The Adventures of Sherlock Holmes|Arthur Conan Doyle|1892
The Sign of the Four|Arthur Conan Doyle|1890
The Lost World|Arthur Conan Doyle|1912|The Lost World (Conan Doyle novel)
And Then There Were None|Agatha Christie|1939
Murder on the Orient Express|Agatha Christie|1934
The Murder of Roger Ackroyd|Agatha Christie|1926
Death on the Nile|Agatha Christie|1937
The ABC Murders|Agatha Christie|1936
The Mysterious Affair at Styles|Agatha Christie|1920
The Murder at the Vicarage|Agatha Christie|1930
Evil Under the Sun|Agatha Christie|1941
The Mousetrap|Agatha Christie|1952
The Moonstone|Wilkie Collins|1868
The Woman in White|Wilkie Collins|1859|The Woman in White (novel)
The Maltese Falcon|Dashiell Hammett|1930|The Maltese Falcon (novel)
The Thin Man|Dashiell Hammett|1934
The Big Sleep|Raymond Chandler|1939
The Long Goodbye|Raymond Chandler|1953|The Long Goodbye (novel)
Farewell, My Lovely|Raymond Chandler|1940
The Postman Always Rings Twice|James M. Cain|1934|The Postman Always Rings Twice (novel)
Double Indemnity|James M. Cain|1943|Double Indemnity (novel)
Mildred Pierce|James M. Cain|1941|Mildred Pierce (novel)
The Talented Mr. Ripley|Patricia Highsmith|1955
Strangers on a Train|Patricia Highsmith|1950|Strangers on a Train (novel)
The Price of Salt|Patricia Highsmith|1952
Gaudy Night|Dorothy L. Sayers|1935
The Daughter of Time|Josephine Tey|1951
The Day of the Jackal|Frederick Forsyth|1971
The Odessa File|Frederick Forsyth|1972
The Spy Who Came in from the Cold|John le Carré|1963
Tinker Tailor Soldier Spy|John le Carré|1974
The Constant Gardener|John le Carré|2001
The Little Drummer Girl|John le Carré|1983
The Night Manager|John le Carré|1993
The Bourne Identity|Robert Ludlum|1980|The Bourne Identity (novel)
The Hunt for Red October|Tom Clancy|1984
Patriot Games|Tom Clancy|1987
Clear and Present Danger|Tom Clancy|1989
Casino Royale|Ian Fleming|1953|Casino Royale (novel)
From Russia, with Love|Ian Fleming|1957|From Russia, with Love (novel)
Goldfinger|Ian Fleming|1959|Goldfinger (novel)
Dr. No|Ian Fleming|1958|Dr. No (novel)
The Thirty-Nine Steps|John Buchan|1915
The Riddle of the Sands|Erskine Childers|1903
The Eagle Has Landed|Jack Higgins|1975|The Eagle Has Landed (novel)
Where Eagles Dare|Alistair MacLean|1967|Where Eagles Dare (novel)
The Guns of Navarone|Alistair MacLean|1957|The Guns of Navarone (novel)
Ice Station Zebra|Alistair MacLean|1963
The Da Vinci Code|Dan Brown|2003
Angels & Demons|Dan Brown|2000
Inferno|Dan Brown|2013|Inferno (Brown novel)
The Firm|John Grisham|1991|The Firm (novel)
A Time to Kill|John Grisham|1989|A Time to Kill (Grisham novel)
The Pelican Brief|John Grisham|1992
The Client|John Grisham|1993|The Client (novel)
The Runaway Jury|John Grisham|1996
Presumed Innocent|Scott Turow|1987|Presumed Innocent (novel)
Gone Girl|Gillian Flynn|2012
Sharp Objects|Gillian Flynn|2006
The Girl on the Train|Paula Hawkins|2015|The Girl on the Train (novel)
The Girl with the Dragon Tattoo|Stieg Larsson|2005
The Girl Who Played with Fire|Stieg Larsson|2006
The Silent Patient|Alex Michaelides|2019
Mystic River|Dennis Lehane|2001|Mystic River (novel)
Shutter Island|Dennis Lehane|2003|Shutter Island (novel)
Gone, Baby, Gone|Dennis Lehane|1998
L.A. Confidential|James Ellroy|1990|L.A. Confidential (novel)
The Black Dahlia|James Ellroy|1987|The Black Dahlia (novel)
Get Shorty|Elmore Leonard|1990|Get Shorty (novel)
Rum Punch|Elmore Leonard|1992
Killing Floor|Lee Child|1997|Killing Floor (novel)
Along Came a Spider|James Patterson|1993|Along Came a Spider (novel)
Kiss the Girls|James Patterson|1995|Kiss the Girls (novel)
The Lincoln Lawyer|Michael Connelly|2005
The Black Echo|Michael Connelly|1992
The Bone Collector|Jeffery Deaver|1997|The Bone Collector (novel)
Postmortem|Patricia Cornwell|1990|Postmortem (novel)
In the Woods|Tana French|2007
The Cuckoo's Calling|Robert Galbraith|2013
Rebus: Knots and Crosses|Ian Rankin|1987|Knots and Crosses
The No. 1 Ladies' Detective Agency|Alexander McCall Smith|1998|The No. 1 Ladies' Detective Agency (novel)
The Thursday Murder Club|Richard Osman|2020
Marathon Man|William Goldman|1974|Marathon Man (novel)
The Manchurian Candidate|Richard Condon|1959
Fail Safe|Eugene Burdick and Harvey Wheeler|1962|Fail-Safe (novel)
Seven Days in May|Fletcher Knebel and Charles W. Bailey II|1962
First Blood|David Morrell|1972|First Blood (novel)
Shōgun|James Clavell|1975|Shōgun (novel)
Tai-Pan|James Clavell|1966
King Rat|James Clavell|1962|King Rat (novel)
The Thorn Birds|Colleen McCullough|1977
The Pillars of the Earth|Ken Follett|1989
Eye of the Needle|Ken Follett|1978
Fall of Giants|Ken Follett|2010
Outlander|Diana Gabaldon|1991|Outlander (novel)
Roots: The Saga of an American Family|Alex Haley|1976
North and South|John Jakes|1982|North and South (Jakes novel)
The Clan of the Cave Bear|Jean M. Auel|1980
Exodus|Leon Uris|1958|Exodus (Uris novel)
Hawaii|James A. Michener|1959|Hawaii (Michener novel)
The Source|James A. Michener|1965|The Source (novel)
Rich Man, Poor Man|Irwin Shaw|1970|Rich Man, Poor Man (novel)
Valley of the Dolls|Jacqueline Susann|1966|Valley of the Dolls (novel)
Peyton Place|Grace Metalious|1956|Peyton Place (novel)
The Valley of Fear|Arthur Conan Doyle|1915
The Prisoner of Zenda|Anthony Hope|1894
The Scarlet Pimpernel|Baroness Orczy|1905
Ivanhoe|Walter Scott|1819
The Last of the Mohicans|James Fenimore Cooper|1826
Ben-Hur: A Tale of the Christ|Lew Wallace|1880
Quo Vadis|Henryk Sienkiewicz|1896|Quo Vadis (novel)
Spartacus|Howard Fast|1951|Spartacus (Fast novel)
I, Claudius|Robert Graves|1934
Goodbye to All That|Robert Graves|1929|Goodbye to All That (memoir)
Memoirs of Hadrian|Marguerite Yourcenar|1951
Mutiny on the Bounty|Charles Nordhoff and James Norman Hall|1932|Mutiny on the Bounty (novel)
Master and Commander|Patrick O'Brian|1969
Horatio Hornblower: The Happy Return|C. S. Forester|1937|The Happy Return
The African Queen|C. S. Forester|1935|The African Queen (novel)
King Solomon's Mines|H. Rider Haggard|1885
She: A History of Adventure|H. Rider Haggard|1887
The Man Who Would Be King|Rudyard Kipling|1888
Tarzan of the Apes|Edgar Rice Burroughs|1912
A Princess of Mars|Edgar Rice Burroughs|1912
The Phantom of the Opera|Gaston Leroux|1910
Carmilla|Sheridan Le Fanu|1872
The Legend of Sleepy Hollow|Washington Irving|1820
Rip Van Winkle|Washington Irving|1819
The Fall of the House of Usher|Edgar Allan Poe|1839
The Tell-Tale Heart|Edgar Allan Poe|1843
The Raven|Edgar Allan Poe|1845
The Call of Cthulhu|H. P. Lovecraft|1928
At the Mountains of Madness|H. P. Lovecraft|1936
Hamlet|William Shakespeare|1603
Romeo and Juliet|William Shakespeare|1597
Macbeth|William Shakespeare|1623
Othello|William Shakespeare|1622
King Lear|William Shakespeare|1608
A Midsummer Night's Dream|William Shakespeare|1600
The Tempest|William Shakespeare|1623
Julius Caesar|William Shakespeare|1623|Julius Caesar (play)
The Merchant of Venice|William Shakespeare|1600
Twelfth Night|William Shakespeare|1623
Much Ado About Nothing|William Shakespeare|1600
Death of a Salesman|Arthur Miller|1949
The Crucible|Arthur Miller|1953
A Streetcar Named Desire|Tennessee Williams|1947
The Glass Menagerie|Tennessee Williams|1944
Cat on a Hot Tin Roof|Tennessee Williams|1955
Long Day's Journey into Night|Eugene O'Neill|1956
Who's Afraid of Virginia Woolf?|Edward Albee|1962
A Raisin in the Sun|Lorraine Hansberry|1959
Pygmalion|George Bernard Shaw|1913|Pygmalion (play)
The Importance of Being Earnest|Oscar Wilde|1895
A Doll's House|Henrik Ibsen|1879
The Cherry Orchard|Anton Chekhov|1904
Faust|Johann Wolfgang von Goethe|1808|Goethe's Faust
The Sorrows of Young Werther|Johann Wolfgang von Goethe|1774
Cyrano de Bergerac|Edmond Rostand|1897
The Waste Land|T. S. Eliot|1922
Old Possum's Book of Practical Cats|T. S. Eliot|1939
The Prophet|Kahlil Gibran|1923|The Prophet (book)
Rubaiyat of Omar Khayyam|Edward FitzGerald|1859
Bhagavad Gita|Vyasa|-200
Mahabharata|Vyasa|-400
Ramayana|Valmiki|-500
Panchatantra|Vishnu Sharma|-200
Autobiography of a Yogi|Paramahansa Yogananda|1946
The Power of Now|Eckhart Tolle|1997
The 7 Habits of Highly Effective People|Stephen Covey|1989
How to Win Friends and Influence People|Dale Carnegie|1936
Think and Grow Rich|Napoleon Hill|1937
Rich Dad Poor Dad|Robert Kiyosaki|1997
Atomic Habits|James Clear|2018
The Subtle Art of Not Giving a F*ck|Mark Manson|2016
The 4-Hour Workweek|Tim Ferriss|2007
The Lean Startup|Eric Ries|2011
Zero to One|Peter Thiel|2014
Good to Great|Jim Collins|2001
The Intelligent Investor|Benjamin Graham|1949
The Psychology of Money|Morgan Housel|2020
The Big Short|Michael Lewis|2010|The Big Short (book)
Moneyball|Michael Lewis|2003|Moneyball (book)
The Blind Side: Evolution of a Game|Michael Lewis|2006
Liar's Poker|Michael Lewis|1989
Flash Boys|Michael Lewis|2014
Barbarians at the Gate|Bryan Burrough and John Helyar|1989
Too Big to Fail|Andrew Ross Sorkin|2009|Too Big to Fail (book)
Bad Blood: Secrets and Lies in a Silicon Valley Startup|John Carreyrou|2018
The Accidental Billionaires|Ben Mezrich|2009
Bringing Down the House|Ben Mezrich|2002|Bringing Down the House (book)
Catch and Kill|Ronan Farrow|2019
All the President's Men|Carl Bernstein and Bob Woodward|1974
Hidden Figures|Margot Lee Shetterly|2016|Hidden Figures (book)
Killers of the Flower Moon|David Grann|2017
The Lost City of Z|David Grann|2009|The Lost City of Z (book)
The Wager|David Grann|2023|The Wager (book)
The Devil in the White City|Erik Larson|2003
Midnight in the Garden of Good and Evil|John Berendt|1994
The Perfect Storm|Sebastian Junger|1997|The Perfect Storm (book)
Friday Night Lights|H. G. Bissinger|1990|Friday Night Lights (book)
Orchid Thief|Susan Orlean|1998|The Orchid Thief
Eat, Pray, Love|Elizabeth Gilbert|2006
Wild: From Lost to Found on the Pacific Crest Trail|Cheryl Strayed|2012
The Glass Castle|Jeannette Walls|2005
Angela's Ashes|Frank McCourt|1996
A Beautiful Mind|Sylvia Nasar|1998|A Beautiful Mind (book)
Travelling to Infinity|Jane Hawking|2007
The Diving Bell and the Butterfly|Jean-Dominique Bauby|1997
Marley & Me|John Grogan|2005
Tuesdays with Morrie|Mitch Albom|1997
The Five People You Meet in Heaven|Mitch Albom|2003
Chocolat|Joanne Harris|1999|Chocolat (novel)
Like Water for Chocolate|Laura Esquivel|1989
Memoirs of a Geisha|Arthur Golden|1997
Girl with a Pearl Earring|Tracy Chevalier|1999|Girl with a Pearl Earring (novel)
The Other Boleyn Girl|Philippa Gregory|2001
Brooklyn|Colm Tóibín|2009|Brooklyn (novel)
The Hours|Michael Cunningham|1998|The Hours (novel)
Revolutionary Road|Richard Yates|1961
The Corrections|Jonathan Franzen|2001
Freedom|Jonathan Franzen|2010|Freedom (Franzen novel)
Middlesex|Jeffrey Eugenides|2002|Middlesex (novel)
The Virgin Suicides|Jeffrey Eugenides|1993
The Goldfinch|Donna Tartt|2013|The Goldfinch (novel)
The Secret History|Donna Tartt|1992
A Little Life|Hanya Yanagihara|2015
`;

export const TOP_TAMIL_BOOKS_TEXT = `
Tirukkural|Thiruvalluvar|-100|Kural|திருக்குறள்
Silappatikaram|Ilango Adigal|200|Silappatikaram|சிலப்பதிகாரம்
Manimekalai|Seethalai Saathanar|500|Manimekalai|மணிமேகலை
Civaka Cintamani|Tiruttakkatevar|900|Civaka Cintamani|சீவக சிந்தாமணி
Valayapathi|Unknown|900|Valayapathi|வளையாபதி
Kundalakesi|Nathakuthanaar|500|Kundalakesi|குண்டலகேசி
Kamba Ramayanam|Kambar|1180|Ramavataram|கம்பராமாயணம்
Periya Puranam|Sekkizhar|1140|Periya Puranam|பெரிய புராணம்
Tevaram|Appar, Sambandar and Sundarar|700|Tevaram|தேவாரம்
Thiruvasagam|Manikkavacakar|900|Thiruvasagam|திருவாசகம்
Tirumantiram|Tirumular|600|Tirumantiram|திருமந்திரம்
Naalayira Divya Prabandham|Alvars|900|Naalayira Divya Prabandham|நாலாயிரத் திவ்வியப் பிரபந்தம்
Thiruppavai|Andal|800|Thiruppavai|திருப்பாவை
Tolkāppiyam|Tolkappiyar|-200|Tolkāppiyam|தொல்காப்பியம்
Purananuru|Various|100|Purananuru|புறநானூறு
Akananuru|Various|100|Akananuru|அகநானூறு
Kuruntokai|Various|100|Kuruntokai|குறுந்தொகை
Natrinai|Various|100|Natrinai|நற்றிணை
Ainkurunuru|Various|100|Ainkurunuru|ஐங்குறுநூறு
Kalittokai|Various|200|Kalittokai|கலித்தொகை
Paripāṭal|Various|200|Paripāṭal|பரிபாடல்
Pathiṟṟuppattu|Various|100|Patiṟṟuppattu|பதிற்றுப்பத்து
Pattuppāṭṭu|Various|200|Pattuppāṭṭu|பத்துப்பாட்டு
Tirumurugarruppadai|Nakkirar|200|Tirumurukāṟṟuppaṭai|திருமுருகாற்றுப்படை
Naladiyar|Jain monks|500|Naladiyar|நாலடியார்
Aathichoodi|Avvaiyar|1100|Aathichoodi|ஆத்திசூடி
Kalingattuparani|Jayamkondar|1100|Kalingattuparani|கலிங்கத்துப்பரணி
Kanda Puranam|Kachiyappa Sivachariyar|1400|Kandha Puranam|கந்த புராணம்
Thirupugal|Arunagirinathar|1450|Thiruppugal|திருப்புகழ்
Thembavani|Constantine Joseph Beschi|1726|Thembavani|தேம்பாவணி
Seerapuranam|Umaru Pulavar|1700|Seerapuranam|சீறாப்புராணம்
Ponniyin Selvan|Kalki Krishnamurthy|1955|Ponniyin Selvan (novel)|பொன்னியின் செல்வன்
Sivagamiyin Sapatham|Kalki Krishnamurthy|1948|Sivagamiyin Sapatham|சிவகாமியின் சபதம்
Parthiban Kanavu|Kalki Krishnamurthy|1942|Parthiban Kanavu (novel)|பார்த்திபன் கனவு
Alai Osai|Kalki Krishnamurthy|1953|Alai Osai|அலை ஓசை
Thiyaga Bhoomi|Kalki Krishnamurthy|1938|Thiyaga Bhoomi (novel)|தியாக பூமி
Kalvanin Kadhali|Kalki Krishnamurthy|1937|Kalvanin Kadhali (novel)|கள்வனின் காதலி
Prathapa Mudaliar Charithram|Mayuram Vedanayagam Pillai|1879|Prathapa Mudaliar Charithram|பிரதாப முதலியார் சரித்திரம்
Kamalambal Charitram|B. R. Rajam Iyer|1896|Kamalambal Charitram|கமலாம்பாள் சரித்திரம்
Padmavathi Charithram|A. Madhaviah|1898|Padmavathi Charithram|பத்மாவதி சரித்திரம்
Panchali Sapatham|Subramania Bharati|1912|Panchali Sabatham|பாஞ்சாலி சபதம்
Kuyil Pattu|Subramania Bharati|1912|Kuyil Pattu|குயில் பாட்டு
Kannan Pattu|Subramania Bharati|1917|Kannan Pattu|கண்ணன் பாட்டு
Pandiyan Parisu|Bharathidasan|1938|Pandiyan Parisu|பாண்டியன் பரிசு
Kudumba Vilakku|Bharathidasan|1942|Kudumba Vilakku|குடும்ப விளக்கு
Arthamulla Indhu Madham|Kannadasan|1972|Arthamulla Indhu Matham|அர்த்தமுள்ள இந்து மதம்
Yesu Kaviyam|Kannadasan|1981|Yesu Kaviyam|இயேசு காவியம்
Vanavasam|Kannadasan|1965|Vanavasam|வனவாசம்
Sila Nerangalil Sila Manithargal|Jayakanthan|1970|Sila Nerangalil Sila Manithargal (novel)|சில நேரங்களில் சில மனிதர்கள்
Oru Manithan Oru Veedu Oru Ulagam|Jayakanthan|1973|Oru Manithan Oru Veedu Oru Ulagam|ஒரு மனிதன் ஒரு வீடு ஒரு உலகம்
Unnaipol Oruvan|Jayakanthan|1964|Unnaipol Oruvan (novel)|உன்னைப்போல் ஒருவன்
Gangai Engey Pogiraal|Jayakanthan|1978|Gangai Engey Pogiraal|கங்கை எங்கே போகிறாள்
Paarisukku Po|Jayakanthan|1966|Paarisukku Po|பாரிசுக்குப் போ
Moga Mul|Thi. Janakiraman|1964|Moga Mul (novel)|மோக முள்
Amma Vanthaal|Thi. Janakiraman|1966|Amma Vanthaal|அம்மா வந்தாள்
Marappasu|Thi. Janakiraman|1975|Marappasu|மரப்பசு
Oru Puliyamarathin Kathai|Sundara Ramaswamy|1966|Oru Puliyamarathin Kathai|ஒரு புளியமரத்தின் கதை
J. J. Sila Kurippugal|Sundara Ramaswamy|1981|J. J. Sila Kurippugal|ஜே. ஜே. சில குறிப்புகள்
Kuzhandaigal Pengal Aangal|Sundara Ramaswamy|1998|Kuzhandaigal Pengal Aangal|குழந்தைகள், பெண்கள், ஆண்கள்
Thaneer|Ashokamitran|1973|Thaneer (novel)|தண்ணீர்
Karainthu Nizhalgal|Ashokamitran|1969|Karainda Nizhalgal|கரைந்த நிழல்கள்
18vathu Atchakodu|Ashokamitran|1977|18vathu Atchakodu|பதினெட்டாவது அட்சக்கோடு
Ponnagaram|Pudhumaipithan|1934|Ponnagaram|பொன்னகரம்
Kadavulum Kandasami Pillaiyum|Pudhumaipithan|1943|Kadavulum Kandasami Pillaiyum|கடவுளும் கந்தசாமி பிள்ளையும்
Abitha|La. Sa. Ramamirtham|1970|Abitha (novel)|அபிதா
Kurinji Malar|Na. Parthasarathy|1960|Kurinji Malar (novel)|குறிஞ்சி மலர்
Chithira Paavai|Akilan|1968|Chithira Paavai|சித்திரப்பாவை
Vengayin Maindhan|Akilan|1961|Vengaiyin Maindhan|வேங்கையின் மைந்தன்
Kayal Vizhi|Akilan|1965|Kayal Vizhi (novel)|கயல்விழி
Karithundu|Mu. Varadarajan|1950|Karithundu|கரித்துண்டு
Kallo Kaviyamo|Mu. Varadarajan|1956|Kallo Kaviyamo|கள்ளோ காவியமோ
Sayavanam|Sa. Kandasamy|1968|Sayavanam|சாயாவனம்
Visaranai Kamishan|Sa. Kandasamy|1998|Visaranai Commission|விசாரணைக் கமிஷன்
Kuruthipunal|Indira Parthasarathy|1975|Kuruthippunal (novel)|குருதிப்புனல்
Gopallapurathu Makkal|Ki. Rajanarayanan|1976|Gopallapurathu Makkal|கோபல்லபுரத்து மக்கள்
Gopallagramam|Ki. Rajanarayanan|1976|Gopallagramam|கோபல்ல கிராமம்
Thalaimuraigal|Neela Padmanabhan|1968|Thalaimuraigal|தலைமுறைகள்
Pallikondapuram|Neela Padmanabhan|1970|Pallikondapuram|பள்ளிகொண்டபுரம்
Karukku|Bama|1992|Karukku|கருக்கு
Sangati|Bama|1994|Sangati|சங்கதி
Koveru Kazhuthaigal|Imayam|1994|Koveru Kazhuthaigal|கோவேறு கழுதைகள்
Chellatha Panam|Imayam|2018|Chellatha Panam|செல்லாத பணம்
Koogai|Cho. Dharman|2005|Koogai|கூகை
Sool|Cho. Dharman|2016|Sool (novel)|சூல்
Aazhi Soozh Ulagu|Joe D'Cruz|2004|Aazhi Soozh Ulagu|ஆழி சூழ் உலகு
Korkai|Joe D'Cruz|2009|Korkai (novel)|கொற்கை
Saivu Narkali|Thoppil Mohamed Meeran|1995|Saivu Narkali|சாய்வு நாற்காலி
Kaaval Kottam|Su. Venkatesan|2008|Kaaval Kottam|காவல் கோட்டம்
Velpari|Su. Venkatesan|2018|Veera Yuga Nayagan Velpari|வீரயுக நாயகன் வேள்பாரி
Vishnupuram|Jeyamohan|1997|Vishnupuram (novel)|விஷ்ணுபுரம்
Rubber|Jeyamohan|1990|Rubber (novel)|ரப்பர்
Kaadu|Jeyamohan|2003|Kaadu (novel)|காடு
Venmurasu|Jeyamohan|2014|Venmurasu|வெண்முரசு
Aram|Jeyamohan|2011|Aram (short story collection)|அறம்
Madhorubagan|Perumal Murugan|2010|One Part Woman|மாதொருபாகன்
Pookkuzhi|Perumal Murugan|2013|Pyre (novel)|பூக்குழி
Poonachi|Perumal Murugan|2016|Poonachi|பூனாச்சி
Koolamaadhari|Perumal Murugan|2000|Seasons of the Palm|கூளமாதாரி
Upa Pandavam|S. Ramakrishnan|2000|Upa Pandavam|உப பாண்டவம்
Sancharam|S. Ramakrishnan|2014|Sancharam (novel)|சஞ்சாரம்
Irumbu Kuthiraigal|Balakumaran|1985|Irumbu Kuthiraigal|இரும்புக் குதிரைகள்
Udaiyar|Balakumaran|2006|Udaiyar (novel)|உடையார்
En Iniya Iyanthira|Sujatha|1987|En Iniya Iyanthira|என் இனிய இயந்திரா
Karaiyellam Shenbagapoo|Sujatha|1978|Karaiyellam Shenbagapoo|கரையெல்லாம் செண்பகப்பூ
Nylon Kayiru|Sujatha|1968|Nylon Kayiru|நைலான் கயிறு
Kanavu Thozhirsalai|Sujatha|1978|Kanavu Thozhirsalai|கனவுத் தொழிற்சாலை
Sri Rangathu Devathaigal|Sujatha|1990|Srirangathu Devathaigal|ஸ்ரீரங்கத்து தேவதைகள்
Karisal|Poomani|1980|Karisal (novel)|கரிசல்
Vekkai|Poomani|1982|Vekkai|வெக்கை
Koonthal Nagaram|Salma|2004|The Hour Past Midnight|இரண்டாம் ஜாமங்களின் கதை
Kallikattu Ithikasam|Vairamuthu|2003|Kallikattu Ithikasam|கள்ளிக்காட்டு இதிகாசம்
Karuvachi Kaaviyam|Vairamuthu|2006|Karuvachi Kaaviyam|கருவாச்சி காவியம்
Moondram Ulaga Por|Vairamuthu|2013|Moondram Ulaga Por|மூன்றாம் உலகப் போர்
Yavana Rani|Sandilyan|1960|Yavana Rani|யவன ராணி
Kadal Pura|Sandilyan|1967|Kadal Pura|கடல் புறா
Rajathilagam|Sandilyan|1960|Raja Thilagam (novel)|ராஜ திலகம்
Manipallavam|Na. Parthasarathy|1957|Manipallavam|மணிபல்லவம்
Thillana Mohanambal|Kothamangalam Subbu|1958|Thillana Mohanambal (novel)|தில்லானா மோகனாம்பாள்
Washingtonil Thirumanam|Savi|1963|Washingtonil Thirumanam|வாஷிங்டனில் திருமணம்
`;
