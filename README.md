# Stack Attack

**Current version:** `0.1.17`

**Stack Attack** stila 2D spēle pārlūkā. Cilvēciņš stumj kastes, telferis tās met no augšas visā laukuma platumā, un pilna apakšējā rinda pazūd ar +1 punktu.

Iedvesma: [Stack Project uz itch.io](https://masterpiet98.itch.io/stack-project) un oriģinālā Siemens spēle.

## Palaist

```bash
cp env.example .env.local
npm install
npm run dev
```

Ievadi `SUPABASE_URL` un `SUPABASE_ANON_KEY` failā `.env.local` (tie paši nosaukumi Vercel Environment Variables). Atver [http://localhost:3177](http://localhost:3177).

Pirms spēles jābūt Google kontam. Pēc ielogošanās lietotājvārdu, šodienas un kopējo spēļu skaitu redz **Settings** (zobrats zem skaņas pogas). **Scores** atver top 20 (All vai sava valsts): 1. zelts, 2. sudrabs, 3. bronza.

## Vadība

| Taustiņš | Darbība |
|---|---|
| `←` `→` | Iet un stumt kasti (datorā) |
| `←`/`→` + `Space` | Lēciens uz priekšu, uz kastes vai no tās (datorā) |
| Džoistiks | Iet un stumt pa kreisi/pa labi (telefonā) |
| Poga **Jump** | Lēciens uz vietas; kopā ar džoistiku - uz priekšu (telefonā) |
| `Esc` / **Pause** | Pauze |
| Skaņas poga | Ieslēdz / izslēdz skaņu (zem telferu punktiem) |
| Zobrats | Settings: šodienas/kopējās spēles un lietotājvārds |

## Spēles noteikumi

- Telferi brauc pa sliedi visā ekrāna platumā (ar vairākiem - arī abos virzienos) un randomā nomet kastes. Ja nav vietas, telferis riņķo šurpu turpu, līdz nomet; pēc nomešanas tukšais telferis aizbrauc divreiz ātrāk.
- Spēles lauks ir **6×10**; septīto rindu ved tikai telferis.
- Kastes krīt, līdz atduras pret grīdu vai citu kasti. Vienā kolonnā vienlaikus krīt tikai viena kaste - nākamā sāk krist tikai pēc nosēšanās.
- Cilvēciņu var saspiest krītoša kaste - tad spēle beidzas.
- Kad apakšējā rinda ir pilna, tā pazūd uzreiz, spēle neapstājas, kastes virs tās krīt uz leju pa vienai katrā kolonnā, un tiek pieskaitīts **1 punkts**.
- Ar punktiem parādās līdz **4 telferiem**, un nomešana kļūst ātrāka.
- Aiz logiem ik pa laikam peld balti, gubaini mākoņi dažādos izmēros. Gariem starplaikiem var uznākt negaiss ar tumsu un lietu.
- Ja šajā spēlē pārspēj savu rekordu, aiz logiem paliek sarkans saulriets (saule pa pusei pie apakšas) līdz spēles beigām.
- Ja pārspēj visaugstāko rekordu visiem spēlētājiem, aiz logiem paliek nakts un visu laiku šauj salūts.
- Scores sarakstā zem vārda rādās valsts (no IP). Reti pa logiem palido lidmašīna ar līdera vārdu un punktiem.

## Komandas

```bash
npm run typecheck
npm run build
npm run db:migrate
npm run audit:check
```
