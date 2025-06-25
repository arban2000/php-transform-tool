<?php
// api/get_file_content.php

// 1. ZAPNUTÍ OUTPUT BUFFERINGU A ZOBRAZOVÁNÍ CHYB
// ob_start() odchytí jakýkoliv výstup, včetně fatálních chyb, dříve než je odeslán.
ob_start();
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Funkce pro odeslání chybové odpovědi ve formátu JSON a ukončení skriptu
function send_json_error($message, $debug_info = '', $http_code = 400) {
    // Pokud je v bufferu nějaký neočekávaný výstup (např. PHP chyba), přidáme ho
    if (ob_get_length() > 0) {
        $debug_info .= "\nZachycený výstup (možná příčina chyby):\n" . ob_get_clean();
    }
    
    http_response_code($http_code);
    header('Content-Type: application/json');
    // Ujistíme se, že i chybová hláška je správně kódovaná
    echo json_encode([
        'status' => 'error', 
        'message' => $message,
        'debug' => trim($debug_info)
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}

// 2. CELÝ KÓD ZABALÍME DO TRY...CATCH BLOKU
try {
    if (!file_exists(__DIR__ . '/../src/config.php')) {
        throw new Exception("KRITICKÁ CHYBA: Konfigurační soubor 'src/config.php' nebyl nalezen.");
    }
    require_once __DIR__ . '/../src/config.php';

    if (!defined('ORIGINALS_PATH')) {
        throw new Exception("KRITICKÁ CHYBA: Konstanta 'ORIGINALS_PATH' není definována v 'src/config.php'.");
    }

    $project = $_POST['project'] ?? null;
    $file = $_POST['file'] ?? null;
    $workspace_path = $_POST['workspace_path'] ?? null;

    if (!$file) {
        throw new Exception('Chybí soubor.', 0);
    }

    // Očisti cestu k souboru (odstraň počáteční lomítka a redundantní znaky)
    $file = ltrim($file, '/');
    $file = preg_replace('#^\./#', '', $file);

    // Debug info před sestavením base_path
    $debug = "project: " . var_export($project, true) . "\nfile: " . var_export($file, true) . "\nworkspace_path: " . var_export($workspace_path, true);

    // Pokud je workspace_path, použijeme jej místo originálu
    if ($workspace_path) {
        $base_path = $workspace_path;
        $debug .= "\nPoužívám workspace_path jako base_path: $base_path";
    } else {
        if (!$project) {
            throw new Exception('Chybí název projektu.');
        }
        $base_path = ORIGINALS_PATH . '/' . $project;
        $debug .= "\nPoužívám base_path z ORIGINALS_PATH: $base_path";
    }

    // Sestav cestu k souboru
    $full_file_path = $base_path . '/' . $file;
    $debug .= "\nfull_file_path: $full_file_path";

    // Bezpečnostní kontrola - $full_file_path musí být uvnitř $base_path
    $real_base = realpath($base_path);
    $real_file = realpath($full_file_path);
    $debug .= "\nreal_base: " . var_export($real_base, true) . "\nreal_file: " . var_export($real_file, true);

    if (!$real_file || strpos($real_file, $real_base) !== 0) {
        // Ulož debug info do proměnné a předej ji dál
        $GLOBALS['__debug_info'] = $debug;
        throw new Exception('Neoprávněný přístup nebo soubor neexistuje: ' . htmlspecialchars($full_file_path));
    }

    $content = file_get_contents($real_file);
    if ($content === false) {
        throw new Exception('Nepodařilo se přečíst obsah souboru. Zkontrolujte oprávnění pro čtení souboru: ' . htmlspecialchars($real_file), 0, null, $debug);
    }

    // Pokud vše proběhlo v pořádku, vyčistíme buffer a pošleme odpověď
    ob_end_clean();
    header('Content-Type: application/json');
    echo json_encode(['status' => 'ok', 'content' => $content], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    // Pokud kdekoliv nastala chyba, odchytíme ji a pošleme jako JSON
    $debug = '';
    // Pokud jsme si debug info připravili v proměnné $debug, přidej ho
    if (isset($GLOBALS['__debug_info'])) {
        $debug = $GLOBALS['__debug_info'];
    }
    $debug .= "\nChyba na řádku: " . $e->getLine() . " v souboru " . $e->getFile();
    send_json_error($e->getMessage(), $debug, 500);
}