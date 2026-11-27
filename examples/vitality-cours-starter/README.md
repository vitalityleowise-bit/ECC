# Kit VITALITY COURS — Tutè Lang ak IA

Kit sa a prepare Claude Code pou l bati **VITALITY COURS**: yon app kote yon tutè IA
koute sa w di, korije gramè w ak pwononsyasyon w, epi reponn ou ak vwa, nan plizyè
stil konvèsasyon (debutan jiska pwofesyonèl, travay/biznis, vwayaj, antrevi).

| Fichye | Sa l fè |
|---|---|
| `skills.txt` | Lis 25 skills ki pi bon pou yon app tutè vwa ak IA |
| `install-skills.js` | Script ki enstale skills yo otomatikman |
| `CLAUDE.md` | Règ ak desizyon teknik Claude dwe swiv (vwa, IA, pwononsyasyon, sekirite) |

## Sa w bezwen anvan

1. [Node.js](https://nodejs.org) 18+, [Git](https://git-scm.com), Claude Code
2. Pou bati app Flutter la pita: [Flutter SDK](https://docs.flutter.dev/get-started/install)

## Etap 1: Telechaje kit la

```bash
git clone https://github.com/affaan-m/ECC.git ecc
cd ecc
```

## Etap 2: Enstale skills yo

Pou yon sèl pwojè (ranplase chemen an pa dosye pwojè w la):

```bash
node examples/vitality-cours-starter/install-skills.js --project ../vitality-cours
```

Pou tout pwojè w yo: retire `--project ...`. Ajoute `--dry-run` pou wè sa l ap fè anvan.

## Etap 3: Mete règ yo nan pwojè w la

```bash
mkdir -p ../vitality-cours
cp examples/vitality-cours-starter/CLAUDE.md ../vitality-cours/
```

## Etap 4: Kòmanse

Louvri Claude Code nan dosye pwojè a, epi ekri:

> Li CLAUDE.md la. Sèvi ak skill `blueprint` pou fè yon plan VITALITY COURS.
> Eksplike m plan an an kreyòl, epi tann mwen di wi anvan w kòmanse.

## Skills yo (25) epi poukisa

- **Plan:** `blueprint`, `product-capability`, `search-first`
- **App Flutter:** `dart-flutter-patterns`, `flutter-dart-code-review`, `design-system`, `accessibility`, `i18n-sync`
- **Sèvo IA a:** `cost-aware-llm-pipeline` (chwazi ki IA pou chak travay), `prompt-optimizer`, `prompt-caching-strategy`, `eval-harness`
- **Vwa an tan reyèl:** `latency-critical-systems`
- **Backend ak sèvis:** `backend-patterns`, `api-design`, `mcp-server-patterns`, `error-handling`
- **Kalite ak sekirite:** `tdd-workflow`, `verification-loop`, `coding-standards`, `security-review`, `production-audit`
- **Livrezon:** `deployment-patterns`, `git-workflow`, `strategic-compact`

## Desizyon teknik ki enpòtan (nan CLAUDE.md)

- **"Plizyè IA"** = yon *routeur*: yon ti IA rapid pou korije vit, yon IA pi fò pou konvèsasyon ak fidbak.
- **Vwa rapid** = streaming: STT, IA, ak TTS voye ti moso pa ti moso pou repons lan kòmanse anvan fraz la fini.
- **Nòt pwononsyasyon** soti nan yon API espesyalize, pa envante pa IA a.
- **Tout kle API rete sou yon sèvè**, janmen andedan app la — sinon nenpòt moun ka vòlè yo nan APK a.
