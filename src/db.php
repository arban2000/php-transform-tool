<?php
// filepath: /var/www/vyvoj/transform-tool/src/db.php

/**
 * 1. KONFIGURACE PŘIPOJENÍ K DATABÁZI
 * Používáme konstanty pro lepší přehlednost, jak jste navrhl.
 */
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'transformer_db');
define('DB_USER', 'transformer_user');
define('DB_PASS', 'Arban2401phpver');
define('DB_CHARSET', 'utf8mb4');


/**
 * 2. SESTAVENÍ PŘIPOJOVACÍCH ŘETĚZCŮ
 * Zde použijeme výše definované konstanty.
 */

// DSN (Data Source Name) řetězec pro PDO
$dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

// Pole s volbami pro PDO ovladač
$options = [
    // V případě chyby vyhodit výjimku (místo tichého selhání)
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    // Výsledky z databáze vracet jako asociativní pole (klíč => hodnota)
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    // Nepoužívat emulaci prepared statements, ale skutečné
    PDO::ATTR_EMULATE_PREPARES   => false,
    // KLÍČOVÁ OPRAVA: Explicitně vypneme trvalé (perzistentní) připojení.
    // Tím donutíme PDO vždy vytvořit nové, čisté spojení s údaji uvedenými výše.
    PDO::ATTR_PERSISTENT         => false
];


/**
 * 3. SAMOTNÉ PŘIPOJENÍ K DATABÁZI
 * Pokusíme se vytvořit objekt $pdo, který bude reprezentovat spojení.
 */
try {
    // Vytvoříme nový objekt PDO, který se pokusí připojit.
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

} catch (PDOException $e) {
    // Pokud se připojení nepodaří, skript okamžitě skončí a vypíše srozumitelnou chybu.
    // Tím zabráníme zobrazení dalších chyb, které by z neúspěšného připojení pramenily.
    die(
        "CHYBA PŘIPOJENÍ K DATABÁZI: Nepodařilo se připojit jako uživatel '" . DB_USER . "'.<br>" .
        "Zkontrolujte prosím přihlašovací údaje v souboru `db.php` a oprávnění tohoto uživatele v databázi.<br><br>" .
        "<strong>Původní chybová hláška od MySQL:</strong> " . $e->getMessage()
    );
}

// Pokud skript došel až sem, proměnná $pdo existuje a obsahuje platné připojení k databázi.
// Soubor index.php a další mohou nyní s touto proměnnou bezpečně pracovat.