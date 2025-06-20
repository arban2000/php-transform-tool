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