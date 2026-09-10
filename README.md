# Markupp Plugin (Obsidian)

Plugin Obsidian do projeto [Markupp](https://github.com/markupp-labs/markupp). Sincroniza as notas do vault com o servidor Markupp, que armazena o conteúdo de forma centralizada.

## Instalação

1. Baixe o artefato da release mais recente: `markupp-plugin-<versao>.zip` (ou os arquivos `main.js`, `manifest.json` e `styles.css` anexados à release).
2. Crie a pasta `<seu-vault>/.obsidian/plugins/obsidian-markupp-plugin/` e coloque os três arquivos nela (extraia o zip aqui).
3. No Obsidian: **Configurações → Plugins da comunidade**, ative o **Markupp**.
4. Nas opções do plugin, ajuste o **`serverUrl`** (padrão `http://localhost:8080`) para o endereço do servidor Markupp.
5. Use o ícone na barra lateral ou os comandos **Fetch / Pull / Push / Sync** para sincronizar suas notas.

## Pré-requisitos

- Node.js 20+ para buildar a partir do fonte
- Servidor Markupp rodando. Ver [DEPLOY](https://github.com/markupp-labs/markupp/blob/main/docs/DEPLOY.md)

## Funcionalidades

- Source control view na barra lateral, com o estado de cada nota em relação ao servidor
- Comandos **Fetch**, **Pull**, **Push** e **Sync**, com detecção de conflito e sobrescrita forçada
- Tela de configuração (Settings → Markupp) para definir a URL do servidor

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
│   ├── client.ts          # Cliente HTTP do servidor Markupp
│   └── client.test.ts
├── core/
│   ├── operations.ts      # Fetch, pull, push e sync
│   └── status.ts          # Estado da nota em relação ao servidor
├── storage/
│   └── note-index.ts      # Índice local das notas sincronizadas
├── ui/
│   ├── notify.ts          # Notices do Obsidian
│   └── sourceControl/
│       └── view.ts        # Source control view
├── __mocks__/             # Stubs do módulo `obsidian` para testes
├── main.ts                # Entrypoint do plugin
└── settings.ts            # Aba de settings
```

## Build de produção

```bash
npm run build
```

Gera os arquivos em `build/`. Para distribuição, junte `main.js`, `manifest.json` e `styles.css`. O workflow `.github/workflows/release.yml` faz isso e anexa o zip a cada release publicada.

## Licença

MIT. Ver [LICENSE](LICENSE) e [ADR-0001](docs/adrs/ADR-0001-licenca-mit.md).
