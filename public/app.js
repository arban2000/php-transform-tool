document.addEventListener('DOMContentLoaded', () => {
    // ---- 1. Načtení všech potřebných HTML prvků ----
    const startButton = document.getElementById('start-analysis-btn');
    const startPhpstanButton = document.getElementById('start-phpstan-btn');
    const resultsDiv = document.getElementById('analysis-results');
    const controlsDiv = document.getElementById('analysis-controls');
    const statusSpan = document.getElementById('analysis-status');
    const spinner = document.getElementById('analysis-spinner');
    const summaryOk = document.getElementById('summary-ok');
    const summaryError = document.getElementById('summary-error');
    const summaryTotal = document.getElementById('summary-total');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const codeDisplayContainer = document.getElementById('code-display-container');
    const codeDisplayContent = document.getElementById('code-display-content');
    const codeDisplayFilename = document.getElementById('code-display-filename');
    const codeDisplayCloseBtn = document.getElementById('code-display-close-btn');
    const codeViewToggles = document.querySelectorAll('.code-view-btn');

    if (!startButton || !startPhpstanButton) return;

    // ---- 2. Přidání hlavních posluchačů událostí ----
    startButton.addEventListener('click', startSyntaxCheck);
    startPhpstanButton.addEventListener('click', startPhpstanAnalysis);
    codeDisplayCloseBtn.addEventListener('click', () => {
        codeDisplayContainer.style.display = 'none';
    });

    // ---- 3. Pomocné funkce pro ovládání UI ----
    
    function prepareUIForAnalysis(title) {
        resultsDiv.innerHTML = '';
        controlsDiv.style.display = 'flex';
        spinner.style.display = 'inline-block';
        statusSpan.textContent = title;
        startButton.disabled = true;
        startPhpstanButton.disabled = true;
        summaryOk.textContent = '0';
        summaryError.textContent = '0';
        summaryTotal.textContent = '0';
    }

    function finalizeUI(statusMessage) {
        spinner.style.display = 'none';
        startButton.disabled = false;
        startPhpstanButton.disabled = false;
        statusSpan.textContent = statusMessage;
    }

    // ---- 4. Logika pro kontrolu syntaxe (Linter) ----

    function startSyntaxCheck() {
        if (typeof filesToLint === 'undefined' || filesToLint.length === 0) {
            resultsDiv.innerHTML = '<p>Nenalezeny žádné soubory k analýze.</p>';
            return;
        }
        prepareUIForAnalysis('Probíhá kontrola syntaxe...');
        
        let currentIndex = 0;
        let errorCount = 0;
        summaryTotal.textContent = filesToLint.length;

        async function checkNextFile() {
            if (currentIndex >= filesToLint.length) {
                finalizeUI(`Kontrola syntaxe hotova! Nalezeno ${errorCount} chyb.`);
                return;
            }
            statusSpan.textContent = `Kontroluji ${currentIndex + 1} / ${filesToLint.length}...`;
            const file = filesToLint[currentIndex];
            const formData = new FormData();
            formData.append('project', selectedProject);
            formData.append('file', file);
            try {
                const response = await fetch('../api/linter.php', { method: 'POST', body: formData });
                const result = await response.json();
                if (result.status === 'error') errorCount++;
                summaryError.textContent = errorCount;
                summaryOk.textContent = (currentIndex + 1) - errorCount;
                updateLinterUI(result);
            } catch (error) {
                errorCount++;
                summaryError.textContent = errorCount;
                updateLinterUI({ status: 'error', file: file, message: `Chyba komunikace: ${error.message}` });
            }
            currentIndex++;
            checkNextFile();
        }
        checkNextFile();
    }

    function updateLinterUI(result) {
        const resultItem = document.createElement('div');
        const file = result.file;
        let lineNumber = '';
        const match = result.message ? result.message.match(/on line (\d+)/) : null;
        if (match) lineNumber = match[1];

        if (result.status === 'ok') {
            resultItem.className = 'result-ok';
            resultItem.innerHTML = `✅ <strong>OK:</strong> ${file}`;
        } else {
            resultItem.className = 'result-error';
            resultItem.innerHTML = `<div class="error-header"><span>❌ <strong>Chyba:</strong> ${file}</span><a href="#" class="view-code-btn" data-project="${selectedProject}" data-file="${file}" data-line="${lineNumber}">Zobrazit kód</a></div><pre class="error-message-preview">${result.message}</pre>`;
        }
        resultsDiv.appendChild(resultItem);
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }

    // ---- 5. Logika pro hloubkovou analýzu (PHPStan) ----
    
    async function startPhpstanAnalysis() {
        prepareUIForAnalysis('Spouštím hloubkovou analýzu, prosím čekejte...');
        
        const formData = new FormData();
        formData.append('project', selectedProject);

        try {
            const response = await fetch('../api/phpstan_analyzer.php', { method: 'POST', body: formData });
            const result = await response.json();
            
            resultsDiv.innerHTML = '';

            // ==========================================================
            // ZDE JE KLÍČOVÁ OPRAVA:
            // Nejdříve zkontrolujeme, zda PHPStan vrátil platný výstup s klíčem 'totals'.
            // ==========================================================
            if (result.totals) {
                // PHPStan proběhl v pořádku, zpracujeme normální výstup
                summaryError.textContent = result.totals.file_errors;
                summaryOk.textContent = 'N/A';
                summaryTotal.textContent = result.totals.files || 'N/A';

                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(error => updatePhpstanUI(error));
                } else {
                    resultsDiv.innerHTML = '<div class="result-ok">✅ Hloubková analýza dokončena. Nebyly nalezeny žádné chyby!</div>';
                }
                finalizeUI(`Hloubková analýza dokončena! Nalezeno ${result.totals.file_errors} chyb.`);

            } else if (result.errors && result.errors.length > 0) {
                // Pokud 'totals' neexistuje, znamená to, že PHPStan sám o sobě selhal
                // a poslal nám vlastní chybovou hlášku.
                summaryError.textContent = 'N/A';
                summaryOk.textContent = 'N/A';
                summaryTotal.textContent = 'N/A';
                resultsDiv.innerHTML = `<div class="result-error"><pre>${result.errors[0].message}</pre></div>`;
                finalizeUI('Hloubková analýza selhala s kritickou chybou.');

            } else {
                // Neočekávaná chyba
                resultsDiv.innerHTML = `<div class="result-error"><pre>Obdržena neznámá odpověď ze serveru.</pre></div>`;
                finalizeUI('Hloubková analýza selhala.');
            }

        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-error"><pre>Nastala kritická chyba při komunikaci se serverem: ${error.message}</pre></div>`;
            finalizeUI('Hloubková analýza selhala.');
        }
    }

    function updatePhpstanUI(error) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-error';
        resultItem.innerHTML = `<div class="error-header"><span>🔬 <strong>PHPStan:</strong> ${error.file} (ř. ${error.line || 'N/A'})</span><a href="#" class="view-code-btn" data-project="${selectedProject}" data-file="${error.file}" data-line="${error.line || ''}">Zobrazit kód</a></div><pre class="error-message-preview">${error.message}</pre>`;
        resultsDiv.appendChild(resultItem);
    }

    // ---- 6. Logika pro zobrazení kódu a filtry ----
    // Tento kód se nemění
    
    resultsDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('view-code-btn')) {
            event.preventDefault();
            const button = event.target;
            const project = button.dataset.project;
            const file = button.dataset.file;
            const line = button.dataset.line;
            button.textContent = 'Načítám...';
            button.disabled = true;
            try {
                const formData = new FormData();
                formData.append('project', project);
                formData.append('file', file);
                const response = await fetch('../api/get_file_content.php', { method: 'POST', body: formData });
                const data = await response.json();
                if (data.status === 'ok') {
                    codeDisplayFilename.textContent = file;
                    const codeBlock = document.createElement('code');
                    codeBlock.className = 'language-php';
                    codeBlock.textContent = data.content;
                    hljs.highlightElement(codeBlock);
                    const finalHtml = addLineNumbersAndHighlight(codeBlock.innerHTML, line);
                    codeDisplayContent.innerHTML = `<pre><table><tbody>${finalHtml}</tbody></table></pre>`;
                    codeDisplayContainer.dataset.view = 'context';
                    document.querySelector('.code-view-btn[data-view="context"]').classList.add('active');
                    document.querySelector('.code-view-btn[data-view="full"]').classList.remove('active');
                    codeDisplayContainer.style.display = 'block';
                    codeDisplayContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    alert('Chyba načtení souboru: ' + data.message);
                }
            } catch (error) {
                alert('Chyba komunikace se serverem.');
                console.error("Chyba při zobrazování kódu:", error);
            } finally {
                button.textContent = 'Zobrazit kód';
                button.disabled = false;
            }
        }
    });

    function addLineNumbersAndHighlight(highlightedHtml, lineToHighlight) {
        const lines = highlightedHtml.split('\n');
        const contextLines = 5;
        let numberedHtml = '';
        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            const isHighlighted = (lineNumber == lineToHighlight);
            const isInContext = (lineNumber >= lineToHighlight - contextLines && lineNumber <= parseInt(lineToHighlight) + contextLines);
            const lineContent = lines[i] || '&nbsp;';
            let rowClass = '';
            if(isHighlighted) rowClass = 'highlight-line';
            if(isInContext) rowClass += ' in-context';
            numberedHtml += `<tr class="${rowClass.trim()}" data-line-number="${lineNumber}"><td class="line-number">${lineNumber}</td><td class="line-code">${lineContent}</td></tr>`;
        }
        return numberedHtml;
    }

    codeViewToggles.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            codeViewToggles.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const view = button.dataset.view;
            codeDisplayContainer.dataset.view = view;
        });
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.dataset.filter;
            const allResults = resultsDiv.querySelectorAll('.result-ok, .result-error');
            allResults.forEach(result => {
                if (filter === 'all') { result.style.display = 'block'; }
                else if (filter === 'ok') { result.style.display = result.classList.contains('result-ok') ? 'block' : 'none'; }
                else if (filter === 'error') { result.style.display = result.classList.contains('result-error') ? 'block' : 'none'; }
            });
        });
    });
});