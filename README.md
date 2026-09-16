# Stack Attack

**Current version:** `0.1.8`

**Stack Attack** stila 2D spēle pārlūkā. Cilvēciņš stumj kastes, telferis tās met no augšas visā laukuma platumā, un pilna apakšējā rinda pazūd ar +1 punktu.

Iedvesma: [Stack Project uz itch.io](https://masterpiet98.itch.io/stack-project) un oriģinālā Siemens spēle.

## Palaist

```bash
npm install
npm run dev
```

Atver [http://localhost:3177](http://localhost:3177).

## Vadība

| Taustiņš | Darbība |
|---|---|
| `←` `→` | Iet un stumt kasti (datorā) |
| `←`/`→` + `Space` | Lēciens uz priekšu, uz kastes vai no tās (datorā) |
| Džoistiks | Iet un stumt pa kreisi/pa labi (telefonā) |
| Poga **Jump** | Lēciens uz vietas; kopā ar džoistiku - uz priekšu (telefonā) |
| `Esc` | Pauze |

## Spēles noteikumi

- Telferi brauc pa sliedi visā ekrāna platumā (ar vairākiem - arī abos virzienos) un randomā nomet kastes. Pēc nomešanas tukšais telferis aizbrauc divreiz ātrāk.
- Kastes krīt, līdz atduras pret grīdu vai citu kasti.
- Cilvēciņu var saspiest krītoša kaste - tad spēle beidzas.
- Kad apakšējā rinda ir pilna, tā pazūd uzreiz, spēle neapstājas, kastes virs tās krīt uz leju, un tiek pieskaitīts **1 punkts**.
- Ar punktiem parādās līdz **5 telferiem**, un nomešana kļūst ātrāka.
- Aiz logiem ik pa laikam peld balti, gubaini mākoņi dažādos izmēros.
- Ja šajā spēlē pārspēj rekordu, aiz logiem parādās sarkans saulriets.

## Komandas

```bash
npm run typecheck
npm run build
```
