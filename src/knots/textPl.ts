import type { KnotType, SectionId } from './types';

/**
 * Polish text for the knots: names, descriptions and step-by-step
 * instructions (title, hint), by knot id. English lives in levels.ts.
 */
export const PL_KNOTS: Record<string, { name: string; summary: string; steps?: [string, string][] }> = {
  overhand: {
    name: 'Węzeł prosty',
    summary: 'Najprostszy węzeł i początek wielu innych. Nie pozwala końcowi liny się wysunąć.',
    steps: [
      ['Zrób pętlę', 'Poprowadź niebieski koniec w lewo i nad liną.'],
      ['Pod liną', 'Obejdź prawą stronę i przełóż koniec pod liną.'],
      ['Przez pętlę', 'Wyciągnij koniec do góry przez pętlę i pociągnij do siebie.'],
    ],
  },
  'figure-eight': {
    name: 'Ósemka',
    summary: 'Grubszy i pewniejszy węzeł blokujący, łatwiejszy do rozwiązania. Podstawa wiązania się wspinacza.',
    steps: [
      ['Zrób pętlę', 'Poprowadź niebieski koniec w lewo i nad liną.'],
      ['Wokół liny', 'Owiń koniec raz wokół liny, tuż nad pętlą.'],
      ['Przez pierwszą pętlę', 'Przełóż koniec przez pierwszą pętlę i pociągnij do siebie. Widać ósemkę.'],
    ],
  },
  'square-knot': {
    name: 'Węzeł płaski',
    summary: 'Wiąże dwa końce wokół tobołka. Nigdy nie łącz nim lin, które przenoszą obciążenie.',
    steps: [
      ['Do haka', 'Poprowadź niebieski koniec pod górą czerwonego haka, przez środek i nad jego prawą nogą.'],
      ['Pod hakiem', 'Przełóż koniec pod obiema nogami haka.'],
      ['Obok siebie', 'Wyjdź nad lewą nogą i pod górą haka, tuż obok miejsca wejścia.'],
    ],
  },
  'overhand-noose': {
    name: 'Prosta pętla zaciskowa',
    summary: 'Pętla przesuwna, która zaciska się, gdy pociągniesz linę.',
    steps: [
      ['Wokół liny', 'Poprowadź niebieski koniec w górę, pod liną, wokół jej lewej strony i z powrotem nad sobą.'],
      ['Pod spodem', 'Przesuń koniec w prawo i pod spodem, do nowej pętli.'],
      ['Przez pętlę', 'Wyciągnij koniec do góry przez pętlę i wyprowadź nad jej górą.'],
    ],
  },
  'clove-hitch': {
    name: 'Wyblinka',
    summary: 'Szybki, regulowany węzeł do mocowania liny do drąga, słupka lub poręczy.',
    steps: [
      ['Wokół drąga', 'Poprowadź niebieski koniec w dół z przodu, pod drągiem, w górę z tyłu i przez wierzch.'],
      ['Na krzyż i jeszcze raz', 'Zejdź w poprzek liny i owiń drąg drugi raz, obok pierwszego zwoju.'],
      ['Pod skrzyżowanie', 'Przejdź przez wierzch i wsuń koniec pod ukośną nitkę.'],
    ],
  },
  'round-turn-two-half-hitches': {
    name: 'Pełny obrót z dwoma półsztykami',
    summary: 'Mocne, łatwe do rozwiązania zamocowanie do słupka, kółka lub kłody.',
    steps: [
      ['Pełny obrót', 'Owiń niebieski koniec wokół drąga półtora raza, tak by wyszedł z przodu.'],
      ['Pierwszy półsztyk', 'Przełóż koniec przed liną, obejdź ją z tyłu i wsuń pod siebie.'],
      ['Drugi półsztyk', 'Zrób to samo tuż wyżej, w tę samą stronę.'],
    ],
  },
  'figure-eight-loop': { name: 'Pętla ósemkowa', summary: 'Stała pętla na końcu liny, która się nie przesuwa.' },
  bowline: { name: 'Węzeł ratowniczy', summary: 'Stała pętla, która trzyma pod obciążeniem, a potem łatwo się rozwiązuje.' },
  'sheet-bend': { name: 'Węzeł szotowy', summary: 'Łączy dwie liny, nawet gdy jedna jest grubsza od drugiej.' },
  'timber-hitch': { name: 'Węzeł kłodowy', summary: 'Chwyta kłodę, owijając się wokół siebie — do ciągnięcia drewna lub zaczęcia wiązania.' },
  'constrictor-knot': { name: 'Węzeł dławiący', summary: 'Mocno zaciskające się wiązanie — do zamykania worka lub ściągania rzeczy razem.' },
  'anchor-hitch': { name: 'Węzeł kotwiczny', summary: 'Pewny sposób na przywiązanie liny do kółka, kotwicy lub słupka.' },
  'double-fishermans': { name: 'Podwójny węzeł rybacki', summary: 'Na stałe łączy dwie liny podobnej grubości, jak robią wspinacze przy pętlach.' },
  'alpine-butterfly': { name: 'Motyl alpejski', summary: 'Stała pętla w środku liny, którą można obciążać w każdą stronę.' },
  'zeppelin-bend': { name: 'Węzeł zeppelin', summary: 'Łączy dwie liny i daje się łatwo rozwiązać nawet po dużym obciążeniu.' },
  'midshipmans-hitch': { name: 'Węzeł midszypmeński', summary: 'Węzeł zaciskowy, który można przesuwać, by naprężyć napiętą linkę.' },
  'adjustable-grip-hitch': { name: 'Regulowany węzeł zaciskowy', summary: 'Przesuwa się, by wyregulować linkę, a pod obciążeniem trzyma — idealny do odciągów namiotu.' },
  prusik: { name: 'Prusik', summary: 'Pętla owinięta wokół liny, która trzyma pod obciążeniem i przesuwa się, gdy jest luźna.' },
  'truckers-hitch': { name: 'Węzeł woźnicy', summary: 'Wbudowany bloczek, który pozwala mocno napiąć linkę i ją zawiązać.' },
  'autolocking-truckers-hitch': { name: 'Samoblokujący węzeł woźnicy', summary: 'Węzeł woźnicy, który sam trzyma naprężenie, gdy go wiążesz.' },
  'clove-hitch-carabiner': {
    name: 'Wyblinka na karabinku',
    summary: 'Wpina cię do stanowiska. Łatwo ją wyregulować, a pod obciążeniem mocno trzyma.',
    steps: [
      ['Pierwsza pętla', 'Skręć pętlę na linie.'],
      ['Druga pętla', 'Obok skręć drugą pętlę, w tę samą stronę.'],
      ['Prawa za lewą', 'Przesuń prawą pętlę za lewą.'],
      ['Wepnij', 'Odkręć zakrętkę, wciśnij pętlami zamek, aż przejdą do środka, opuść je na karabinek i zakręć zamek.'],
    ],
  },
  'munter-hitch': {
    name: 'Półwyblinka',
    summary: 'Asekuruj lub opuszczaj partnera samym karabinkiem: lina przesuwa się po nim z dużym tarciem.',
    steps: [
      ['Zrób pętlę', 'Chwyć zwisającą nitkę i skręć na niej małą pętlę w prawo.'],
      ['Do zamka', 'Podnieś pętlę do zamka, przy jego nosku na dole po prawej.'],
      ['Wepnij', 'Odkręć zakrętkę, wciśnij pętlą zamek, aż przejdzie do środka, opuść ją na karabinek i zakręć zamek.'],
    ],
  },
  'figure-eight-follow-through': { name: 'Ósemka prowadzona', summary: 'Wiązanie się wspinacza: ósemka przewleczona przez uprząż.' },
};

export const PL_SECTIONS: Record<SectionId, { name: string; blurb: string }> = {
  survival: { name: 'Survival', blurb:
      'Kilka podstawowych węzłów wystarczy do większości zadań na biwaku, nad wodą i w domu: zablokować koniec liny, obwiązać tobołek, zrobić zaciskaną pętlę, przywiązać linę do drąga. Na nich opierają się kolejne węzły.' },
  mountains: { name: 'Góry', blurb: 'Węzły wspinaczkowe: do wiązania się, asekuracji i zjazdu.' },
};

export const PL_TYPES: Record<KnotType, string> = {
  Stopper: 'Blokujący',
  Loop: 'Pętla',
  Hitch: 'Zaczepowy',
  Bend: 'Łączący',
  Binding: 'Wiążący',
};
