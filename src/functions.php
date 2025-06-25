<?php
// src/functions.php

/**
 * Najde všechny projekty (podsložky) v adresáři s originály.
 * @return array Seznam názvů projektů.
 */
function get_projects(): array {
    $projects = [];
    $originals_path = ORIGINALS_PATH; // Načteme cestu z configu

    foreach (scandir($originals_path) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        if (is_dir($originals_path . '/' . $item)) {
            $projects[] = $item;
        }
    }
    return $projects;
}

/**
 * Najde všechny .php soubory v daném projektu, rekurzivně.
 * @param string $project_name Název složky projektu.
 * @return array Seznam relativních cest k .php souborům.
 */
function get_php_files(string $project_name): array {
    $php_files = [];
    $project_path = ORIGINALS_PATH . '/' . $project_name;

    if (strpos($project_name, '..') !== false || !is_dir($project_path)) {
        return [];
    }
    
    $directory = new RecursiveDirectoryIterator($project_path);
    $iterator = new RecursiveIteratorIterator($directory);

    // ========================================================================
    // ZDE JE KLÍČOVÁ OPRAVA:
    // Měníme režim z GET_MATCH (získat jen shodu) na MATCH (získat celý řetězec, pokud obsahuje shodu).
    // Režim MATCH je výchozí, takže třetí parametr můžeme úplně vynechat.
    // ========================================================================
    $regex = new RegexIterator($iterator, '/\.php$/i');

    // Nyní proměnná $file v cyklu nebude pole, ale objekt SplFileInfo,
    // ze kterého si můžeme vytáhnout potřebné informace.
    foreach ($regex as $file) {
        // $file->getPathname() vrátí celou absolutní cestu k souboru
        $full_path = $file->getPathname(); 
        
        // Z absolutní cesty uděláme wieder relativní pro hezčí výpis
        $relative_path = str_replace($project_path . '/', '', $full_path);
        $php_files[] = $relative_path;
    }
    sort($php_files);
    return $php_files;
}

/**
 * Rekurzivně zkopíruje obsah jednoho adresáře do druhého.
 * @param string $source Zdrojový adresář.
 * @param string $dest Cílový adresář.
 */
function recursive_copy(string $source, string $dest): void {
    if (!is_dir($dest)) {
        mkdir($dest, 0755, true);
    }
    foreach (scandir($source) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $source_path = $source . '/' . $item;
        $dest_path = $dest . '/' . $item;
        if (is_dir($source_path)) {
            recursive_copy($source_path, $dest_path);
        } else {
            copy($source_path, $dest_path);
        }
    }
}

/**
 * Vytvoří časově označený snímek (snapshot) projektu.
 * Prozatím vytváří snímek z originálu.
 * @param string $project_name Název projektu.
 * @return bool True v případě úspěchu, false v případě neúspěchu.
 */
function save_project_snapshot(string $project_name): bool {
    $source_path = ORIGINALS_PATH . '/' . $project_name;
    
    // Cesta pro snímky konkrétního projektu
    $project_snapshot_path = SNAPSHOTS_PATH . '/' . $project_name;
    
    // Vytvoříme složku pro snímky projektu, pokud neexistuje
    if (!is_dir($project_snapshot_path)) {
        mkdir($project_snapshot_path, 0755, true);
    }
    
    // Vytvoříme cílovou složku s časovým razítkem
    $timestamp = date('Y-m-d_H-i-s');
    $destination_path = $project_snapshot_path . '/snapshot_' . $timestamp;

    if (!is_dir($source_path)) {
        return false;
    }

    // Provedeme rekurzivní kopírování
    recursive_copy($source_path, $destination_path);

    return true;
}

/**
 * Získá historii commitů z Gitu.
 * @return array Pole s historií commitů.
 */
function get_git_log(): array {
    // Speciální formát, který se nám bude dobře parsovat: hash|popisek|relativní čas
    $format = "%h|%s|%ar"; 
    // Spustíme příkaz git log v terminálu
    $output = shell_exec("git log --pretty=format:'{$format}'");
    
    if (empty($output)) {
        return [];
    }

    $commits = [];
    $lines = explode("\n", trim($output));

    foreach ($lines as $line) {
        list($hash, $message, $date) = explode('|', $line, 3);
        $commits[] = [
            'hash' => $hash,
            'message' => $message,
            'date' => $date
        ];
    }
    
    return $commits;
}

/**
 * Vytvoří nový git commit.
 * @param string $message Popisek commitu.
 * @return string Výstup z git commit příkazu.
 */
function create_git_commit(string $message): string {
    // Bezpečnostní ošetření uživatelského vstupu
    $escaped_message = escapeshellarg($message);

    // Nejdříve přidáme všechny změněné soubory (jako git add .)
    shell_exec("git add .");
    
    // Poté vytvoříme commit s ošetřeným popiskem
    $output = shell_exec("git commit -m {$escaped_message}");

    return $output;
}

/**
 * Obnoví stav projektu do konkrétního commitu.
 * @param string $hash Hash commitu, ke kterému se chceme vrátit.
 * @return string Výstup z git checkout.
 */
function restore_git_commit(string $hash): string {
    // Základní bezpečnostní kontrola, zda hash obsahuje jen povolené znaky
    if (!preg_match('/^[a-f0-9]+$/', $hash)) {
        return "Chyba: Neplatný formát hashe.";
    }

    // Příkaz, který vrátí všechny soubory do stavu daného commitu
    $output = shell_exec("git checkout {$hash} -- .");
    
    return "Projekt obnoven do verze {$hash}.\n" . $output;
}

/**
 * Provede základní kontrolu syntaxe (lint) na všech .php souborech v dané cestě.
 * @param string $path_to_analyze Absolutní cesta ke složce, která se má analyzovat.
 * @return array Pole s nalezenými chybami.
 */
function analyze_project_syntax(string $path_to_analyze): array {
    $errors = [];
    if (!is_dir($path_to_analyze)) {
        return [['file' => 'Chyba projektu', 'message' => 'Adresář pro analýzu neexistuje: ' . htmlspecialchars($path_to_analyze)]];
    }

    $directory = new RecursiveDirectoryIterator($path_to_analyze);
    $iterator = new RecursiveIteratorIterator($directory);
    $regex = new RegexIterator($iterator, '/\.php$/i');

    foreach ($regex as $file_info) {
        $file_path = $file_info->getPathname();
        $output = shell_exec("php -l " . escapeshellarg($file_path) . " 2>&1");

        if (strpos($output, 'No syntax errors detected') === false) {
            // Vrátíme relativní cestu od analyzované složky
            $relative_path = str_replace($path_to_analyze . '/', '', $file_path);
            $errors[] = [
                'file' => $relative_path,
                'message' => trim($output)
            ];
        }
    }

    return $errors;
}

/**
 * NOVÁ FUNKCE: Provede hloubkovou analýzu projektu pomocí PHPStan.
 * @param string $project_name Název projektu.
 * @return array Pole s výsledky analýzy.
 */
function analyze_project_with_phpstan(string $project_name): array {
    $project_path_to_analyze = ORIGINALS_PATH . '/' . $project_name;
    $tool_root_path = __DIR__ . '/..';
    $phpstan_executable = $tool_root_path . '/vendor/bin/phpstan';
    $config_file = $tool_root_path . '/phpstan.neon';

    // Kontroly, zda vše existuje
    if (!is_dir($project_path_to_analyze)) {
        return ['errors' => [['file' => 'Chyba projektu', 'message' => 'Adresář projektu neexistuje.']]];
    }
    if (!file_exists($phpstan_executable)) {
        return ['errors' => [['file' => 'Chyba nástroje', 'message' => 'PHPStan nebyl nalezen. Spusťte `composer install`.']]];
    }

    // Sestavíme příkaz pro spuštění v terminálu
    // --no-progress skryje načítací lištu, --error-format=json vrátí výsledek v JSON
    $command = sprintf(
        '%s analyse %s --error-format=json --no-progress -c %s',
        escapeshellarg($phpstan_executable),         // Cesta k PHPStanu
        escapeshellarg($project_path_to_analyze),    // Cesta ke složce projektu, kterou má analyzovat
        escapeshellarg($config_file)                 // Cesta ke konfiguračnímu souboru
    );
    
    // Spustíme příkaz a odchytíme jeho výstup
    $output = shell_exec($command . " 2>&1");
    
    // Zkusíme výstup zpracovat jako JSON
    $result = json_decode($output, true);

    // Zkontrolujeme, zda se dekódování podařilo
    if (json_last_error() !== JSON_ERROR_NONE) {
        // Pokud ne, pravděpodobně PHPStan spadl s fatální chybou
        return ['errors' => [['file' => 'Chyba spuštění PHPStan', 'line' => null, 'message' => 'Nepodařilo se zpracovat výstup. Raw output: ' . htmlspecialchars($output)]]];
    }
    
    $errors = [];
    // Projdeme všechny soubory ve výsledku
    foreach ($result['files'] ?? [] as $file => $file_data) {
        // Nahradíme absolutní cestu za relativní pro lepší přehlednost
        $relative_path = str_replace(ORIGINALS_PATH . '/', '', $file);
        // Projdeme všechny nalezené chyby v daném souboru
        foreach ($file_data['messages'] as $message) {
            $errors[] = [
                'file' => $relative_path,
                'line' => $message['line'],
                'message' => $message['message']
            ];
        }
    }
    
    return [
        'totals' => $result['totals'],
        'errors' => $errors
    ];
}

/**
 * Vytvoří pracovní kopii projektu. Pokud již existuje, smaže ji a vytvoří novou.
 * @param string $project_name Název projektu.
 * @return string|false Absolutní cesta k nové pracovní kopii, nebo false při neúspěchu.
 */
function create_workspace(string $project_name) {
    $source_path = ORIGINALS_PATH . '/' . $project_name;
    $workspace_path = WORKSPACES_PATH . '/' . $project_name; // Bez časového razítka

    if (!is_dir($source_path)) {
        return false;
    }

    // Pokud stará pracovní kopie existuje, smažeme ji
    if (is_dir($workspace_path)) {
        recursive_delete($workspace_path);
    }

    // Provedeme rekurzivní kopírování
    recursive_copy($source_path, $workspace_path);

    return $workspace_path;
}

/**
 * Aplikuje aktivní transformační pravidla na všechny soubory v pracovní kopii.
 * @param string $workspace_path Absolutní cesta k pracovní kopii projektu.
 * @return array Souhrn provedených změn.
 */
function apply_transformation_rules(string $workspace_path): array
{
    // 1. Načtení pravidel
    $rules_file_path = __DIR__ . '/../rules.json';
    $rules = [];
    if (file_exists($rules_file_path)) {
        $rules = json_decode(file_get_contents($rules_file_path), true);
    }

    // 2. Filtrace pouze aktivních pravidel a seřazení podle pořadí
    $active_rules = array_filter($rules, function($rule) {
        return $rule['enabled'] === true;
    });
    usort($active_rules, function($a, $b) {
        return $a['order'] <=> $b['order'];
    });

    if (empty($active_rules)) {
        return ['files_changed' => 0, 'applied_rules_count' => 0];
    }
    
    // 3. Příprava vzorů pro hromadné nahrazení
    $find_patterns = [];
    $replace_patterns = [];
    foreach ($active_rules as $rule) {
        $find_patterns[] = $rule['find'];
        $replace_patterns[] = $rule['replace'];
    }

    // 4. Procházení souborů a aplikace pravidel
    $files_changed_count = 0;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($workspace_path));
    $php_files = new RegexIterator($iterator, '/\.php$/i');

    foreach ($php_files as $file) {
        if ($file->isDir()) {
            continue;
        }

        $file_path = $file->getPathname();
        $original_content = file_get_contents($file_path);
        
        // Aplikujeme všechna pravidla najednou
        $new_content = preg_replace($find_patterns, $replace_patterns, $original_content, -1, $count);
        
        // Pokud došlo k nějaké změně, soubor přepíšeme
        if ($count > 0) {
            file_put_contents($file_path, $new_content);
            $files_changed_count++;
        }
    }

    return [
        'files_changed' => $files_changed_count,
        'applied_rules_count' => count($active_rules)
    ];
}
/**
 * Rekurzivně smaže adresář a celý jeho obsah.
 * @param string $dir Cesta k adresáři.
 */
function recursive_delete(string $dir): void {
    if (!is_dir($dir)) return;
    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        (is_dir("$dir/$file")) ? recursive_delete("$dir/$file") : unlink("$dir/$file");
    }
    rmdir($dir);
}