// public/app.js

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
    const addRuleBtn = document.getElementById('add-rule-btn');
    const rulesTbody = document.getElementById('rules-tbody');
	const startTransformButton = document.getElementById('start-transform-btn');
	let currentWorkspacePath = null;

    // ---- 2. Přidání hlavních posluchačů událostí ----
    if (startButton) startButton.addEventListener('click', startSyntaxCheck);
    if (startPhpstanButton) startPhpstanButton.addEventListener('click', startPhpstanAnalysis);
	if (startTransformButton) startTransformButton.addEventListener('click', startTransformation);
    if (codeDisplayCloseBtn) codeDisplayCloseBtn.addEventListener('click', () => {
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
            
            if (result.totals) {
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
                summaryError.textContent = 'N/A';
                summaryOk.textContent = 'N/A';
                summaryTotal.textContent = 'N/A';
                resultsDiv.innerHTML = `<div class="result-error"><pre>${result.errors[0].message}</pre></div>`;
                finalizeUI('Hloubková analýza selhala s kritickou chybou.');
            } else {
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
                if (currentWorkspacePath) {
                    formData.append('workspace_path', currentWorkspacePath);
                }
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

    // ---- 7. Logika pro editor transformačních pravidel ----
    if (addRuleBtn && rulesTbody) {
        addRuleBtn.addEventListener('click', () => {
            const noRulesRow = document.getElementById('no-rules-row');
            if (noRulesRow) {
                noRulesRow.remove();
            }
            const newIndex = rulesTbody.getElementsByTagName('tr').length;
            const newRow = rulesTbody.insertRow();
            newRow.innerHTML = `
                <td class="col-enabled"><input type="checkbox" name="rules[${newIndex}][enabled]" checked></td>
                <td class="col-order"><input type="number" class="order-input" name="rules[${newIndex}][order]" value="${(newIndex + 1) * 10}"></td>
                <td class="col-desc"><textarea name="rules[${newIndex}][description]" rows="2"></textarea></td>
                <td class="col-find"><textarea name="rules[${newIndex}][find]" rows="2"></textarea></td>
                <td class="col-replace"><textarea name="rules[${newIndex}][replace]" rows="2"></textarea></td>
                <td class="col-actions"><button type="button" class="remove-rule-btn">Odstranit</button></td>
            `;
        });
        rulesTbody.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-rule-btn')) {
                event.target.closest('tr').remove();
                if (rulesTbody.getElementsByTagName('tr').length === 0) {
                    const noRulesRow = rulesTbody.insertRow();
                    noRulesRow.id = 'no-rules-row';
                    noRulesRow.innerHTML = '<td colspan="6">Zatím nebyla vytvořena žádná pravidla. Začněte kliknutím na "Přidat pravidlo".</td>';
                }
            }
        });
    }
    // ---- NOVÁ SEKCE: SPUŠTĚNÍ TRANSFORMACE ----
    async function startTransformation() {
        if (!confirm('Opravdu chcete spustit transformaci? Bude vytvořena nová pracovní kopie projektu a poté spuštěna kontrola syntaxe.')) {
            return;
        }

        prepareUIForAnalysis('Spouštím transformaci a následnou analýzu...');
        
        const formData = new FormData();
        formData.append('project', selectedProject);

        try {
            const response = await fetch('../api/transformer.php', { method: 'POST', body: formData });
            const result = await response.json();

            if (result.status === 'ok') {
                // Vyčistíme staré výsledky
                resultsDiv.innerHTML = '';
				currentWorkspacePath = result.workspace_path; // Uložíme si cestu pro budoucí použití
                // Zobrazíme souhrn transformace
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'result-ok';
                summaryDiv.innerHTML = `
                    ✅ Transformace dokončena!<br>
                    Aplikováno pravidel: <strong>${result.transform_summary.applied_rules_count}</strong><br>
                    Změněno souborů: <strong>${result.transform_summary.files_changed}</strong><br>
                    Pracovní kopie vytvořena v: <code>${result.workspace_path}</code>
                `;
                resultsDiv.appendChild(summaryDiv);

                // Zobrazíme výsledky následné kontroly syntaxe
                if (result.syntax_errors && result.syntax_errors.length > 0) {
                    summaryError.textContent = result.syntax_errors.length;
                    result.syntax_errors.forEach(error => updateLinterUI(error));
                } else {
                    summaryError.textContent = '0';
                    resultsDiv.innerHTML += '<div class="result-ok" style="margin-top: 15px;">✅ Následná kontrola syntaxe nenašla žádné chyby! Projekt by měl být v pořádku.</div>';
                }
                
                finalizeUI('Proces dokončen.');

            } else {
                resultsDiv.innerHTML = `<div class="result-error"><pre>${result.message}</pre></div>`;
                finalizeUI('Transformace selhala.');
            }

        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-error"><pre>Nastala kritická chyba při komunikaci se serverem: ${error.message}</pre></div>`;
            finalizeUI('Transformace selhala.');
        }
    }
});