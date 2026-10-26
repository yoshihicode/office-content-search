// 検索フォーム（Webview の中で動く JavaScript）
(function () {
    // VS Code との通信口。1つのページで1回しか取得できない
    const vscode = acquireVsCodeApi();

    const form = document.getElementById('form');
    const query = document.getElementById('query');
    const folder = document.getElementById('folder');
    const recursive = document.getElementById('recursive');
    const outputText = document.getElementById('outputText');
    const error = document.getElementById('error');
    const searchButton = document.getElementById('search');
    const cancelButton = document.getElementById('cancel');

    const selectedMode = () => document.querySelector('input[name="mode"]:checked').value;
    const appBoxes = () => Array.from(document.querySelectorAll('input[name="app"]'));
    const selectedApps = () => appBoxes().filter((el) => el.checked).map((el) => el.value);

    // 入力内容の保存と復元
    function saveState() {
        vscode.setState({
            query: query.value,
            folder: folder.value,
            recursive: recursive.checked,
            outputText: outputText.checked,
            apps: selectedApps(),
            mode: selectedMode(),
        });
    }
    const state = vscode.getState();
    if (state) {
        query.value = state.query ?? '';
        folder.value = state.folder ?? '';
        recursive.checked = state.recursive ?? true;
        outputText.checked = state.outputText ?? false;
        const radio = document.querySelector(`input[name="mode"][value="${state.mode}"]`);
        if (radio) radio.checked = true;
        // 保存された値のうち、今のチェックボックスにあるものだけを使う。
        // 以前の版で保存した値（'xlsx' などの拡張子）しかなければ、既定（すべてチェック）のままにする
        const saved = Array.isArray(state.apps) ? state.apps : [];
        if (appBoxes().some((el) => saved.includes(el.value))) {
            appBoxes().forEach((el) => (el.checked = saved.includes(el.value)));
        }
    }
    form.addEventListener('input', saveState);
    form.addEventListener('change', saveState);

    // --- 画面の操作 → 拡張機能へ ---
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // フォームの送信（ページの再読み込み）を止める
        error.textContent = '';
        vscode.postMessage({
            type: 'search',
            query: query.value,
            mode: selectedMode(),
            folder: folder.value.trim(),
            recursive: recursive.checked,
            outputText: outputText.checked,
            apps: selectedApps(),
        });
    });
    document.getElementById('browse').addEventListener('click', () => vscode.postMessage({ type: 'browse' }));
    cancelButton.addEventListener('click', () => vscode.postMessage({ type: 'cancel' }));

    // --- 拡張機能 → 画面へ ---
    window.addEventListener('message', (event) => {
        const msg = event.data;
        switch (msg.type) {
            case 'defaults':
                // 保存済みの入力がなければ、設定の既定値を使う
                if (!state) recursive.checked = msg.recursive;
                break;
            case 'setFolder':
                // 入力済みのフォルダがあれば、初期値（ワークスペースのフォルダ）では上書きしない
                if (!(msg.initial && folder.value)) folder.value = msg.folder;
                saveState();
                break;
            case 'running':
                searchButton.disabled = msg.running;
                cancelButton.hidden = !msg.running;
                break;
            case 'error':
                error.textContent = msg.message;
                break;
        }
    });

    // 準備ができたことを拡張機能に伝える（初期値を送ってもらう）
    vscode.postMessage({ type: 'ready' });
    if (!query.value) query.focus();
})();
