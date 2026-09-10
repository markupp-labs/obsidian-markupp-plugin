# Arquitetura C4 do Markupp

Documento único com a visão C4 do projeto Markupp, considerando o plugin Obsidian e o servidor
REST em Go. O código do servidor vive em [markupp-labs/markupp](https://github.com/markupp-labs/markupp).

## 1. Contexto

```mermaid
C4Context
    Person(user, "Usuário", "Usuário do Obsidian que quer sincronizar notas")
    System(obsidian, "Obsidian", "Aplicação de anotações desktop com suporte a plugins")
    System(markupp, "Markupp", "Sistema de sincronização de notas com servidor persistente")
    Rel(user, obsidian, "Usa")
    Rel(obsidian, markupp, "Sincroniza com", "HTTP/JSON")
```

## 2. Contêineres

```mermaid
C4Container
    Person(user, "Usuário", "Usuário do Obsidian")
    System_Boundary(obsidian_system, "Obsidian Desktop"){
        Container(plugin, "Plugin Markupp", "TypeScript", "Interface de sincronização dentro do Obsidian")
        Container(vault, "Vault Obsidian", "Markdown Files", "Armazena as notas localmente")
    }
    System_Boundary(markupp_system, "Servidor Markupp"){
        Container(api_server, "API REST", "Go + Chi", "API que gerencia as notas")
        Container(database, "SQLite", "SQLite Database", "Armazena as notas persistentemente")
    }
    Rel(user, plugin, "Usa", "via Obsidian")
    Rel(plugin, vault, "Lê/Escreve")
    Rel(plugin, api_server, "Sincroniza", "HTTP/JSON")
    Rel(api_server, database, "Persiste", "SQL")
```

## 3. Componentes do Servidor

```mermaid
C4Component
    Boundary(server, "Servidor Markupp"){
        Component(router, "Router", "Go + Chi", "Define as rotas HTTP da API")
        Component(handler, "Notes Handler", "Go", "Processa requisições de notas")
        Component(service, "Serviço de Notas", "Go", "Lógica de negócio das notas")
        Component(repo, "Repositório SQLite", "Go", "Acessa o banco de dados")
        Component(queries, "Queries sqlc", "Go", "Gerado automaticamente pelo sqlc")
        ComponentDb(database, "SQLite", "Armazena as notas")
    }
    Rel(router, handler, "Roteia para")
    Rel(handler, service, "Usa")
    Rel(service, repo, "Usa")
    Rel(repo, queries, "Usa")
    Rel(queries, database, "Executa queries")
```

## 4. Leitura Arquitetural

- O usuário interage com o sistema pelo Obsidian, onde o plugin Markupp executa comandos de sincronização, upload, download e importação.
- O plugin consome a API REST do servidor por HTTP/JSON, usando as rotas `/notes`.
- O servidor em Go expõe as rotas, valida as regras de negócio no serviço e persiste as notas em SQLite.
- O vault do Obsidian mantém os arquivos Markdown locais, enquanto o servidor mantém a fonte persistente das notas.

## 5. Decisões Estruturais

- Separação clara entre interface de usuário (plugin), API (servidor) e persistência (SQLite).
- Persistência única em SQLite, acessada via `sqlc`.
- O plugin permanece desacoplado do banco, falando apenas com a API REST.
- No nível de contêineres, o plugin e o servidor são sistemas independentes que se comunicam por HTTP/JSON.
