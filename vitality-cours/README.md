# VITALITY COURS

App tutè lang ak IA. Yon tutè koute sa w di, korije gramè w ak pwononsyasyon w,
epi reponn ou ak vwa — nan plizyè stil konvèsasyon, soti nan debutan rive
pwofesyonèl.

- **Lang pou aprann:** angle, panyòl, franse
- **Platfòm:** Android
- **App:** Flutter (dosye `app/`)
- **Sèvè:** Node/TypeScript (dosye `backend/`) — li kenbe tout kle API yo an sekirite

## Kote chak bagay ye

| Dosye | Sa l genyen |
|---|---|
| `app/` | App Flutter la (ekran yo, kòd la) |
| `app/assets/personas/personas.json` | Tout stil konvèsasyon yo (done, pa kòd) |
| `app/assets/translations/` | Tèks meni an: kreyòl, franse, angle |
| `backend/` | Sèvè a (li pale ak IA, STT, TTS) |
| `.env.example` | Modèl pou kle yo — kopye l nan `backend/.env` epi mete pwòp kle pa w |
| `CLAUDE.md` | Règ Claude dwe swiv pou bati app la |
| `docs/PLAN.md` | Plan konplè a, etap pa etap |

## Sa ki fèt deja ✅

- Estrikti app la ak ekran prensipal la (chwazi lang, nivo, stil)
- 6 stil konvèsasyon × 3 nivo (toulejou, vwayaj, restoran, makèt, biznis, antrevi)
- Ekran konvèsasyon an ak bouton mikwofòn nan
- Règ sekirite: kle yo p ap janm nan app la ni sou GitHub

## Sa ki rete pou fèt 🔜

- Konekte vwa a (anrejistreman → sèvè → IA → repons vwa)
- Sèvè a ak kle pa w yo
- Nòt pwononsyasyon
- Teste sou telefòn Android

## Pou bati app la (lè Flutter enstale)

```bash
cd app
flutter pub get
flutter run
```

⚠️ **Sekirite:** Pa janm mete yon kle API andedan dosye `app/`. Tout kle rete nan
`backend/.env`, ki pa janm ale sou GitHub. Gade `CLAUDE.md`.
