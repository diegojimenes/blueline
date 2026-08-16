export type Locale = "en" | "pt";

const en: Record<string, string> = {
  // App
  btn_open: "Open",
  btn_search: "Search",
  btn_search_title: "Search symbols (Ctrl+P / ⌘P)",
  btn_search_aria: "Search symbols",
  btn_toggle_theme_aria: "Toggle theme",

  // Explorer
  explorer_no_project: "No project open",
  explorer_modified_one: "{{count}} modified",
  explorer_modified_other: "{{count}} modified",
  explorer_collapse: "collapse",
  explorer_expand: "expand",
  explorer_dirty_file: "modified file",

  // Inspector — header / system
  inspector_arch_title: "🏛️ Architecture & System",
  inspector_open_project: "Open a project to inspect metrics and architecture",
  inspector_level: "level {{level}}",
  inspector_internal: "internal",

  // Inspector — review banners
  inspector_reviewed_badge: "✓ REVIEWED THIS SESSION",
  inspector_unmark: "Unmark",
  inspector_reviewed_desc: "This symbol was validated by the developer.",
  inspector_modified_badge: "⚡ MODIFIED",
  inspector_mark_reviewed: "✓ Mark as Reviewed",
  inspector_scope_local: "Local",
  inspector_scope_project: "Project",
  inspector_scope_local_title: "Focus review on local node",
  inspector_scope_project_title: "Review scope for entire project",
  inspector_diff_ast: "+{{additions}} -{{deletions}} ({{total}} lines changed via AST)",
  inspector_file_changed: "File has changes relative to base repository",
  inspector_magnitude_heavy: "Critical (>20L)",
  inspector_magnitude_medium: "Medium (6-20L)",
  inspector_magnitude_light: "Light (≤5L)",

  // Inspector — symbol identity
  inspector_layer: "LAYER",
  inspector_domain: "DOMAIN",
  inspector_line: "LINE",
  inspector_classes: "CLASSES",
  inspector_coupling: "Structural Coupling",
  inspector_coupling_one: "{{count}} dependency",
  inspector_coupling_other: "{{count}} dependencies",

  // Inspector — impact alert
  inspector_impact_radar: "Impact Radar:",
  inspector_callers_one: "{{count}} symbol directly depends on this function.",
  inspector_callers_other: "{{count}} symbols directly depend on this function.",
  inspector_no_callers: "No direct internal callers detected.",
  inspector_calls_out: "↓ Calls ({{count}})",
  inspector_calls_in: "↑ Called by ({{count}})",

  // Inspector — code/diff viewer
  inspector_tab_code: "📄 Code",
  inspector_tab_diff: "⚡ Diff",
  inspector_tab_split: "☷ Split",
  inspector_wrap: "↩ Wrap",
  inspector_expand: "⤢ Expand",
  inspector_loading: "Loading code…",
  inspector_code_missing: "Source code not available in directory",
  inspector_no_diff: "✓ No pending changes against HEAD",
  inspector_wrap_on_title: "Disable word wrap",
  inspector_wrap_off_title: "Enable word wrap",
  inspector_expand_title: "Expand code and diff to full screen",
  inspector_expand_aria: "Expand code and diff",
  inspector_wrap_aria: "Wrap lines",

  // Inspector — dashboard sections
  inspector_review_progress: "📋 Review Progress",
  inspector_review_progress_count: "{{reviewed}} of {{total}} validated ({{pct}}%)",
  inspector_layer_impact: "🌐 Layer Impact",
  inspector_layers_touched_one: "{{count}} layer touched",
  inspector_layers_touched_other: "{{count}} layers touched",
  inspector_layer_classes_one: "{{count}} class",
  inspector_layer_classes_other: "{{count}} classes",
  inspector_symbols_changed: "🏛️ Symbols with Changes",
  inspector_symbols_count: "{{count}} nodes",
  inspector_non_structural: "{{count}} non-structural files modified.",
  inspector_no_modified: "No code nodes modified at this time.",
  inspector_project_modules: "📦 Project Modules",

  // Inspector — stat cards
  stat_modules: "Modules",
  stat_classes: "Classes",
  stat_methods: "Methods",

  // QuickSearch
  search_aria: "Global Symbol Search",
  search_placeholder: "Search module, class or function (Ctrl+P / ⌘P)...",
  search_input_aria: "Search symbols in project",
  search_not_found: 'No symbols found for "{{query}}"',
  search_no_nodes: "No nodes available in the project",

  // StatusBar
  status_watcher_off: "watcher: —",
  status_watcher_active: "watcher: active",
  status_watcher_updated: "watcher: updated {{time}}",
  status_git_none: "git: —",
  status_git_clean: "git: clean",
  status_git_dirty_one: "git: {{count}} changed",
  status_git_dirty_other: "git: {{count}} changed",
  status_level: "level {{level}}",
  status_view: "view {{lens}}",

  // AIReviewBar
  ai_review_aria: "AI Changes Review",
  ai_review_badge: "⚡ AI Review Mode",
  ai_files_modified_one: "{{count}} file modified",
  ai_files_modified_other: "{{count}} files modified",
  ai_symbols_touched_one: "{{count}} symbol touched",
  ai_symbols_touched_other: "{{count}} symbols touched",
  ai_scope_local: "🎯 This Scope",
  ai_scope_project: "🌐 Full Project",
  ai_scope_local_title: "Switch to navigate in current scope only",
  ai_scope_project_title: "Switch to navigate across the entire project",
  ai_prev: "◀ Previous",
  ai_prev_title: "Go to previous modified symbol",
  ai_next: "Next ▶",
  ai_next_title: "Go to next modified symbol",
  ai_view_diff: "⤢ View Diff",
  ai_view_diff_title: "Open expanded Diff and Code viewer (full screen)",
  ai_scope_counter_title_local: "Position in current scope",
  ai_scope_counter_title_project: "Position in project",
  ai_scope_tag: "local",
};

const pt: Record<string, string> = {
  // App
  btn_open: "Abrir",
  btn_search: "Buscar",
  btn_search_title: "Buscar símbolos (Ctrl+P / ⌘P)",
  btn_search_aria: "Buscar símbolos",
  btn_toggle_theme_aria: "Alternar tema",

  // Explorer
  explorer_no_project: "Nenhum projeto aberto",
  explorer_modified_one: "{{count}} modificado",
  explorer_modified_other: "{{count}} modificados",
  explorer_collapse: "recolher",
  explorer_expand: "expandir",
  explorer_dirty_file: "arquivo modificado",

  // Inspector — header / system
  inspector_arch_title: "🏛️ Arquitetura & Sistema",
  inspector_open_project: "Abra um projeto para inspecionar métricas e arquitetura",
  inspector_level: "nível {{level}}",
  inspector_internal: "interna",

  // Inspector — review banners
  inspector_reviewed_badge: "✓ REVISADO NESTA SESSÃO",
  inspector_unmark: "Desmarcar",
  inspector_reviewed_desc: "Este símbolo foi validado pelo desenvolvedor.",
  inspector_modified_badge: "⚡ MODIFICADO",
  inspector_mark_reviewed: "✓ Marcar como Revisado",
  inspector_scope_local: "Local",
  inspector_scope_project: "Projeto",
  inspector_scope_local_title: "Foco de revisão no nó local",
  inspector_scope_project_title: "Visão de revisão do projeto todo",
  inspector_diff_ast: "+{{additions}} -{{deletions}} ({{total}} linhas alteradas via AST)",
  inspector_file_changed: "Arquivo com alterações em relação ao repositório base",
  inspector_magnitude_heavy: "Crítico (>20L)",
  inspector_magnitude_medium: "Médio (6-20L)",
  inspector_magnitude_light: "Leve (≤5L)",

  // Inspector — symbol identity
  inspector_layer: "CAMADA",
  inspector_domain: "DOMÍNIO",
  inspector_line: "LINHA",
  inspector_classes: "CLASSES",
  inspector_coupling: "Acoplamento Estrutural",
  inspector_coupling_one: "{{count}} dependência",
  inspector_coupling_other: "{{count}} dependências",

  // Inspector — impact alert
  inspector_impact_radar: "Radar de Impacto:",
  inspector_callers_one: "{{count}} símbolo depende diretamente desta função.",
  inspector_callers_other: "{{count}} símbolos dependem diretamente desta função.",
  inspector_no_callers: "Nenhum chamador interno direto detectado.",
  inspector_calls_out: "↓ Chama ({{count}})",
  inspector_calls_in: "↑ Chamado por ({{count}})",

  // Inspector — code/diff viewer
  inspector_tab_code: "📄 Código",
  inspector_tab_diff: "⚡ Diff",
  inspector_tab_split: "☷ Split",
  inspector_wrap: "↩ Wrap",
  inspector_expand: "⤢ Expandir",
  inspector_loading: "Carregando código…",
  inspector_code_missing: "Código-fonte não disponível no diretório",
  inspector_no_diff: "✓ Sem alterações pendentes em relação ao HEAD",
  inspector_wrap_on_title: "Desativar quebra automática de linhas",
  inspector_wrap_off_title: "Ativar quebra automática de linhas (Word-Wrap)",
  inspector_expand_title: "Expandir código e diff em tela cheia (fora da lateral)",
  inspector_expand_aria: "Expandir código e diff",
  inspector_wrap_aria: "Quebrar linhas",

  // Inspector — dashboard sections
  inspector_review_progress: "📋 Progresso de Revisão",
  inspector_review_progress_count: "{{reviewed}} de {{total}} validados ({{pct}}%)",
  inspector_layer_impact: "🌐 Impacto por Camada",
  inspector_layers_touched_one: "{{count}} camada tocada",
  inspector_layers_touched_other: "{{count}} camadas tocadas",
  inspector_layer_classes_one: "{{count}} classe",
  inspector_layer_classes_other: "{{count}} classes",
  inspector_symbols_changed: "🏛️ Símbolos com Alterações",
  inspector_symbols_count: "{{count}} nós",
  inspector_non_structural: "{{count}} arquivos não-estruturais modificados.",
  inspector_no_modified: "Nenhum nó de código modificado no momento.",
  inspector_project_modules: "📦 Módulos do Projeto",

  // Inspector — stat cards
  stat_modules: "Módulos",
  stat_classes: "Classes",
  stat_methods: "Métodos",

  // QuickSearch
  search_aria: "Busca Global de Símbolos",
  search_placeholder: "Buscar módulo, classe ou função (Ctrl+P / ⌘P)...",
  search_input_aria: "Buscar símbolos no projeto",
  search_not_found: 'Nenhum símbolo encontrado para "{{query}}"',
  search_no_nodes: "Nenhum nó disponível no projeto",

  // StatusBar
  status_watcher_off: "watcher: —",
  status_watcher_active: "watcher: ativo",
  status_watcher_updated: "watcher: atualizado {{time}}",
  status_git_none: "git: —",
  status_git_clean: "git: limpo",
  status_git_dirty_one: "git: {{count}} alterado",
  status_git_dirty_other: "git: {{count}} alterados",
  status_level: "nível {{level}}",
  status_view: "lente {{lens}}",

  // AIReviewBar
  ai_review_aria: "Revisão de Alterações de IA",
  ai_review_badge: "⚡ Modo Revisão IA",
  ai_files_modified_one: "{{count}} arquivo modificado",
  ai_files_modified_other: "{{count}} arquivos modificados",
  ai_symbols_touched_one: "{{count}} símbolo tocado",
  ai_symbols_touched_other: "{{count}} símbolos tocados",
  ai_scope_local: "🎯 Neste Escopo",
  ai_scope_project: "🌐 No Projeto",
  ai_scope_local_title: "Alternar para navegar apenas no escopo atual",
  ai_scope_project_title: "Alternar para navegar no projeto inteiro",
  ai_prev: "◀ Anterior",
  ai_prev_title: "Navegar para o símbolo modificado anterior",
  ai_next: "Próximo ▶",
  ai_next_title: "Navegar para o próximo símbolo modificado",
  ai_view_diff: "⤢ Ver Diff",
  ai_view_diff_title: "Abrir visualizador expandido de Diff e Código (tela cheia)",
  ai_scope_counter_title_local: "Posição no escopo atual",
  ai_scope_counter_title_project: "Posição no projeto",
  ai_scope_tag: "local",
};

export const translations: Record<Locale, Record<string, string>> = { en, pt };
