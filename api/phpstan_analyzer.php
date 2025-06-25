<?php
// api/phpstan_analyzer.php

// Zvýšíme časový limit, protože hloubková analýza může trvat déle
set_time_limit(120); // 2 minuty

// Načteme naši konfiguraci a funkce
require_once __DIR__ . '/../src/config.php';
require_once __DIR__ . '/../src/functions.php';

// Nastavíme hlavičku, že odpověď bude ve formátu JSON
header('Content-Type: application/json');

// Získáme název projektu poslaný z JavaScriptu
$project = $_POST['project'] ?? null;
$workspace_path = $_POST['workspace_path'] ?? null;

if (!$project && !$workspace_path) {
    // Pokud název projektu chybí, vrátíme chybu
    echo json_encode(['errors' => [['file' => 'Chyba požadavku', 'message' => 'Nebyl specifikován žádný projekt ani pracovní kopie.']]]);
    exit();
}

// Pokud je workspace_path, analyzujeme tuto složku
if ($workspace_path) {
    $tool_root_path = __DIR__ . '/..';
    $phpstan_executable = $tool_root_path . '/vendor/bin/phpstan';
    $config_file = $tool_root_path . '/phpstan.neon';

    if (!is_dir($workspace_path)) {
        echo json_encode(['errors' => [['file' => 'Chyba projektu', 'message' => 'Pracovní kopie neexistuje.']]]);
        exit();
    }
    if (!file_exists($phpstan_executable)) {
        echo json_encode(['errors' => [['file' => 'Chyba nástroje', 'message' => 'PHPStan nebyl nalezen. Spusťte `composer install`.']]]);
        exit();
    }
    $command = sprintf(
        '%s analyse %s --error-format=json --no-progress -c %s',
        escapeshellarg($phpstan_executable),
        escapeshellarg($workspace_path),
        escapeshellarg($config_file)
    );
    $output = shell_exec($command . " 2>&1");
    $result = json_decode($output, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['errors' => [['file' => 'Chyba spuštění PHPStan', 'line' => null, 'message' => 'Nepodařilo se zpracovat výstup. Raw output: ' . htmlspecialchars($output)]]]);
        exit();
    }
    $errors = [];
    foreach ($result['files'] ?? [] as $file => $file_data) {
        $relative_path = str_replace($workspace_path . '/', '', $file);
        foreach ($file_data['messages'] as $message) {
            $errors[] = [
                'file' => $relative_path,
                'line' => $message['line'],
                'message' => $message['message']
            ];
        }
    }
    echo json_encode([
        'totals' => $result['totals'],
        'errors' => $errors
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

// Zavoláme naši novou funkci pro analýzu
$analysis_result = analyze_project_with_phpstan($project);

// Pošleme výsledek zpět jako JSON
// JSON_PRETTY_PRINT a JSON_UNESCAPED_UNICODE jsou pro lepší čitelnost při ladění
echo json_encode($analysis_result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
