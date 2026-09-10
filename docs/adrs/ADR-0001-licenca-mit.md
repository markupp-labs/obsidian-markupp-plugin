# ADR-0001: MIT como licença do plugin

## Status

Aceita

## Contexto

O plugin herdava a AGPL v3 do repositório do servidor (ADR-0008 do markupp-labs/markupp).
Ao sair para repositório próprio ele precisa de licença explícita, e o argumento que
sustenta a AGPL no servidor não se aplica aqui: o risco que ela endereça é terceiro
oferecer o servidor como SaaS fechado sem contribuir de volta. O plugin roda na máquina do
usuário, dentro do Obsidian, e não é ofertável como serviço

## Decisão

MIT

## Alternativas consideradas

- Manter AGPL v3: nenhuma mudança de termos para quem já usa, ao custo de copyleft forte
  em cliente onde ele não protege nada, e de atrito com o ecossistema de plugins do
  Obsidian, majoritariamente MIT
- Apache 2.0: permissiva com cláusula de patente, mais verbosa e sem uso relevante entre
  plugins do Obsidian

## Consequências

- Muda os termos em relação ao que o plugin tinha enquanto morava no repositório do
  servidor, e vale a partir daqui, sem efeito retroativo sobre releases já publicadas
- Servidor e cliente passam a ter licenças diferentes, o que é consistente com o ADR-0026
  do servidor: o contrato entre eles é a API REST, não o código
- Terceiro pode fazer fork fechado do plugin, o que é aceito: o valor do projeto está no
  servidor
