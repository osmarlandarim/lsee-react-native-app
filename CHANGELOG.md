# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

## [Unreleased]

### Added
- Nova área `Minha Conta` com menu interno de navegação.
- Nova opção `Aplicativos Conectados` com tela dedicada e botão de integração do Strava.
- Nova opção `Dados Pessoais` com tela dedicada, seta de voltar e formulário de edição.
- Suporte à foto de capa no perfil com seleção da galeria e persistência local.

### Changed
- A aba de conta passou a usar a foto do usuário como ícone no menu inferior (sem label textual).
- O fluxo do Strava passou a tratar conexão e desconexão no mesmo botão.
- O formulário de dados pessoais foi alinhado ao model da API:
  - `apelido`
  - `dataNascimento`
  - `idGenero`
  - `altura`
  - `peso`
  - `listaContato` (primeiro contato)
- `idGenero` e `idTipoContato` passaram a ser selecionáveis por opções carregadas da API (`/genero` e `/tipo-contato`), com fallback para digitação quando necessário.

### Fixed
- Ajuste do `returnTo` no fluxo Strava para URL dinâmica do app/web, evitando redirecionamento fixo incorreto.
- Confirmação obrigatória antes de desconectar do Strava.
- Remoção de foto de capa com limpeza do armazenamento local.
