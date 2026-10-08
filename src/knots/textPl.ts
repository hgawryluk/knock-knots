import type { KnotType, SectionId } from './types';

/**
 * Polish text for the knots: names, descriptions and step-by-step
 * instructions (title, hint), by knot id. English lives in levels.ts.
 */
export const PL_KNOTS: Record<string, { name: string; summary: string; steps?: [string, string][] }> = {
  overhand: {
    name: 'Węzeł prosty',
    summary: 'Najprostszy węzeł i podstawa wielu innych. Nie pozwala końcowi liny się wysunąć.',
    steps: [
      ['Zrób pętlę', 'Przeciągnij niebieski koniec w lewo i do góry, krzyżując go nad liną.'],
      ['Dookoła z tyłu', 'Poprowadź koniec wokół prawej strony i za liną.'],
      ['Przez pętlę', 'Przełóż koniec do przodu przez pętlę i pozwól mu zwisnąć.'],
    ],
  },
  'figure-eight': {
    name: 'Ósemka',
    summary: 'Grubszy i pewniejszy węzeł blokujący, łatwiejszy do rozwiązania. Podstawa wiązania się wspinacza.',
    steps: [
      ['Zrób pętlę', 'Poprowadź niebieski koniec tak, by utworzyć pętlę, krzyżując linę.'],
      ['Wokół liny', 'Owiń koniec raz wokół liny nad pętlą.'],
      ['W dół przez pętlę', 'Na koniec przełóż koniec z powrotem przez pierwszą pętlę. Powinna powstać ósemka.'],
    ],
  },
  'square-knot': {
    name: 'Węzeł płaski',
    summary: 'Wiąże dwa końce wokół tobołka. Nigdy nie łącz nim lin, które przenoszą obciążenie.',
    steps: [
      ['Zrób ucho', 'Poprowadź niebieski koniec w prawo i zawróć go, składając w kształt litery U.'],
      ['Wokół tobołka', 'Sprowadź koniec w dół i dookoła w pętlę, jakby wokół tobołka, i z powrotem w górę po prawej stronie.'],
      ['W górę przez ucho', 'Wyprowadź koniec w górę pod łukiem ucha i nad jego dolną nitką.'],
      ['Dookoła z tyłu', 'Poprowadź koniec za obiema nitkami ucha.'],
      ['Z powrotem obok siebie', 'Przejdź nad górną nitką i wyjdź pod łukiem, tuż obok miejsca wejścia.'],
    ],
  },
  'overhand-noose': {
    name: 'Prosta pętla zaciskowa',
    summary: 'Pętla przesuwna, która zaciska się, gdy pociągniesz linę.',
    steps: [
      ['Wokół liny', 'Poprowadź niebieski koniec w górę, za liną, wokół jej lewej strony i z przodu nad samym sobą.'],
      ['Dookoła z tyłu', 'Wyprowadź koniec w prawo i dookoła z tyłu, do świeżo zrobionej pętli.'],
      ['Przez pętlę', 'Przełóż koniec do przodu przez pętlę i wyprowadź go nad jej górą.'],
    ],
  },
  'clove-hitch': {
    name: 'Wyblinka',
    summary: 'Szybki, regulowany węzeł do mocowania liny do drąga, słupka lub poręczy.',
    steps: [
      ['Wokół drąga', 'Poprowadź niebieski koniec w dół przed drągiem, pod nim, w górę z tyłu i nad wierzchem.'],
      ['Na krzyż i jeszcze raz', 'Zejdź z przodu w poprzek liny, a potem owiń drąg ponownie obok pierwszego zwoju.'],
      ['Pod skrzyżowanie', 'Przełóż koniec przez wierzch i w dół pod ukośną nitkę, tak żeby go przytrzymała.'],
    ],
  },
  'round-turn-two-half-hitches': {
    name: 'Pełny obrót z dwoma półsztykami',
    summary: 'Mocne, łatwe do rozwiązania zamocowanie do słupka, kółka lub kłody.',
    steps: [
      ['Pełny obrót', 'Owiń niebieski koniec wokół drąga półtora raza, wychodząc z przodu do góry.'],
      ['Pierwszy półsztyk', 'Poprowadź koniec przed liną nad drągiem, za nią i wsuń go pod siebie.'],
      ['Drugi półsztyk', 'Powtórz to tuż wyżej, w tę samą stronę.'],
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
  'figure-eight-follow-through': { name: 'Ósemka prowadzona', summary: 'Wiązanie się wspinacza: ósemka przewleczona przez uprząż.' },
  'munter-hitch': { name: 'Półwyblinka', summary: 'Asekuracja lub opuszczanie partnera przy użyciu samego karabinka i tarcia.' },
};

export const PL_SECTIONS: Record<SectionId, { name: string; blurb: string }> = {
  survival: { name: 'Survival', blurb: 'Węzły na biwak, do schronienia i na co dzień w terenie.' },
  mountains: { name: 'Góry', blurb: 'Węzły wspinaczkowe: do wiązania się, asekuracji i zjazdu.' },
};

export const PL_TYPES: Record<KnotType, string> = {
  Stopper: 'Blokujący',
  Loop: 'Pętla',
  Hitch: 'Zaczepowy',
  Bend: 'Łączący',
  Binding: 'Wiążący',
};
