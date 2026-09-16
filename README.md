# Stack Attack

**Current version:** `0.1.2`

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
| `Space` | Lekt uz kastes (datorā) |
| Džoistiks | Iet un stumt pa kreisi/pa labi (telefonā) |
| Poga **Lekt** | Lēciens (telefonā) |
| `Esc` | Pauze |

## Spēles noteikumi

- Telferis braukā pa sliedi un randomā nomet kasti visā platumā.
- Kastes krīt, līdz atduras pret grīdu vai citu kasti.
- Cilvēciņu var saspiest krītoša kaste - tad spēle beidzas.
- Kad apakšējā rinda ir pilna, tā sprāgst, kastes virs tās krīt uz leju, un tiek pieskaitīts **1 punkts**.
- Ar punktiem parādās līdz **5 telferiem**, un nomešana kļūst ātrāka.

## Komandas

```bash
npm run typecheck
npm run build
```
