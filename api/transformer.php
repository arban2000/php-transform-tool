<?php
// api/transformer.php

set_time_limit(1800);

require_once __DIR__ . '/../src/config.php';
require_once __DIR__ . '/../src/functions.php';

header('Content-Type: application/json');

$project = $_POST['project'] ?? null;

if (!$project) {
    echo json_encode(['status' => 'error', 'message' => 'Nebyl specifikován žádný projekt.']);
    exit();
}

// 1. Vytvoření pracovní kopie
$workspace_path = create_workspace($project);
if ($workspace_path === false) {
    echo json_encode(['status' => 'error', 'message' => 'Nepodařilo se vytvořit pracovní kopii projektu.']);
    exit();
}

// 2. Aplikace pravidel
$transform_result = apply_transformation_rules($workspace_path);

// 3. Spuštění základní kontroly syntaxe
$syntax_errors = analyze_project_syntax($workspace_path);

// 4. Podmíněné spuštění hloubkové analýzy
$phpstan_result = null;
if (empty($syntax_errors)) {
    // Pokud nejsou žádné syntaktické chyby, spustíme PHPStan
    $phpstan_result = analyze_project_with_phpstan($project);
}

// 5. Sestavení finálního výsledku
$final_result = [
    'status' => 'ok',
    'transform_summary' => $transform_result,
    'workspace_path' => $workspace_path,
    'syntax_errors' => $syntax_errors,
    'phpstan_result' => $phpstan_result // Bude null, pokud se analýza nespustila
];

echo json_encode($final_result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);