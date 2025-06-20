<?php
// public/index.php

require_once __DIR__ . '/../src/config.php';
require_once __DIR__ . '/../src/functions.php';

$message = '';
$syntax_errors = [];

// --- ZPRACOVÁNÍ GIT AKCÍ ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['create_commit'])) {
    $commit_message = $_POST['commit_message'] ?? 'Automatický commit s časovým razítkem';
    if(empty($commit_message)) $commit_message = 'Commit bez popisku - ' . date('Y-m-d H:i:s');
    
    create_git_commit($commit_message);
    $message = "Nový commit byl úspěšně vytvořen.";
    header('Location: index.php?message=' . urlencode($message));
    exit();
}

if (isset($_GET['action']) && $_GET['action'] === 'restore_commit' && isset($_GET['hash'])) {
    $hash_to_restore = $_GET['hash'];
    restore_git_commit($hash_to_restore);
    $message = "Projekt byl obnoven do verze {$hash_to_restore}.";
    header('Location: index.php?message=' . urlencode($message));
    exit();
}
// Zpráva zobrazená po přesměrování
if(isset($_GET['message'])) {
    $message = $_GET['message'];
}

if (isset($_POST['analyze_syntax'])) {
    $project_to_analyze = $_POST['project_name'] ?? '';
    if ($project_to_analyze) {
        $syntax_errors = analyze_project_syntax($project_to_analyze);
        if (empty($syntax_errors)) {
            $message = "Kontrola syntaxe dokončena. Nebyly nalezeny žádné chyby v projektu '{$project_to_analyze}'.";
        } else {
            $message = "Kontrola syntaxe nalezla chyby v projektu '{$project_to_analyze}'.";
        }
    }
}

// --- Načtení dat pro zobrazení ---
$projects = get_projects();
$selected_project = $_GET['project'] ?? ($_POST['project_name'] ?? null); // Zachováme projekt i po POSTu
$php_files = [];
if ($selected_project) {
    $php_files = get_php_files($selected_project);
}
$git_log = get_git_log();

// Vždy načteme historii commitů pro zobrazení
$git_log = get_git_log();

?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <title>Transformační Nástroj</title>
    <link rel="stylesheet" href="style.css">

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-highlight/prism-line-highlight.min.css">
</head>
<body>
    <h1>Transformační Nástroj</h1>

    <?php if ($message): ?>
        <div class="container message"><p><?= htmlspecialchars($message) ?></p></div>
    <?php endif; ?>

    <div class="container git-control">
        <h2>Verzování Nástroje (Git)</h2>
        
        <form method="POST" action="index.php" class="commit-form">
            <label for="commit_message">Popisek pro nový "save" (commit):</label>
            <div class="input-group">
                <textarea name="commit_message" id="commit_message" rows="3" placeholder="Např. Přidána funkce pro ukládání..."></textarea>
                <button type="submit" name="create_commit">💾 Vytvořit nový bod obnovy</button>
            </div>
        </form>

        <hr>

        <h3>Historie verzí (sejvů)</h3>
        <div class="commit-history">
            <table>
                <thead>
                    <tr>
                        <th>Verze (Hash)</th>
                        <th>Popis</th>
                        <th>Datum</th>
                        <th>Akce</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($git_log)): ?>
                        <tr>
                            <td colspan="4">Nenalezena žádná historie commitů. Inicializujte Git repozitář.</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($git_log as $index => $commit): ?>
                            <tr>
                                <td><code><?= htmlspecialchars($commit['hash']) ?></code></td>
                                <td><?= htmlspecialchars($commit['message']) ?></td>
                                <td><?= htmlspecialchars($commit['date']) ?></td>
                                <td>
                                    <?php if ($index > 0): ?>
                                        <form method="GET" action="index.php" onsubmit="return confirm('Opravdu chcete obnovit všechny soubory do této starší verze? Veškeré neuložené změny budou ztraceny!');">
                                            <input type="hidden" name="action" value="restore_commit">
                                            <input type="hidden" name="hash" value="<?= htmlspecialchars($commit['hash']) ?>">
                                            <button type="submit" class="restore-button">🔄 Obnovit do této verze</button>
                                        </form>
                                    <?php else: ?>
                                        <strong>(Aktuální verze)</strong>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <div class="container project-selector">
        <h2>Projekty k transformaci</h2>
        <?php if (empty($projects)): ?>
            <p>Ve složce 'originals' nebyly nalezeny žádné projekty.</p>
        <?php else: ?>
            <nav>
                <ul>
                    <?php foreach ($projects as $project): ?>
                        <li class="<?= ($project === $selected_project) ? 'active' : '' ?>">
                            <a href="index.php?project=<?= urlencode($project) ?>">
                                📁 <?= htmlspecialchars($project) ?>
                            </a>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </nav>
        <?php endif; ?>
    </div>

    <?php if ($selected_project): ?>
        <div class="container actions-and-files">
            
            <div class="action-buttons">
                <form method="POST" action="index.php?project=<?= urlencode($selected_project) ?>" style="margin: 0;">
                    <input type="hidden" name="project_name" value="<?= htmlspecialchars($selected_project) ?>">
                    <button type="submit" name="save_project">💾 Uložit snímek</button>
                </form>
                <button type="button" id="start-analysis-btn">🔎 Spustit kontrolu syntaxe</button>
            </div>
            
            <hr>

            <div id="analysis-controls" style="display: none;">
                <div id="analysis-summary">
                    <span>Stav: <strong id="analysis-status">Připraven</strong></span>
                    <span>OK: <strong id="summary-ok">0</strong></span>
                    <span>Chyb: <strong id="summary-error">0</strong></span>
                    <span>Celkem: <strong id="summary-total">0</strong></span>
                </div>
                <div id="analysis-filters">
                    Zobrazit:
                    <button class="filter-btn active" data-filter="all">Vše</button>
                    <button class="filter-btn" data-filter="error">Pouze chyby</button>
                    <button class="filter-btn" data-filter="ok">Pouze OK</button>
                </div>
            </div>
            
            <div id="analysis-section">
                <div id="analysis-spinner" style="display: none;"></div>
                <div id="analysis-results">
                    </div>
            </div>

            <div id="file-list-data" style="display:none;">
                <?php foreach ($php_files as $file): ?>
                    <div class="file-item"><?= htmlspecialchars($file) ?></div>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endif; ?>

    <script>
        // Předáme data z PHP do JavaScriptu, pouze pokud je vybrán projekt
        const filesToLint = <?= !empty($php_files) ? json_encode(array_values($php_files)) : '[]'; ?>;
        const selectedProject = '<?= htmlspecialchars($selected_project ?? '') ?>';
    </script>
    <script src="app.js"></script>

</body>
</html>