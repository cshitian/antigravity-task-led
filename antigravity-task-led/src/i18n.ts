import * as vscode from 'vscode';

type Language = 'zh-CN' | 'en';

interface Translations {
    [key: string]: string;
}

const zhCN: Translations = {
    // Status bar
    'statusBar.led': '灯光联动',
    'statusBar.tooltip.led': '物理 LED 智能联动',
    'statusBar.tooltip.enabled': '已开启',
    'statusBar.tooltip.disabled': '已关闭',
    'statusBar.tooltip.clickToOpen': '点击打开设置菜单',

    // Settings menu
    'menu.title': '💡 Antigravity Task LED 设置',
    'menu.placeholder': '选择一个操作...',
    'menu.ledOff': '关闭灯光联动',
    'menu.ledOn': '开启灯光联动',
    'menu.currentOn': '已开启',
    'menu.currentOff': '已关闭',
    'menu.testLed': '测试物理灯语',
    'menu.testLedDesc': '向物理 LED 发送当前触发指令测试联动',
    'menu.configureUid': '配置巴法云 UID',
    'menu.configureUidDesc': '设置您的巴法云私钥 (UID)',
    'menu.configureTopic': '配置设备控制主题',
    'menu.configureTopicDesc': '设置订阅的主题 (如 your_topic002)',
    'menu.cdpConnect': 'CDP 连接',

    // Messages
    'msg.ledEnabled': '💡 物理 LED 智能联动已开启',
    'msg.ledDisabled': '🔌 物理 LED 智能联动已关闭',
    'msg.cdpDisconnected': 'CDP 已断开',
    'msg.cdpConnected': '✅ CDP 连接成功！',
    'msg.cdpFailed': '❌ CDP 连接失败，详情请看 Output 面板',
    'msg.uidChanged': '🔑 巴法云 UID 配置已更新',
    'msg.topicChanged': '📡 设备主题配置已更新',
    'msg.taskComplete': '💡 AI 任务已顺利完成！',
    'msg.taskGenerating': '⏳ AI 正在思考并生成回复...',
    
    // CDP status
    'cdp.connected': 'CDP 已连接',
    'cdp.disconnected': 'CDP 断开',
    'cdp.connectFailed': 'CDP 连接失败',
    'cdp.generating': 'AI 思考中...',
    'cdp.statusConnected': '✅ 已连接',
    'cdp.statusDisconnected': '❌ 未连接',

    // Language
    'menu.language': '切换语言 / Language',
    'menu.languageDesc.zh': '当前：中文',
    'menu.languageDesc.en': '当前：English',
    'msg.languageChanged': '🌐 语言已切换，部分界面将在下次操作时生效',
};

const en: Translations = {
    // Status bar
    'statusBar.led': 'LED Linkage',
    'statusBar.tooltip.led': 'Physical LED Linkage',
    'statusBar.tooltip.enabled': 'Enabled',
    'statusBar.tooltip.disabled': 'Disabled',
    'statusBar.tooltip.clickToOpen': 'Click to open settings menu',

    // Settings menu
    'menu.title': '💡 Antigravity Task LED Settings',
    'menu.placeholder': 'Select an action...',
    'menu.ledOff': 'Disable LED Linkage',
    'menu.ledOn': 'Enable LED Linkage',
    'menu.currentOn': 'Enabled',
    'menu.currentOff': 'Disabled',
    'menu.testLed': 'Test Physical LED',
    'menu.testLedDesc': 'Send current trigger command to test physical LED',
    'menu.configureUid': 'Configure Bemfa UID',
    'menu.configureUidDesc': 'Set your Bemfa private key (UID)',
    'menu.configureTopic': 'Configure Device Topic',
    'menu.configureTopicDesc': 'Set subscribed control topic (e.g., your_topic002)',
    'menu.cdpConnect': 'CDP Connection',

    // Messages
    'msg.ledEnabled': '💡 Physical LED linkage enabled',
    'msg.ledDisabled': '🔌 Physical LED linkage disabled',
    'msg.cdpDisconnected': 'CDP disconnected',
    'msg.cdpConnected': '✅ CDP connected!',
    'msg.cdpFailed': '❌ CDP connection failed, see Output panel for details',
    'msg.uidChanged': '🔑 Bemfa UID configuration updated',
    'msg.topicChanged': '📡 Device topic configuration updated',
    'msg.taskComplete': '💡 AI task completed!',
    'msg.taskGenerating': '⏳ AI is generating response...',

    // CDP status
    'cdp.connected': 'CDP Connected',
    'cdp.disconnected': 'CDP Disconnected',
    'cdp.connectFailed': 'CDP Connection Failed',
    'cdp.generating': 'AI Generating...',
    'cdp.statusConnected': '✅ Connected',
    'cdp.statusDisconnected': '❌ Disconnected',

    // Language
    'menu.language': 'Language / 切换语言',
    'menu.languageDesc.zh': 'Current: 中文',
    'menu.languageDesc.en': 'Current: English',
    'msg.languageChanged': '🌐 Language changed. Some UI will update on next action.',
};

const translations: Record<Language, Translations> = {
    'zh-CN': zhCN,
    'en': en,
};

let currentLanguage: Language = 'zh-CN';

export function initLanguage(): void {
    const config = vscode.workspace.getConfiguration('antigravityTaskLed');
    currentLanguage = config.get<string>('language', 'zh-CN') as Language;
    if (!translations[currentLanguage]) {
        currentLanguage = 'zh-CN';
    }
}

export function setLanguage(lang: Language): void {
    currentLanguage = lang;
}

export function getLanguage(): Language {
    return currentLanguage;
}

export function t(key: string): string {
    return translations[currentLanguage]?.[key] || translations['zh-CN']?.[key] || key;
}
