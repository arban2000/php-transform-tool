<?php
// /api/linter.php

// Povolíme, aby skript běžel o něco déle, pokud by kontrola jednoho souboru trvala déle
set_time_limit(30);

// Načteme konfiguraci, abychom znali cestu k originálům
require_once __DIR__ . '/../src/config.php';

// Nastavíme hlavičku, že odpověď bude ve formátu JSON
header('Content-Type: application/json');

// Načteme data poslaná z JavaScriptu
$project = $_POST['project'] ?? null;
$file_to_check = $_POST['file'] ?? null;
$workspace_path = $_POST['workspace_path'] ?? null;

// Pokud je workspace_path, provedeme hromadnou kontrolu všech PHP souborů v této složce
if ($workspace_path) {
    if (!is_dir($workspace_path)) {
        echo json_encode([['status' => 'error', 'file' => '', 'message' => 'Pracovní kopie neexistuje.']]);
        exit();
    }
    $directory = new RecursiveDirectoryIterator($workspace_path);
    $iterator = new RecursiveIteratorIterator($directory);
    $regex = new RegexIterator($iterator, '/\.php$/i');
    $results = [];
    foreach ($regex as $file_info) {
        $file_path = $file_info->getPathname();
        $output = shell_exec("php -l " . escapeshellarg($file_path) . " 2>&1");
        $relative_path = str_replace($workspace_path . '/', '', $file_path);
        if (strpos($output, 'No syntax errors detected') === false) {
            $results[] = [
                'status' => 'error',
                'file' => $relative_path,
                'message' => trim($output)
            ];
        } else {
            $results[] = [
                'status' => 'ok',
                'file' => $relative_path
            ];
        }
    }
    echo json_encode($results);
    exit();
}

// Základní validace pro kontrolu originálních souborů
if (!$project || !$file_to_check) {
    echo json_encode(['status' => 'error', 'message' => 'Chybí název projektu nebo souboru.']);
    exit();
}

$project_path = ORIGINALS_PATH . '/' . $project;
$full_file_path = $project_path . '/' . $file_to_check;

// Bezpečnostní kontrola, aby se zabránilo přístupu mimo složku projektu
if (strpos(realpath($full_file_path), realpath($project_path)) !== 0) {
    echo json_encode(['status' => 'error', 'message' => 'Neoprávněný přístup k souboru.']);
    exit();
}

if (!file_exists($full_file_path)) {
    echo json_encode(['status' => 'error', 'message' => 'Soubor neexistuje: ' . htmlspecialchars($file_to_check)]);
    exit();
}

// Spustíme PHP linter v terminálu. 2>&1 přesměruje i chybový výstup do naší proměnné.
$output = shell_exec("php -l " . escapeshellarg($full_file_path) . " 2>&1");

// Vyhodnotíme výsledek a pošleme zpět JSON odpověď
if (strpos($output, 'No syntax errors detected') !== false) {
    echo json_encode(['status' => 'ok', 'file' => $file_to_check]);
} else {
    echo json_encode(['status' => 'error', 'file' => $file_to_check, 'message' => trim($output)]);
}