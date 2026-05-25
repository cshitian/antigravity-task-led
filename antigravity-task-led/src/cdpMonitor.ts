import * as http from 'http';
import * as vscode from 'vscode';
import { t } from './i18n';

declare const console: any;

// 停止按钮检测脚本（借鉴 Remoat 的方案）
const STOP_BUTTON_SCRIPT = `(() => {
    const panel = document.querySelector('.antigravity-agent-side-panel');
    const scopes = [panel, document].filter(Boolean);

    const isVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };

    // 方法1: tooltip-id 检测（需可见）
    for (const scope of scopes) {
        const el = scope.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]');
        if (el && isVisible(el)) return { isGenerating: true };
    }

    // 方法2: 按钮文本检测（需可见）
    const normalize = (value) => (value || '').toLowerCase().replace(/\\\\s+/g, ' ').trim();
    const STOP_PATTERNS = [/^stop$/, /^stop generating$/, /^stop response$/, /^停止$/];
    const isStopLabel = (value) => {
        const n = normalize(value);
        return n ? STOP_PATTERNS.some((re) => re.test(n)) : false;
    };
    for (const scope of scopes) {
        const buttons = scope.querySelectorAll('button, [role="button"]');
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (!isVisible(btn)) continue;
            const labels = [
                btn.textContent || '',
                btn.getAttribute('aria-label') || '',
                btn.getAttribute('title') || '',
            ];
            if (labels.some(isStopLabel)) return { isGenerating: true };
        }
    }

    return { isGenerating: false };
})()`;

interface CdpTarget {
    id: string;
    title: string;
    type: string;
    url?: string;
    webSocketDebuggerUrl: string;
}

export class CdpMonitor {
    private ws: any = null;
    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isRunning = false;
    private messageId = 1;
    private pendingCallbacks = new Map<number, (result: any) => void>();
    private generationStarted = false;
    private stopGoneCount = 0;
    private readonly stopGoneConfirmCount = 3;
    private readonly pollIntervalMs = 2000;
    private port: number;
    private onStateChange: ((state: 'generating' | 'success' | 'error') => void) | null = null;
    private statusBarItem: vscode.StatusBarItem | null = null;
    private outputChannel: vscode.OutputChannel;
    private connectionAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private windowTitle: string;

    constructor(port: number, onStateChange: (state: 'generating' | 'success' | 'error') => void, outputChannel: vscode.OutputChannel, windowTitle: string = '') {
        this.port = port;
        this.onStateChange = onStateChange;
        this.outputChannel = outputChannel;
        this.windowTitle = windowTitle;
    }

    updateWindowTitle(title: string) {
        this.windowTitle = title;
    }

    setStatusBar(item: vscode.StatusBarItem) {
        this.statusBarItem = item;
    }

    private log(message: string) {
        console.log(`[TaskLED:CDP] ${message}`);
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }

    private error(message: string, err?: any) {
        console.error(`[TaskLED:CDP] ${message}`, err || '');
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${message} ${err ? (err.message || err.toString()) : ''}`);
    }

    updatePort(port: number) {
        this.log(`Updating port from ${this.port} to ${port}`);
        this.port = port;
        if (this.isRunning) {
            this.disconnect();
            this.connect();
        }
    }

    async connect(): Promise<boolean> {
        try {
            this.log(`Connecting to CDP on port ${this.port}...`);
            const targets = await this.getTargets();
            if (!targets || targets.length === 0) {
                this.error('No debug targets found.');
                return false;
            }

            this.log(`Found ${targets.length} targets.`);
            targets.forEach((t: CdpTarget, i: number) => {
                this.log(`  [${i}] ${t.type} | title: ${t.title || 'N/A'} | url: ${t.url || 'N/A'}`);
            });

            // 多窗口支持：优先匹配当前窗口标题对应的 target
            const isValidTarget = (t: CdpTarget) => 
                t.type === 'page' && 
                !t.url?.includes('jetski') && 
                !t.title.includes('Launchpad');

            let target: CdpTarget | undefined;

            // 第一优先：匹配当前窗口标题的 workbench.html target
            if (this.windowTitle) {
                this.log(`Searching for target matching window title: "${this.windowTitle}"`);
                target = targets.find(
                    (t: CdpTarget) => isValidTarget(t) && 
                                      t.url?.includes('workbench.html') &&
                                      t.title.includes(this.windowTitle)
                );
                // 备选：匹配标题但不限 workbench.html
                if (!target) {
                    target = targets.find(
                        (t: CdpTarget) => isValidTarget(t) && 
                                          t.title.includes(this.windowTitle)
                    );
                }
                if (target) {
                    this.log(`Matched target by window title: "${target.title}"`);
                }
            }

            // 降级：单窗口选择逻辑
            if (!target) {
                this.log('No window-specific target found, using fallback selection.');
                target = targets.find(
                    (t: CdpTarget) => isValidTarget(t) && t.url?.includes('workbench.html')
                ) || targets.find(
                    (t: CdpTarget) => isValidTarget(t)
                ) || targets.find((t: CdpTarget) => t.type === 'page') || targets[0];
            }

            if (!target?.webSocketDebuggerUrl) {
                this.error('No WebSocket URL found in selected target.');
                return false;
            }

            this.log(`Selected target: ${target.url || target.id}`);
            this.log(`WebSocket URL: ${target.webSocketDebuggerUrl}`);

            const WebSocket = require('ws');
            this.ws = new WebSocket(target.webSocketDebuggerUrl);

            return new Promise<boolean>((resolve) => {
                const timeout = setTimeout(() => {
                    this.error('WebSocket connection timeout');
                    resolve(false);
                }, 5000);

                this.ws.on('open', () => {
                    clearTimeout(timeout);
                    this.log('WebSocket Connected successfully!');
                    this.isRunning = true;
                    this.connectionAttempts = 0;
                    this.updateStatusText(`$(bell) ${t('cdp.connected')}`);
                    this.startPolling();
                    resolve(true);
                });

                this.ws.on('message', (data: string) => {
                    try {
                        const msg = JSON.parse(data.toString());
                        if (msg.id && this.pendingCallbacks.has(msg.id)) {
                            const cb = this.pendingCallbacks.get(msg.id)!;
                            this.pendingCallbacks.delete(msg.id);
                            cb(msg.result);
                        }
                    } catch { /* ignore parse errors */ }
                });

                this.ws.on('close', () => {
                    this.log('WebSocket Disconnected');
                    this.isRunning = false;
                    this.updateStatusText(`$(bell-slash) ${t('cdp.disconnected')}`);
                    this.scheduleReconnect();
                });

                this.ws.on('error', (err: Error) => {
                    this.error('WebSocket Error', err);
                    clearTimeout(timeout);
                    resolve(false);
                });
            });
        } catch (err) {
            this.error('Connect failed', err);
            return false;
        }
    }

    disconnect() {
        this.log('Disconnecting from CDP...');
        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            try { this.ws.close(); } catch { /* ignore */ }
            this.ws = null;
        }
        this.pendingCallbacks.clear();
    }

    isConnected(): boolean {
        return this.isRunning && this.ws?.readyState === 1;
    }

    private updateStatusText(text: string) {
        if (this.statusBarItem) {
            this.statusBarItem.text = text;
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.connectionAttempts++;
        if (this.connectionAttempts > this.maxReconnectAttempts) {
            this.log('Max reconnect attempts reached. Will stop retrying automatically.');
            this.updateStatusText(`$(bell-slash) ${t('cdp.connectFailed')}`);
            return;
        }
        const delay = Math.min(5000 * this.connectionAttempts, 30000);
        this.log(`Reconnecting in ${delay}ms (attempt ${this.connectionAttempts})...`);
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            await this.connect();
        }, delay);
    }

    private getTargets(): Promise<CdpTarget[] | null> {
        return new Promise((resolve) => {
            const options = {
                hostname: '127.0.0.1',
                port: this.port,
                path: '/json/list',
                method: 'GET',
                family: 4 // Force IPv4
            };
            
            this.log(`Fetching targets from ${options.hostname}:${options.port}...`);
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        this.log(`HTTP status ${res.statusCode} from CDP endpoint`);
                        resolve(null);
                        return;
                    }
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        this.error('Failed to parse CDP targets JSON', e);
                        resolve(null);
                    }
                });
            });
            req.on('error', (e) => {
                this.error('HTTP request to CDP failed', e);
                resolve(null);
            });
            req.setTimeout(3000, () => {
                this.error('HTTP request to CDP timed out');
                req.destroy();
                resolve(null); 
            });
            req.end();
        });
    }

    private sendCommand(method: string, params: Record<string, any> = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== 1) {
                reject(new Error('WebSocket not connected'));
                return;
            }
            const id = this.messageId++;
            const timeout = setTimeout(() => {
                this.pendingCallbacks.delete(id);
                reject(new Error('CDP command timeout'));
            }, 5000);

            this.pendingCallbacks.set(id, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });

            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    private startPolling() {
        if (!this.isRunning) return;
        this.pollTimer = setTimeout(async () => {
            await this.poll();
            if (this.isRunning) {
                this.startPolling();
            }
        }, this.pollIntervalMs);
    }

    private async poll() {
        try {
            const result = await this.sendCommand('Runtime.evaluate', {
                expression: STOP_BUTTON_SCRIPT,
                returnByValue: true,
            });

            const value = result?.result?.value;
            const isGenerating = value?.isGenerating === true;

            if (isGenerating) {
                if (!this.generationStarted) {
                    this.generationStarted = true;
                    this.log('AI generation started');
                    this.updateStatusText(`$(loading~spin) ${t('cdp.generating')}`);
                    if (this.onStateChange) {
                        this.onStateChange('generating');
                    }
                }
                this.stopGoneCount = 0;
            } else if (this.generationStarted) {
                this.stopGoneCount++;
                if (this.stopGoneCount >= this.stopGoneConfirmCount) {
                    this.log('AI response complete!');
                    this.generationStarted = false;
                    this.stopGoneCount = 0;
                    this.updateStatusText(`$(bell) ${t('cdp.connected')}`);

                    if (this.onStateChange) {
                        this.onStateChange('success');
                    }
                }
            }
        } catch (err) {
            // CDP 偶尔发生命令超时属于正常静息现象，无需输出大篇错误日志
        }
    }
}
