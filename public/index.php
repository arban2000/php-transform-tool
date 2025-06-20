<?php
// public/index.php

require_once __DIR__ . '/../src/config.php';
require_once __DIR__ . '/../src/functions.php';

$message = '';

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

// --- Načtení dat pro zobrazení ---
$projects = get_projects();
$selected_project = $_GET['project'] ?? null;
$php_files = [];
if ($selected_project && in_array($selected_project, $projects)) {
    $php_files = get_php_files($selected_project);
}

// Vždy načteme historii commitů pro zobrazení
$git_log = get_git_log();

?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <title>Transformační Nástroj</title>
    <link rel="stylesheet" href="style.css">
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
                    <?php foreach ($git_log as $index => $commit): ?>
                        <tr>
                            <td><code><?= htmlspecialchars($commit['hash']) ?></code></td>
                            <td><?= htmlspecialchars($commit['message']) ?></td>
                            <td><?= htmlspecialchars($commit['date']) ?></td>
                            <td>
                                <?php if ($index > 0): // Tlačítko nezobrazujeme pro úplně nejnovější verzi ?>
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
        <div class="container file-viewer">
            <h2>PHP soubory v projektu: <?= htmlspecialchars($selected_project) ?></h2>
            <p>Nalezeno souborů: <?= count($php_files) ?></p>
            <div class="file-list">
                <?php foreach ($php_files as $file): ?>
                    <code><?= htmlspecialchars($file) ?></code><br>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endif; ?>

</body>
</html>