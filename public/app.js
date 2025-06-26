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
    const workspaceAnalysisBtn = document.getElementById('workspace-analysis-btn');
    const workspacePhpstanBtn = document.getElementById('workspace-phpstan-btn');
	let currentWorkspacePath = null;

    // ---- 2. Přidání hlavních posluchačů událostí ----
    if (startButton) startButton.addEventListener('click', startSyntaxCheck);
    if (startPhpstanButton) startPhpstanButton.addEventListener('click', startPhpstanAnalysis);
	if (startTransformButton) startTransformButton.addEventListener('click', startTransformation);
    if (workspaceAnalysisBtn) workspaceAnalysisBtn.addEventListener('click', startWorkspaceSyntaxCheck);
    if (workspacePhpstanBtn) workspacePhpstanBtn.addEventListener('click', startWorkspacePhpstanAnalysis);
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
        let file = result.file;
        let lineNumber = '';
        const match = result.message ? result.message.match(/on line (\d+)/) : null;
        if (match) lineNumber = match[1];

        // Oprava: pokud je aktivní pracovní kopie, vždy použij pouze relativní cestu (odstraň případné absolutní prefixy)
        if (currentWorkspacePath && file) {
            // Odstraň absolutní prefix workspace_path, pokud je v cestě
            file = file.replace(/^.*workspaces\/[^/]+\//, '');
        }

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
        let file = error.file;
        // Oprava: pokud je aktivní pracovní kopie, vždy použij pouze relativní cestu
        if (currentWorkspacePath && file) {
            file = file.replace(/^.*workspaces\/[^/]+\//, '');
        }
        resultItem.className = 'result-error';
        resultItem.innerHTML = `<div class="error-header"><span>🔬 <strong>PHPStan:</strong> ${file} (ř. ${error.line || 'N/A'})</span><a href="#" class="view-code-btn" data-project="${selectedProject}" data-file="${file}" data-line="${error.line || ''}">Zobrazit kód</a></div><pre class="error-message-preview">${error.message}</pre>`;
        resultsDiv.appendChild(resultItem);
    }

    // ---- 6. Logika pro zobrazení kódu a filtry ----
    resultsDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('view-code-btn')) {
            event.preventDefault();
            const button = event.target;
            const project = button.dataset.project;
            let file = button.dataset.file;
            const line = button.dataset.line;
            button.textContent = 'Načítám...';
            button.disabled = true;
            try {
                const formData = new FormData();
                // Očisti cestu k souboru (odstraň počáteční lomítka a redundantní znaky)
                file = file.replace(/^\/+/, '').replace(/^\.\//, '');
                // Pokud je workspace_path, neposílej project
                if (currentWorkspacePath) {
                    formData.append('workspace_path', currentWorkspacePath);
                    formData.append('file', file);
                } else {
                    formData.append('project', project);
                    formData.append('file', file);
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
                    // Zobrazíme error přímo do codeDisplayContent
                    codeDisplayFilename.textContent = file;
                    codeDisplayContent.innerHTML = `
                        <div class="result-error">
                            <strong>Chyba načtení souboru:</strong>
                            <pre class="error-message-preview">${data.message ? data.message : 'Neznámá chyba.'}</pre>
                            ${data.debug ? `<details style="margin-top:8px;"><summary>Debug info</summary><pre style="font-size:0.85em;white-space:pre-wrap;">${data.debug}</pre></details>` : ''}
                        </div>
                    `;
                    codeDisplayContainer.style.display = 'block';
                    codeDisplayContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (error) {
                codeDisplayFilename.textContent = file;
                codeDisplayContent.innerHTML = `
                    <div class="result-error">
                        <strong>Chyba komunikace se serverem:</strong>
                        <pre class="error-message-preview">${error.message}</pre>
                    </div>
                `;
                codeDisplayContainer.style.display = 'block';
                codeDisplayContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        if (!confirm('Opravdu chcete spustit transformaci? Bude vytvořena nová pracovní kopie.')) {
            return;
        }

        prepareUIForAnalysis('Spouštím transformaci...');
        
        const formData = new FormData();
        formData.append('project', selectedProject);

        try {
            const response = await fetch('../api/transformer.php', { method: 'POST', body: formData });
            const result = await response.json();

            if (result.status === 'ok') {
                resultsDiv.innerHTML = '';

                // 1. Zobrazíme souhrn transformace
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'result-ok';
                summaryDiv.innerHTML = `
                    ✅ Transformace dokončena!<br>
                    Aplikováno pravidel: <strong>${result.transform_summary.applied_rules_count}</strong><br>
                    Změněno souborů: <strong>${result.transform_summary.files_changed}</strong><br>
                    Pracovní kopie: <code>${result.workspace_path}</code>
                `;
                resultsDiv.appendChild(summaryDiv);
               // Přidáme log z aktualizace knihoven, pokud existuje
              	if (result.library_update_summary && result.library_update_summary.log) {
                	const logDiv = document.createElement('div');
                	logDiv.className = 'update-log';
                	logDiv.innerHTML = `
                    	<h4>Log aktualizace knihoven:</h4>
                    	<pre>${result.library_update_summary.log}</pre>
                	`;
               		resultsDiv.appendChild(logDiv);
            	}

                currentWorkspacePath = result.workspace_path;

                // 2. Zobrazíme nová tlačítka pro analýzu pracovní kopie
                if (workspaceAnalysisBtn && workspacePhpstanBtn) {
                    workspaceAnalysisBtn.style.display = '';
                    workspacePhpstanBtn.style.display = '';
                }

                finalizeUI('Transformace dokončena. Proveďte kontrolu pracovní kopie.');
            } else {
                resultsDiv.innerHTML = `<div class="result-error"><pre>${result.message}</pre></div>`;
                finalizeUI('Transformace selhala.');
            }

        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-error"><pre>Nastala kritická chyba při komunikaci se serverem: ${error.message}</pre></div>`;
            finalizeUI('Transformace selhala.');
        }
    }

    // ---- NOVÉ: Kontrola syntaxe pracovní kopie ----
    async function startWorkspaceSyntaxCheck() {
        if (!currentWorkspacePath) {
            alert('Pracovní kopie není k dispozici.');
            return;
        }
        prepareUIForAnalysis('Kontrola syntaxe pracovní kopie...');
        // Backend endpoint pro workspace linter (nový nebo upravený linter.php)
        const formData = new FormData();
        formData.append('workspace_path', currentWorkspacePath);
        formData.append('project', selectedProject);

        try {
            const response = await fetch('../api/linter.php', { method: 'POST', body: formData });
            const result = await response.json();
            resultsDiv.innerHTML = '';
            if (Array.isArray(result)) {
                let errorCount = 0;
                result.forEach(item => {
                    updateLinterUI(item);
                    if (item.status === 'error') errorCount++;
                });
                summaryError.textContent = errorCount;
                summaryOk.textContent = result.length - errorCount;
                summaryTotal.textContent = result.length;
                finalizeUI('Kontrola pracovní kopie dokončena.');
            } else if (result.status === 'ok') {
                resultsDiv.innerHTML = '<div class="result-ok">✅ Nebyly nalezeny žádné chyby v pracovní kopii.</div>';
                summaryError.textContent = '0';
                summaryOk.textContent = '1';
                summaryTotal.textContent = '1';
                finalizeUI('Kontrola pracovní kopie dokončena.');
            } else {
                resultsDiv.innerHTML = `<div class="result-error"><pre>${result.message}</pre></div>`;
                finalizeUI('Kontrola pracovní kopie selhala.');
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-error"><pre>Chyba komunikace: ${error.message}</pre></div>`;
            finalizeUI('Kontrola pracovní kopie selhala.');
        }
    }

    // ---- NOVÉ: Hloubková analýza pracovní kopie ----
    async function startWorkspacePhpstanAnalysis() {
        if (!currentWorkspacePath) {
            alert('Pracovní kopie není k dispozici.');
            return;
        }
        prepareUIForAnalysis('Hloubková analýza pracovní kopie...');
        const formData = new FormData();
        formData.append('workspace_path', currentWorkspacePath);
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
                    resultsDiv.innerHTML = '<div class="result-ok">✅ Hloubková analýza pracovní kopie dokončena. Nebyly nalezeny žádné chyby!</div>';
                }
                finalizeUI(`Hloubková analýza pracovní kopie dokončena! Nalezeno ${result.totals.file_errors} chyb.`);
            } else if (result.errors && result.errors.length > 0) {
                summaryError.textContent = 'N/A';
                summaryOk.textContent = 'N/A';
                summaryTotal.textContent = 'N/A';
                resultsDiv.innerHTML = `<div class="result-error"><pre>${result.errors[0].message}</pre></div>`;
                finalizeUI('Hloubková analýza pracovní kopie selhala s kritickou chybou.');
            } else {
                resultsDiv.innerHTML = `<div class="result-error"><pre>Obdržena neznámá odpověď ze serveru.</pre></div>`;
                finalizeUI('Hloubková analýza pracovní kopie selhala.');
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-error"><pre>Chyba komunikace: ${error.message}</pre></div>`;
            finalizeUI('Hloubková analýza pracovní kopie selhala.');
        }
    }
});