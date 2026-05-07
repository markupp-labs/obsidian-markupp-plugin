# Markupp Plugin (Obsidian)

Plugin Obsidian do projeto [Markupp](../README.md). Permite enviar a nota ativa do vault para o backend Markupp, que armazena e versiona o conteúdo de forma centralizada.

## Pré-requisitos

- Node.js 20+
- Backend Markupp rodando localmente (ver [`../backend`](../backend) ou `docker compose up` na raiz do monorepo)

## Funcionalidades

- Comando "Subir nota ativa" e ícone na ribbon que enviam a nota Markdown atual via `POST /notes`
- Tela de configuração (Settings → Markupp Plugin) para definir a URL do backend

## Configuração

Após instalar, abra **Settings → Markupp Plugin** e ajuste a **Backend URL** (default: `http://localhost:8080`).

## Desenvolvimento

```bash
npm install
npm run dev
```

Para testar no Obsidian, faça symlink/copie a pasta deste plugin para `<seu-vault>/.obsidian/plugins/obsidian-markupp-plugin/` e habilite em Community Plugins.

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Build em modo watch para desenvolvimento |
| `npm run build` | Type-check + build de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes (Vitest) |
| `npm run test:watch` | Vitest em modo watch |
| `npm run test:coverage` | Vitest com relatório de cobertura |

### Estrutura

```
src/
├── api/
│   ├── client.ts          # Cliente HTTP do backend Markupp
│   └── client.test.ts
├── commands/
│   └── upload-active-note.ts
├── __mocks__/
│   └── obsidian.ts        # Stubs do módulo `obsidian` para testes
├── main.ts                # Entrypoint do plugin
└── settings.ts            # Aba de settings
```

## Build de produção

```bash
npm run build
```

Gera `main.js` na raiz do plugin. Para distribuição, junte com `manifest.json` e `styles.css`.
