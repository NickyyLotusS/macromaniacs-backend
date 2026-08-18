# ADR 0001 - Arquitetura inicial do backend

## Status

Proposta

## Contexto

O backend sera desenvolvido por uma equipe de tres pessoas e precisa atender
autenticacao, dieta, macros, check-ins, grupos, feed, ranking e conquistas.

## Decisao

Iniciar como monolito modular. Os modulos representam limites funcionais, nao
servicos implantados separadamente. Jobs de IA/OCR e notificacoes podem ser
executados de forma assincrona.

## Consequencias

- Menor custo operacional e de coordenacao no MVP.
- Contratos claros entre modulos continuam obrigatorios.
- Modulos poderao ser extraidos no futuro se houver necessidade comprovada.