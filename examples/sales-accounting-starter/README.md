# Kit Sistèm Vant ak Kontablite

Kit sa a prepare Claude Code pou l bati yon sistèm vant ak kontablite ki gen bon kalite,
menm si ou pa konn kode. Li gen 3 bagay:

| Fichye | Sa l fè |
|---|---|
| `skills.txt` | Lis 27 skills ki pi bon pou yon sistèm vant ak kontablite |
| `install-skills.js` | Script ki enstale skills yo pou ou otomatikman |
| `CLAUDE.md` | Règ Claude dwe swiv pou pwojè w la (kòb, kontablite, sekirite, tès) |

## Sa w bezwen anvan

1. [Node.js](https://nodejs.org) vèsyon 18 oswa plis
2. [Git](https://git-scm.com)
3. Claude Code

## Etap 1: Telechaje kit la

Louvri Terminal (Mac/Linux) oswa PowerShell (Windows), epi tape:

```bash
git clone https://github.com/affaan-m/ECC.git ecc
cd ecc
```

## Etap 2: Enstale skills yo

Pou tout pwojè w yo:

```bash
node examples/sales-accounting-starter/install-skills.js
```

Pou yon sèl pwojè (ranplase chemen an pa dosye pwojè w la):

```bash
node examples/sales-accounting-starter/install-skills.js --project ../sistem-vant
```

Si w vle wè sa l ap fè anvan l chanje anyen, ajoute `--dry-run`.

## Etap 3: Mete règ yo nan pwojè w la

Kopye `CLAUDE.md` la nan dosye pwojè w la:

```bash
mkdir -p ../sistem-vant
cp examples/sales-accounting-starter/CLAUDE.md ../sistem-vant/
```

## Etap 4: Kòmanse travay la

Louvri Claude Code nan dosye pwojè a, epi ekri premye mesaj sa a:

> Li CLAUDE.md la. Sèvi ak skill `blueprint` pou fè yon plan pou sistèm vant ak kontablite mwen an.
> Eksplike m plan an an kreyòl, epi tann mwen di wi anvan w kòmanse.

## Sa skills yo fè

- **Planifikasyon:** `blueprint`, `product-capability`, `orch-build-mvp`, `search-first`
- **Kalite ak sekirite:** `tdd-workflow`, `verification-loop`, `coding-standards`, `security-review`, `error-handling`, `production-audit`
- **Baz done:** `postgres-patterns`, `database-migrations`, `prisma-patterns`
- **Backend:** `backend-patterns`, `api-design`
- **Ekran yo:** `frontend-patterns`, `react-patterns`, `typescript-patterns`, `design-system`, `accessibility`, `e2e-testing`
- **Biznis:** `inventory-demand-planning` (stock), `finance-billing-ops` (vant ak peman), `i18n-sync` (kreyòl, franse, angle)
- **Livrezon:** `deployment-patterns`, `git-workflow`, `strategic-compact`

## Règ kontablite ki nan CLAUDE.md

- Kòb toujou anrejistre an santim pou kalkil yo pa gen erè
- Chak tranzaksyon gen debi ak kredi ki egal (double-entry)
- Pa gen anyen ki efase: yon koreksyon se yon nouvo ekriti
- Chak aksyon gen non moun ki fè l ak lè li fè l
- Nimewo fakti yo swiv youn apre lòt, san twou
