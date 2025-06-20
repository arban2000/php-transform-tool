// public/app.js

// Počkáme, až se načte celá HTML stránka
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-analysis-btn');
    const resultsDiv = document.getElementById('analysis-results');
    const progressStatus = document.getElementById('analysis-status');
    const spinner = document.getElementById('analysis-spinner');

    // Pokud na stránce není tlačítko, nic neděláme
    if (!startButton) {
        return;
    }

    // Přidáme posluchač události na kliknutí tlačítka
    startButton.addEventListener('click', () => {
        // Zkontrolujeme, zda jsou data (soubory k analýze) dostupná
        if (typeof filesToLint === 'undefined' || filesToLint.length === 0) {
            resultsDiv.innerHTML = '<p>Nenalezeny žádné soubory k analýze.</p>';
            return;
        }
        startSyntaxCheck();
    });

    let currentIndex = 0;
    let errorCount = 0;

    // Hlavní funkce, která spustí celý proces
    function startSyntaxCheck() {
        // Resetujeme a připravíme rozhraní
        currentIndex = 0;
        errorCount = 0;
        resultsDiv.innerHTML = '';
        spinner.style.display = 'block';
        startButton.disabled = true;

        // Spustíme kontrolu prvního souboru
        checkNextFile();
    }

    // Funkce, která rekurzivně volá sama sebe a zpracovává soubor po souboru
    async function checkNextFile() {
        // Aktualizujeme stav
        progressStatus.textContent = `Kontroluji ${currentIndex + 1} / ${filesToLint.length}...`;

        // Pokud už nejsou další soubory, ukončíme proces
        if (currentIndex >= filesToLint.length) {
            spinner.style.display = 'none';
            startButton.disabled = false;
            progressStatus.textContent = `Hotovo! Zkontrolováno ${filesToLint.length} souborů. Nalezeno ${errorCount} chyb.`;
            return;
        }

        const file = filesToLint[currentIndex];
        
        // Vytvoříme data pro odeslání na server
        const formData = new FormData();
        formData.append('project', selectedProject);
        formData.append('file', file);
        
        try {
            // Pošleme asynchronní požadavek na náš PHP skript
            const response = await fetch('../api/linter.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            // Zpracujeme odpověď a aktualizujeme stránku
            updateUI(result);

        } catch (error) {
            // Zpracování chyby sítě atp.
            updateUI({ status: 'error', file: file, message: `Chyba komunikace se serverem: ${error.message}` });
        }
        
        // Posuneme se na další soubor a zavoláme funkci znovu
        currentIndex++;
        checkNextFile();
    }
    
    // Funkce pro aktualizaci uživatelského rozhraní
    function updateUI(result) {
        const resultItem = document.createElement('div');
        if (result.status === 'ok') {
            resultItem.className = 'result-ok';
            resultItem.innerHTML = `✅ <strong>OK:</strong> ${result.file}`;
        } else {
            errorCount++;
            resultItem.className = 'result-error';
            resultItem.innerHTML = `❌ <strong>Chyba:</strong> ${result.file}<pre>${result.message}</pre>`;
        }
        resultsDiv.appendChild(resultItem);
        // Automaticky scrollujeme dolů, abychom viděli nejnovější výsledky
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }
});