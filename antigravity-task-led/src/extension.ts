import * as vscode from 'vscode';
import * as https from 'https';
import { CdpMonitor } from './cdpMonitor';
import { t, initLanguage, setLanguage, getLanguage } from './i18n';

let statusBarItem: vscode.StatusBarItem;
let isEnabled = true;
let cdpMonitor: CdpMonitor | null = null;
let outputChannel: vscode.OutputChannel;

function log(msg: string) {
    if (outputChannel) {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${msg}`);
    }
}

// 获取当前窗口标识，用于多窗口 CDP target 匹配
function getWindowTitle(): string {
    return vscode.workspace.name || '';
}

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Antigravity Task LED');
    context.subscriptions.push(outputChannel);

    // 初始化语言
    initLanguage();
    
    log('Antigravity Task LED v1.0.0 is now active!');

    // 读取初始设置
    const config = vscode.workspace.getConfiguration('antigravityTaskLed');
    isEnabled = config.get<boolean>('enabled', true);
    const cdpPort = config.get<number>('cdpPort', 9000);
    const cdpEnabled = config.get<boolean>('cdpEnabled', true);

    // 创建状态栏按钮
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'antigravityTaskLed.showMenu';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // ======== 核心：向巴法云推送数据的方法 ========
    function publishLedCommand(cmd: string) {
        const ledConfig = vscode.workspace.getConfiguration('antigravityTaskLed');
        const linkageEnabled = ledConfig.get<boolean>('enabled', true);
        if (!linkageEnabled) {
            log(`[LED] 联动被禁用，跳过下发指令: ${cmd}`);
            return;
        }

        const uid = ledConfig.get<string>('bemfaUid', '');
        const topic = ledConfig.get<string>('bemfaTopic', '');

        if (!uid || !topic) {
            log(`[LED] 错误: 巴法云 UID (${uid ? '已填' : '未填'}) 或 Topic (${topic ? '已填' : '未填'}) 未配置。请进入插件设置进行完善。`);
            vscode.window.showWarningMessage('⚠️ Antigravity Task LED: 巴法云 UID 或 Topic 未配置！');
            return;
        }

        // 构造巴法云最新官方高可用消息推送网关接口 URL (使用 apis.bemfa.com 且 type=1 对应 MQTT 设备)
        const url = `https://apis.bemfa.com/va/sendMessage?uid=${uid}&topic=${topic}&type=1&msg=${encodeURIComponent(cmd)}`;

        log(`[LED] 正在向巴法云推送模式指令 [ ${cmd} ]...`);

        https.get(url, (res) => {
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                log(`[LED] 巴法云接收反馈: ${rawData.trim()}`);
                // 若发布成功，状态栏做一次闪烁提醒以增强 UX 物理仪式感
                flashStatusText(`✨ LED: ${cmd} Sent`);
            });
        }).on('error', (e) => {
            log(`[LED] 通信异常: ${e.message}`);
            vscode.window.showErrorMessage(`❌ 联动失败: ${e.message}`);
        });
    }

    // ======== 核心：根据 AI 状态进行灯语下发 ========
    function handleAiStateChange(state: 'generating' | 'success' | 'error') {
        const ledConfig = vscode.workspace.getConfiguration('antigravityTaskLed');
        if (state === 'generating') {
            const cmd = ledConfig.get<string>('modeGenerating', '10');
            log(`[STATE] AI 开始思考，下发思考灯语...`);
            publishLedCommand(cmd);
        } else if (state === 'success') {
            const cmd = ledConfig.get<string>('modeSuccess', '16');
            log(`[STATE] AI 任务成功完成，下发完成灯语...`);
            publishLedCommand(cmd);
            vscode.window.showInformationMessage(t('msg.taskComplete'));
        } else if (state === 'error') {
            const cmd = ledConfig.get<string>('modeError', '5');
            log(`[STATE] 出现异常，下发错误警示灯语...`);
            publishLedCommand(cmd);
        }
    }

    // ======== 命令注册 ========

    // 快捷设置菜单
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravityTaskLed.showMenu', async () => {
            const currentConfig = vscode.workspace.getConfiguration('antigravityTaskLed');
            const currentUid = currentConfig.get<string>('bemfaUid', '');
            const currentTopic = currentConfig.get<string>('bemfaTopic', '');
            const cdpStatus = cdpMonitor?.isConnected() ? t('cdp.statusConnected') : t('cdp.statusDisconnected');
            const lang = getLanguage();

            const items: vscode.QuickPickItem[] = [
                {
                    label: isEnabled ? `$(bell-slash) ${t('menu.ledOff')}` : `$(bell) ${t('menu.ledOn')}`,
                    description: `${isEnabled ? t('menu.currentOn') : t('menu.currentOff')}`,
                },
                {
                    label: `$(play) ${t('menu.testLed')}`,
                    description: t('menu.testLedDesc'),
                },
                {
                    label: `$(key) ${t('menu.configureUid')}`,
                    description: currentUid ? `${currentUid.substring(0, 8)}***` : t('menu.configureUidDesc'),
                },
                {
                    label: `$(radio-tower) ${t('menu.configureTopic')}`,
                    description: currentTopic || t('menu.configureTopicDesc'),
                },
                {
                    label: `$(plug) ${t('menu.cdpConnect')}`,
                    description: cdpStatus,
                },
                {
                    label: `$(symbol-color) 配置生成中灯语 (modeGenerating)`,
                    description: `当前: ${currentConfig.get<string>('modeGenerating', '10')}`,
                },
                {
                    label: `$(check) 配置完成灯语 (modeSuccess)`,
                    description: `当前: ${currentConfig.get<string>('modeSuccess', '16')}`,
                },
                {
                    label: `$(error) 配置出错灯语 (modeError)`,
                    description: `当前: ${currentConfig.get<string>('modeError', '5')}`,
                },
                {
                    label: `$(globe) ${t('menu.language')}`,
                    description: lang === 'zh-CN' ? t('menu.languageDesc.zh') : t('menu.languageDesc.en'),
                },
            ];

            const selected = await vscode.window.showQuickPick(items, {
                title: t('menu.title'),
                placeHolder: t('menu.placeholder'),
            });

            if (!selected) { return; }

            const label = selected.label;

            if (label.includes('bell-slash') || label.includes('bell)')) {
                isEnabled = !isEnabled;
                await currentConfig.update('enabled', isEnabled, vscode.ConfigurationTarget.Global);
                updateStatusBar();
                vscode.window.showInformationMessage(
                    isEnabled ? t('msg.ledEnabled') : t('msg.ledDisabled')
                );
            } else if (label.includes('play')) {
                await showLedTesterQuickPick();
            } else if (label.includes('key')) {
                const inputUid = await vscode.window.showInputBox({
                    title: t('menu.configureUid'),
                    placeHolder: '输入您的巴法云私钥 (UID)',
                    value: currentUid,
                    ignoreFocusOut: true,
                });
                if (inputUid !== undefined) {
                    await currentConfig.update('bemfaUid', inputUid.trim(), vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(t('msg.uidChanged'));
                }
            } else if (label.includes('radio-tower')) {
                const inputTopic = await vscode.window.showInputBox({
                    title: t('menu.configureTopic'),
                    placeHolder: '输入绑定的设备主题 (如 your_topic002)',
                    value: currentTopic,
                    ignoreFocusOut: true,
                });
                if (inputTopic !== undefined) {
                    await currentConfig.update('bemfaTopic', inputTopic.trim(), vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(t('msg.topicChanged'));
                }
            } else if (label.includes('symbol-color')) {
                const inputMode = await vscode.window.showInputBox({
                    title: '配置生成中灯语 (modeGenerating)',
                    placeHolder: '输入灯语命令编号（0-18），如 10',
                    value: currentConfig.get<string>('modeGenerating', '10'),
                    ignoreFocusOut: true,
                    validateInput: (v) => (parseInt(v) >= 0 && parseInt(v) <= 18) ? null : '请输入 0-18 之间的整数',
                });
                if (inputMode !== undefined) {
                    await currentConfig.update('modeGenerating', inputMode.trim(), vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`✅ 生成中灯语已更新为: ${inputMode.trim()}`);
                }
            } else if (label.includes('check')) {
                const inputMode = await vscode.window.showInputBox({
                    title: '配置完成灯语 (modeSuccess)',
                    placeHolder: '输入灯语命令编号（0-18），如 16',
                    value: currentConfig.get<string>('modeSuccess', '16'),
                    ignoreFocusOut: true,
                    validateInput: (v) => (parseInt(v) >= 0 && parseInt(v) <= 18) ? null : '请输入 0-18 之间的整数',
                });
                if (inputMode !== undefined) {
                    await currentConfig.update('modeSuccess', inputMode.trim(), vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`✅ 完成灯语已更新为: ${inputMode.trim()}`);
                }
            } else if (label.includes('error')) {
                const inputMode = await vscode.window.showInputBox({
                    title: '配置出错灯语 (modeError)',
                    placeHolder: '输入灯语命令编号（0-18），如 5',
                    value: currentConfig.get<string>('modeError', '5'),
                    ignoreFocusOut: true,
                    validateInput: (v) => (parseInt(v) >= 0 && parseInt(v) <= 18) ? null : '请输入 0-18 之间的整数',
                });
                if (inputMode !== undefined) {
                    await currentConfig.update('modeError', inputMode.trim(), vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`✅ 出错灯语已更新为: ${inputMode.trim()}`);
                }
            } else if (label.includes('globe')) {
                await showLanguagePicker();
            } else if (label.includes('plug')) {
                if (cdpMonitor?.isConnected()) {
                    cdpMonitor.disconnect();
                    updateStatusBar();
                    vscode.window.showInformationMessage(t('msg.cdpDisconnected'));
                } else {
                    const port = currentConfig.get<number>('cdpPort', 9000);
                    if (!cdpMonitor) {
                        cdpMonitor = new CdpMonitor(port, handleAiStateChange, outputChannel, getWindowTitle());
                        cdpMonitor.setStatusBar(statusBarItem);
                    }
                    outputChannel.show(true);
                    const connected = await cdpMonitor.connect();
                    if (connected) {
                        vscode.window.showInformationMessage(t('msg.cdpConnected'));
                    } else {
                        vscode.window.showWarningMessage(t('msg.cdpFailed'));
                    }
                }
            }
        })
    );

    // 测试物理灯语快捷面板
    async function showLedTesterQuickPick() {
        const testItems: vscode.QuickPickItem[] = [
            { label: '0: 全灭 (MODE_BOTH_OFF)', detail: '0' },
            { label: '1: 双灯同闪 (MODE_BOTH_FLASH)', detail: '1' },
            { label: '2: 绿灯单闪 (MODE_GREEN_FLASH)', detail: '2' },
            { label: '3: 红灯单闪 (MODE_RED_FLASH)', detail: '3' },
            { label: '4: 绿灯常亮 (MODE_GREEN_ON)', detail: '4' },
            { label: '5: 红灯常亮 (MODE_RED_ON)', detail: '5' },
            { label: '6: 双灯全亮 (MODE_BOTH_ON)', detail: '6' },
            { label: '7: 🚨 警车交替快闪 (MODE_POLICE_ALT)', detail: '7' },
            { label: '8: 💓 科技心跳双闪 (MODE_HEARTBEAT)', detail: '8' },
            { label: '9: 🆘 SOS 国际求救 (MODE_SOS)', detail: '9' },
            { label: '10: 🍃 细腻交替呼吸灯 (MODE_BREATHING)', detail: '10' },
            { label: '11: 🌌 双萤火虫混沌呼吸 (MODE_FIREFLY)', detail: '11' },
            { label: '12: 🏥 医疗心电图监护 (MODE_ECG)', detail: '12' },
            { label: '13: ⏱️ 安全防护滴答滴 (MODE_TICKTOCK)', detail: '13' },
            { label: '14: 🎠 正余弦跑马霓虹 (MODE_PHASE_CHASE)', detail: '14' },
            { label: '15: 💥 特种高速爆闪追击 (MODE_STROBE_CHASE)', detail: '15' },
            { label: '16: ☯️ 太极双鱼阴阳消长 (MODE_TAICHI)', detail: '16' },
            { label: '17: 📡 "HELLO" 摩尔斯广播 (MODE_HELLO_MORSE)', detail: '17' },
            { label: '18: 🛰️ 科幻雷达扫描探测 (MODE_RADAR)', detail: '18' },
        ];

        const selected = await vscode.window.showQuickPick(testItems, {
            title: '📡 发送测试灯语命令',
            placeHolder: '选择一种物理灯效触发发送...',
        });

        if (selected && selected.detail) {
            publishLedCommand(selected.detail);
        }
    }

    // 测试物理灯命令（通过命令面板）
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravityTaskLed.testLed', () => {
            showLedTesterQuickPick();
        })
    );

    // 切换开关（通过命令面板）
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravityTaskLed.toggle', () => {
            isEnabled = !isEnabled;
            vscode.workspace.getConfiguration('antigravityTaskLed')
                .update('enabled', isEnabled, vscode.ConfigurationTarget.Global);
            updateStatusBar();
            vscode.window.showInformationMessage(
                isEnabled ? t('msg.ledEnabled') : t('msg.ledDisabled')
            );
        })
    );

    // 手动连接 CDP（通过命令面板）
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravityTaskLed.connectCdp', async () => {
            if (cdpMonitor) { cdpMonitor.disconnect(); }
            const port = vscode.workspace.getConfiguration('antigravityTaskLed').get<number>('cdpPort', 9000);
            cdpMonitor = new CdpMonitor(port, handleAiStateChange, outputChannel, getWindowTitle());
            cdpMonitor.setStatusBar(statusBarItem);
            
            outputChannel.show(true);
            const connected = await cdpMonitor.connect();
            if (connected) {
                vscode.window.showInformationMessage(t('msg.cdpConnected'));
            } else {
                vscode.window.showWarningMessage(t('msg.cdpFailed'));
            }
        })
    );

    // 监听设置变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('antigravityTaskLed.enabled')) {
                isEnabled = vscode.workspace.getConfiguration('antigravityTaskLed')
                    .get<boolean>('enabled', true);
                updateStatusBar();
            }
            if (e.affectsConfiguration('antigravityTaskLed.cdpPort')) {
                const newPort = vscode.workspace.getConfiguration('antigravityTaskLed')
                    .get<number>('cdpPort', 9000);
                if (cdpMonitor) {
                    cdpMonitor.updatePort(newPort);
                }
            }
            if (e.affectsConfiguration('antigravityTaskLed.language')) {
                const newLang = vscode.workspace.getConfiguration('antigravityTaskLed')
                    .get<string>('language', 'zh-CN') as 'zh-CN' | 'en';
                setLanguage(newLang);
                updateStatusBar();
                vscode.window.showInformationMessage(t('msg.languageChanged'));
            }
        })
    );

    // ======== 降级容错方案：无 CDP 时自动监听终端及任务结束触发一次任务完成推送 ========
    context.subscriptions.push(
        vscode.window.onDidCloseTerminal((_t: vscode.Terminal) => {
            if (isEnabled && !cdpMonitor?.isConnected()) { 
                handleAiStateChange('success');
            }
        })
    );

    context.subscriptions.push(
        vscode.tasks.onDidEndTaskProcess((_e: vscode.TaskProcessEndEvent) => {
            if (isEnabled && !cdpMonitor?.isConnected()) {
                handleAiStateChange('success');
            }
        })
    );

    // ======== 自动连接 CDP ========
    if (cdpEnabled) {
        log('CDP 自动连接将在 3 秒后启动...');
        setTimeout(async () => {
            cdpMonitor = new CdpMonitor(cdpPort, handleAiStateChange, outputChannel, getWindowTitle());
            cdpMonitor.setStatusBar(statusBarItem);
            const connected = await cdpMonitor.connect();
            if (connected) {
                log('CDP 自动连接建立成功。');
            } else {
                log('CDP 自动连接失败，自适应降级为终端侦听机制。');
                updateStatusBar();
            }
        }, 3000);
    }
}

// ======== 语言选择器 ========
async function showLanguagePicker() {
    const currentLang = getLanguage();
    const items: vscode.QuickPickItem[] = [
        {
            label: currentLang === 'zh-CN' ? '$(check) 中文 (简体)' : '中文 (简体)',
            description: 'Chinese Simplified',
            detail: 'zh-CN',
        },
        {
            label: currentLang === 'en' ? '$(check) English' : 'English',
            description: 'English',
            detail: 'en',
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: '🌐 Language / 语言',
        placeHolder: 'Select language / 选择语言',
    });

    if (selected && selected.detail) {
        const newLang = selected.detail as 'zh-CN' | 'en';
        if (newLang !== currentLang) {
            setLanguage(newLang);
            await vscode.workspace.getConfiguration('antigravityTaskLed')
                .update('language', newLang, vscode.ConfigurationTarget.Global);
            updateStatusBar();
            vscode.window.showInformationMessage(t('msg.languageChanged'));
        }
    }
}

// ======== 状态栏 UI 样式更新 ========
function updateStatusBar() {
    let text = '';
    if (cdpMonitor?.isConnected()) {
        text = isEnabled ? '$(bell) LED Active' : '$(bell-slash) LED Off';
    } else {
        text = isEnabled ? `$(bell) ${t('statusBar.led')}` : `$(bell-slash) ${t('statusBar.led')}`;
    }
    
    text += ' v1.0.0';
    
    statusBarItem.text = text;
    statusBarItem.tooltip = [
        `${t('statusBar.tooltip.led')}：${isEnabled ? t('statusBar.tooltip.enabled') : t('statusBar.tooltip.disabled')}`,
        t('statusBar.tooltip.clickToOpen')
    ].join('\n');
}

// ======== 状态栏文字发送闪烁提醒 ========
function flashStatusText(tempText: string) {
    const originalText = statusBarItem.text;
    statusBarItem.text = tempText;
    setTimeout(() => {
        // 如果当前状态未发生改变，复原为原始文字
        if (statusBarItem.text === tempText) {
            statusBarItem.text = originalText;
        }
    }, 3000);
}

export function deactivate() {
    if (cdpMonitor) {
        cdpMonitor.disconnect();
        cdpMonitor = null;
    }
}
