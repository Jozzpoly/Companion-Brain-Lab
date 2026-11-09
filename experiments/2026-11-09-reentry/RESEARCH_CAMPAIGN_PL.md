# Companion Brain Lab — kampania odnalezionego celu, 9 XI 2026

**Status:** odrębne, eksperymentalne rozpoznanie GPT-6; NIE design zatwierdzony przez Ownera; NIE nowa architektura, decyzja Opusa/Astry, ani Owner PASS. Zapis na izolowanej gałęzi CBL `experiment/gpt6-companion-live-cover-2026-11-07` (następca PR #65; draft PR #66); `main`, Jaskinia, Commons i bieżące wdrożenia bez zmian.

## 1. Co się zmieniło od 7 listopada

Owner wskazał gruntowną przebudowę **działającej starej Jaskini** jako najważniejszy kierunek: świeże dane/GitHub, Cloudflare, architektura pozwalająca wielokrotnie i chaotycznie przebudowywać całe środowisko, trwałość i większa niezależność od dostawców. Duże, profesjonalne edytory autorskie powinny być **drugim etapem samej Jaskini**, lecz **pozostałe laboratoria mogą już teraz niezależnie eksperymentować z różnymi formami twórczej sprawczości**, żeby ich doświadczenia realnie ukształtowały fundament. Opusowie/Astra prowadzą ich wspólną stronę; nasza linia **nie czeka na Opusów i nie projektuje konkurencyjnego Domu**.

**Ważne:** decyzja o przebudowie starej Jaskini nie przesądza ostatecznie kodowego repo, hosta i migracji. Nowe `Jozzpoly/Jaskinia/main` jest nadal głównie szkieletem/próbami, a stara v6.4.1 ma rzeczywistą powłokę z używaną przestrzenią roboczą. Rozwiązania Cloudflare, trwałości prywatnych danych, originów, dostępu i środowisk preview wymagają osobnych dowodów; nie stają się przedmiotem implementacji Companion Lab.

## 2. Nasza wyjątkowa hipoteza: *wzajemna sprawczość jako tworzywo*

Inne laboratoria już badają realną fizyczną materię (Combat), semantykę lokacji i szerokość warsztatu (Coopege), materialne życie/prywatne doświadczenia (ReflexBrain), ekspresję przez gest i animację (Żywe Ślady / Asset Lab) i ciągłość autorskich światów (Feniks). **Companion może badać coś specyficznego:** autor i gracz potrafią wpływać na **zobowiązania, priorytety, niepewność oraz samodzielną inicjatywę** innej uczestniczącej postaci, bez zamieniania jej w marionetkę.

Pytanie kierunkowe: *czy mogę samodzielnie ukształtować sposób współpracy C1 — włącznie z granicami jego inicjatywy — i potem podczas nieprzewidzianej zabawy doświadczać rzeczywistej pomocy, przeszkadzania, negocjacji i korekty, bez proszenia AI-programisty o dopisanie nowej funkcji?*

**To są dwa różne produkty, które muszą spotkać się w jednym doświadczeniu:**
- **Rozkazy gracza** (krótka komenda w grze, niskie tarcie: „pilnuj”, „nie atakuj”, „idź ze mną”, „daj mi przejść”), realizowane w jej prawach, nie w debug panelu.
- **Autorski warsztat** (poza rolą zwykłego gracza): zmienianie możliwych interpretacji, zasad zgody, odpowiedzialności, preferencji i rzeczywistych zdolności C1; pokazanie przykładów i kontrprzykładów; obserwowanie konsekwencji. Docelowo naturalne panele/okna Jaskini, lecz własność docelowego compositor/API leży po stronie Opusa/Astry.

Doraźne buttony F1–F3 / C nie stanowią zatwierdzonego języka relacji; same suwaki agresji, rasa/class/behavior tree ani statyczne „jeśli wróg w promieniu 3m → uderz” nie tworzą takiej możliwości.

## 3. Trzy podejścia do zbadania — nie zamrażać zwycięzcy

| Kierunek | Korzyść | Ryzyko / powód sprzeciwu |
| --- | --- | --- |
| A. Parametry i reguły w HUD | Szybki, przewidywalny prototyp, jasne granice zachowania | Najłatwiej powtórzyć F2 i Cover: tylko zestaw z góry dozwolonych akcji, nie głęboka sprawczość twórcy |
| B. Pokazanie przykładu / demonstracja | Twórca działa bez programowania; forma bliska intuicji | Jedno zachowanie nie mówi, *dlaczego* je pokazano. Automatyczna inferencja jest łatwa do sfabrykowania i może odebrać kontrolę |
| C. **Sytuacyjne zobowiązania + przykłady i kontrprzykłady** | C1 ma jawny ograniczony cel, może sam wybierać działania; twórca może korygować sens decyzji; rozdzielone percepcja/polityka/konsekwencja | Najwyższa trudność: czytelność intencji bez jej zaprogramowania przez twórcę, ciągłość przy zmianach świata, nietrafne działania |

**Nasza robocza rekomendacja:** badać C jako główną hipotezę, z B jako rywalem/kontrpróbą. Z A zachować jedynie przejrzystość, testowalność i możliwość manualnego porównania. To rekomendacja agenta, NIE wybór Ownera ani specyfikacja do automatycznego wdrożenia.

## 4. Jedno mocne doświadczenie, zamiast dziesięciu „zielonych sytuacji”

**Tymczasowy eksperyment-kandydat:** jedna mała przestrzeń fizyczna, gracz, C1, przeszkoda/przejście, wspólne zagrożenie i co najmniej dwie możliwe taktyki. Gracz może:
1. Poinstruować C1, np. „osłaniaj mnie, ale nie rozpoczynaj walki”.
2. Sam zmienić zamiar, kierunek ruchu albo stan przejścia/otoczenia bez restartu całego świata.
3. Zaobserwować *inicjatywę* C1 wraz z jego ograniczoną wiedzą (może się mylić, lecz powinien zachować sens zobowiązania).
4. Zatrzymać, skorygować lub przejąć działanie natychmiast; bez niejawnej utraty kontroli.
5. Zmienić jedną cechę/interpretację w warsztacie, wrócić do **tego samego** doświadczenia i porównać skutki.
6. Otworzyć później zapis/dowód bez przedstawiania migawki UI jako rehydratacji świata.

**Ważna krytyka:** nie należy najpierw implementować całego materialnego gameplayu czy „AI rozumiejącego język naturalny”. Możemy użyć niewielkiego, prawdziwego materiałowego mechanizmu z istniejącego World/Combat; w CBL zmiana situation/layout **odtwarza `LabWorld.createFromSpec()` i niszczy poprzedni świat**, więc to nie jest dziś spełnione. Prawdziwa praca może wymagać złamania starej konstrukcji Scene / World, a nie dołożenia opcji do Cover. Jeśli materiałowe rzeczy zbyt mocno pochłoną badanie relacji, odłożyć je jako test drugiego etapu; nie fałszować ich przez zmianę samego sprite'a.

**Minimum dla udanego autorskiego eksperymentu:** Owner może zbudować własny, nieprzewidziany przez nas wariant celu/ograniczenia i sprawdzić jego skutki w grze **bez nowego kodu agenta**. Jedna przyciskowa winietka z poprawnym ciosiem NIE spełnia tego kryterium.

## 5. Falsyfikatory ważniejsze od liczby funkcji

1. **Pomoc niechciana:** C1 zadaje skuteczny cios, choć Owner chciał sam rozwiązać spotkanie. Czy można to wcześniej określić lub skorygować? Sukces fizyczny może być porażką współpracy.
2. **Wiedza prywatna:** polityka C1 widzi tylko to, co mógł postrzec/otrzymać; operator debug może oglądać pełne dane osobno. Nasz obecny Cover czyta pełne `WorldSnapshot` i `CombatMicroSnapshot.phase/targetActorId` — to obserwacja niemal wyroczni, nie lokalna percepcja.
3. **Kontrolowany kontrfaktyczny przebieg:** identyczny start, ten sam czas świata i input gracza, różna polityka C1; osobne ludzkie/manualne A/B. Poprzednia browser próba kończyła się na **różnych zdarzeniach** (pierwszy hit vs pierwszy cios), a więc nie stanowi dowodu długotrwałej przewagi. Zmiana celu przeciwnika na C1 **nie dowodzi poniesionej szkody** (C1 miał wtedy 0 hitów).
4. **Wzajemna reakcja:** czy pomoc zmienia późniejszą decyzję gracza, a korekta gracza realnie zmienia przyszłe zachowanie C1, zamiast wywoływać jedną predefiniowaną animację?
5. **Zmiana świata:** czy C1 zachowuje odpowiednio zobowiązanie, przestaje je realizować lub pyta, kiedy wejście zostaje zamknięte/przesunięte? Nowy świat nie może po cichu dziedziczyć starego poznania i równocześnie udawać ciągłości.
6. **Lifecycles:** `World instance ≠ active simulation clock ≠ window/frame ≠ saved project ≠ replay`. Combat 9 XI skorygował wcześniejsze błędne wnioskowanie o ukrytym czasie przez bezpośrednie odczyty z Rapiera. Test Companiona musi rozróżniać świadomy PAUSE, ukrycie, odmontowanie widoku, pełny reload i pozostający dostęp do stanu. Nigdy nie obiecywać pracy NPC w tle, gdy fizyka stoi.
7. **Użyteczność i ergonomia:** naturalne pole/bezpośredni gest, natychmiastowy feedback, undo o semantyce czynności, miejsce na ekranie, fokus klawiatury/pointera, małe okno i smartfon. Nie pozwolić, by właściciel musiał zarządzać technicznymi koordynatami lub zmieniać parametry w kilku oddzielnych programach.
8. **Bezpieczeństwo:** źródło akcji i granice autorytetu: `Owner edits world / Owner issues command / C1 acts as actor / lab agent proposes code` nie mogą zlać się w jedno. Nie dawać iframe lub agentowi dostępu do prywatnego Jaskinia storage, tokenów, render-only artefaktów jako prawdy świata ani globalnych uprawnień do materii.

## 6. Przypadki nacisku dla fundamentu Opusa/Astry, ale bez projektowania Jaskini w tym labie

- Ten sam świat i C1 przetrwają **zmianę układu okien** bez kasowania intencji lub wstrzymywania symulacji bez komunikatu. Wiele widoków ≠ wiele światów.
- Działająca sesja, autorska definicja C1, zapis/rewizja i raport obserwacji mają różne tożsamości i cykle życia; ich status jest widoczny, nie dorozumiany z URL.
- Edycja intencji lub otoczenia podlega prawdziwym regułom, jest odwracalna tam, gdzie obiecano, i nie dostaje uprawnień tylko dlatego, że pochodzi z okna Jaskini. Operator może zmieniać powłokę, ale nie bez prawa sterować sim.
- Agent z innego modelu/dostawcy potrafi odzyskać *pytanie, wersję źródła, obiekty i obserwowany wynik*, a nie tylko „zielony PR”.
- Publiczny eksperyment nie ujawnia prywatnych uwag Ownera. Cloudflare i repo Jaskinia nie są zadaniem naszej implementacji.

Te wymagania są **zewnętrznymi przypadkami obciążeniowymi**, nie postulatem uniwersalnego schematu. Warto je przekazywać wtedy, gdy staną się testowalnym dowodem, nie tylko elegancką listą.

## 7. Status naszych istniejących materiałów i przygotowanie stanowiska

- `main`: źródłowa prawda kanoniczna CBL według `docs/CURRENT.md`, którego ostatnia autorstwo jest z końca września; dwa listopadowe eksperymenty nie były scalone.
- [PR #65](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/65): transport rzeczywistych faktów do starej Jaskini, notatka przy rzeczywistym tick, world-first viewport — bounded Chrome PASS.
- [PR #66](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/66): `Cover` jako konkretne działanie w prawdziwym `stepSituation`; globalna wiedza, jeden scenariusz, nie general intelligence; Owner nie zatwierdził.
- [9 XI przegląd innych agentów](https://github.com/Jozzpoly/Jozz-Commons/blob/main/STAN.md) zmienia priorytety, nie wypycha naszej linii na ścieżkę implementacji infrastruktury.
- `preview/gpt6-companion-live-cover-2026-11-07` zachowuje dokładny stary skompilowany specimen (nie aktualny pełny produkt). Nowy preview wymaga jawnej decyzji i testów; nie publikować samego Source SHA jako grywalnego URL.
- Zachować PR #65/#66 jako izolowanych donorów i możliwość porzucenia. Nie tworzyć „Companion Studio” na tym samym UI tylko dlatego, że już istnieją przyciski.
- **9 XI, porządek wykonawczy:** kosztowny real-browser workflow w **tej konkretnej eksperymentalnej gałęzi** został zawężony do `push` z filtrem plików kodu (GitHub porównuje zmiany w pojedynczym pushu). Wcześniejszy filtr `pull_request` widział *całą* różnicę względem gałęzi bazowej i uruchamiał Chrome także po aktualizacjach samych notatek. `validate` na PR pozostaje. Obok znajduje się odizolowany build podglądu, nadal wymagający jawnej prośby. Przed uznaniem poprawki procesu za potwierdzoną sprawdzić rzeczywiste wydarzenie Actions po samym commicie dokumentacji.

**Następny uzasadniony ruch:** nie implementować jeszcze nowego menu, uniwersalnego modelu NPC czy osobnej kopii Jaskini. Rozstrzygnąć w pierwszej małej, lecz wartościowej próbce, czy podejście C daje twórcy naprawdę większą swobodę niż A i B; zbudować ją dopiero wokół faktycznej pętli zabawy i korekty, z prawem do odrzucenia całego `Cover`. Rozplanować repo-native odrębną gałąź tylko wtedy, gdy wybrany test wymaga implementacji. Zanim uznamy cokolwiek za „ukończone”, test musi objąć nie tylko działanie World, ale możliwość stworzenia **nieprzewidzianego** wariantu przez samego Ownera.
