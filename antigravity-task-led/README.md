# 💡 Antigravity Task LED

> **当 AI 在思考，你的桌面也在"呼吸"。**
> 实时将 Antigravity IDE 的 AI 工作状态，映射为桌面 ESP8266 双色物理 LED 灯语。

---

## ✨ 功能亮点

- 🧠 **AI 状态实时感知**：通过 Chrome DevTools Protocol (CDP) 精准捕捉 AI 生成中 / 完成 / 出错三种状态
- 💡 **物理灯语联动**：经由巴法云 MQTT 平台，实时控制桌面 ESP8266 双色 LED 进入对应灯效模式
- 🎨 **19 种炫酷灯效**：从简单的常亮、闪烁，到太极呼吸、雷达扫描，一应俱全
- ⚙️ **零依赖 HTTP 推送**：插件本体无重型 MQTT 库，直接调用巴法云 HTTP API，启动快、稳定性高
- 🌐 **中英双语界面**：支持中文（简体）和 English 无缝切换
- 🔧 **快捷设置菜单**：点击状态栏图标，所有配置一键可达，无需打开 Settings UI

---

## 🖥️ 效果预览

| AI 状态 | 推荐灯语 | 物理效果 |
|--------|---------|---------|
| 🧠 **生成中** (Generating) | `10` 交替呼吸 | 红绿交替细腻呼吸，像 AI 大脑在流转 |
| ✅ **顺利完成** (Success) | `16` 太极双鱼 | 三阶正弦 S 形黏滞消长，丝滑优雅 |
| ❌ **出错/中断** (Error) | `5` 红灯常亮 | 红灯长亮，第一时间唤回注意力 |

---

## 🏗️ 系统架构

```
┌────────────────────────────┐
│      Antigravity IDE       │  VS Code 兼容扩展宿主
│                            │
│  [CDP Monitor 状态监视器]   │  实时捕捉 AI 页面状态
└─────────────┬──────────────┘
              │ HTTP GET 推送
              ▼
┌────────────────────────────┐
│      巴法云 MQTT 平台       │  apis.bemfa.com
│   接收 HTTP 并广播 MQTT     │
└─────────────┬──────────────┘
              │ MQTT 实时订阅
              ▼
┌────────────────────────────┐
│    ESP8266 物理主控芯片     │  无阻塞状态机固件
│   D1(绿灯)   D2(红灯)      │  19 种物理灯语实时切换
└────────────────────────────┘
```

---

## 📦 安装

### 从 VSIX 安装

1. 先按照下方【从源码构建】步骤生成 `.vsix` 文件
2. 在 Antigravity IDE 中按下 `Ctrl+Shift+X` 打开扩展面板
3. 点击右上角 **`...`** 菜单 → **从 VSIX 安装...**
4. 选择生成的 `.vsix` 文件并安装
5. 重载窗口（`Ctrl+Shift+P` → `Developer: Reload Window`）

### 从源码构建

```bash
git clone https://github.com/liukunpeng0316/antigravity-task-led.git
cd antigravity-task-led
npm install
npm run compile
npx @vscode/vsce package --no-yarn
# 生成 antigravity-task-led-x.x.x.vsix
```

---

## ⚙️ 配置说明

点击 Antigravity IDE 右下角状态栏的 **💡 LED 图标**，进入快捷设置菜单：

| 菜单项 | 说明 |
|--------|------|
| 🔔 **开启/关闭灯光联动** | 全局启用或禁用物理 LED 联动 |
| ▶️ **测试物理灯语** | 发送测试命令，即时预览 0-18 号灯效 |
| 🔑 **配置巴法云 UID** | 填入您的巴法云账号私钥（UID） |
| 📡 **配置设备控制主题** | 填入绑定的 MQTT 设备主题（以 `002` 结尾） |
| 🎨 **配置生成中灯语** | 设置 AI 思考时的灯语编号（0-18） |
| ✅ **配置完成灯语** | 设置 AI 完成时的灯语编号（0-18） |
| ⚠️ **配置出错灯语** | 设置 AI 出错时的灯语编号（0-18） |
| 🔌 **CDP 连接** | 手动连接/断开 CDP 状态监视 |
| 🌐 **切换语言** | 在中文和 English 之间切换 |

也可以通过 VS Code / Antigravity IDE 的 **Settings UI**（`Ctrl+,`）搜索 `Antigravity Task LED` 进行配置。

---

## 💡 灯语模式一览（0-18）

| 编号 | 名称 | 视觉效果描述 |
|------|------|-------------|
| `0` | 全灭 | 双灯熄灭 |
| `1` | 双灯同闪 | 红绿同步闪烁 |
| `2` | 绿灯单闪 | 绿灯闪烁，红灯熄灭 |
| `3` | 红灯单闪 | 红灯闪烁，绿灯熄灭 |
| `4` | 绿灯常亮 | 绿灯长亮，红灯熄灭 |
| `5` | 红灯常亮 | 红灯长亮，绿灯熄灭 |
| `6` | 双灯全亮 | 红绿同时长亮 |
| `7` | 🚨 警车交替快闪 | 红绿以极快速度交替，强烈警示感 |
| `8` | 💓 科技心跳双闪 | 双灯连续快闪两次后进入长间歇 |
| `9` | 🆘 SOS 国际求救 | 严格按摩尔斯电码 `···---···` 循环 |
| `10` | 🍃 交替柔和呼吸灯 | 红绿交替完成细腻淡入淡出 |
| `11` | 🌌 双萤火虫混沌呼吸 | 两灯以不同频次自主明暗，自然混沌 |
| `12` | 🏥 医疗心电图监护 | 红灯模拟 ECG 波形，绿灯血氧同步 |
| `13` | ⏱️ 安全防护滴答滴 | 绿灯常亮，红灯每秒发出 50ms 脉冲 |
| `14` | 🎠 正余弦跑马霓虹 | 绿红以 90° 相位差追逐旋转 |
| `15` | 💥 特种爆闪追击 | 绿灯爆闪 3 下 → 停顿 → 红灯爆闪 3 下 |
| `16` | ☯️ 太极阴阳双鱼呼吸 | 三阶正弦 S 形黏滞丝滑消长 |
| `17` | 📡 "HELLO" 摩尔斯广播 | 标准摩尔斯电码发送 H-E-L-L-O |
| `18` | 🛰️ 科幻雷达扫描探测 | 绿灯呼吸探测，红灯突发爆闪锁定 |

> 💡 还可通过发送 `i<毫秒数>`（如 `i200`）动态调整闪烁频率（30ms ~ 10000ms）。

---

## 🔧 硬件准备（ESP8266 端）

### 接线说明

| LED | 单片机引脚 | GPIO |
|-----|-----------|------|
| 绿灯（D1） | `D1` | GPIO5 |
| 红灯（D2） | `D2` | GPIO4 |

> 每个 LED 需串联 **220Ω 限流电阻**。

### 固件烧录

ESP8266 固件源码位于本仓库的 `sketch_may25a/` 目录，使用 Arduino IDE 烧录：

1. 安装 ESP8266 开发板支持包
2. 安装 `PubSubClient` 库
3. 在 `sketch_may25a.ino` 中填入您的 WiFi 和巴法云配置
4. 编译并烧录至 ESP8266 开发板

---

## 🚀 首次使用流程

1. **注册巴法云**：前往 [bemfa.com](https://www.bemfa.com) 注册账号，获取私钥（UID）并创建 MQTT 设备主题（以 `002` 结尾）
2. **烧录硬件固件**：将 ESP8266 固件烧录至开发板，填入 WiFi 密码和巴法云主题
3. **安装插件**：将 `.vsix` 安装到 Antigravity IDE
4. **配置插件**：点击状态栏 LED 图标，填入巴法云 UID 和主题
5. **启用 CDP**：以 `--remote-debugging-port=9000` 参数启动 Antigravity IDE
6. **连接 CDP**：点击状态栏图标 → **CDP 连接**，等待显示"已连接"
7. **开始使用**：与 Antigravity AI 对话，观察桌面 LED 随 AI 状态实时变化！

---

## 🌐 CDP 调试端口配置

Antigravity IDE 需要以调试模式启动，才能让 CDP Monitor 正常工作：

在启动命令中添加参数：
```
--remote-debugging-port=9000
```

默认端口为 `9000`，可在插件设置中修改 `antigravityTaskLed.cdpPort`。

---

## 📋 扩展设置参考

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `antigravityTaskLed.enabled` | boolean | `true` | 启用/禁用物理 LED 联动 |
| `antigravityTaskLed.bemfaUid` | string | `""` | 巴法云私钥（UID） |
| `antigravityTaskLed.bemfaTopic` | string | `""` | 巴法云设备主题（以 002 结尾） |
| `antigravityTaskLed.modeGenerating` | string | `"10"` | AI 生成中时的灯语编号（0-18） |
| `antigravityTaskLed.modeSuccess` | string | `"16"` | AI 顺利完成时的灯语编号（0-18） |
| `antigravityTaskLed.modeError` | string | `"5"` | AI 出错时的灯语编号（0-18） |
| `antigravityTaskLed.cdpEnabled` | boolean | `true` | 启用 CDP 精准状态检测 |
| `antigravityTaskLed.cdpPort` | number | `9000` | Antigravity 远程调试端口 |
| `antigravityTaskLed.language` | string | `"zh-CN"` | 界面语言（`zh-CN` / `en`） |

---

## 📝 更新日志

### v1.0.2
- ✨ 在快捷设置菜单中新增三个灯语模式配置入口（生成中 / 完成 / 出错）
- 🔢 输入框附带 0-18 范围校验，防止误填

### v1.0.1
- 🔧 修复扩展设置在 Antigravity IDE 下的缓存刷新问题

### v1.0.0
- 🎉 首次发布
- 💡 支持 19 种物理灯语模式
- 🔌 基于 CDP + 巴法云 HTTP API 的零依赖物联网联动架构
- 🌐 中英双语界面支持

---

## 🙏 致谢

本插件基于 [**Antigravity Task Sound**](https://github.com/liukunpeng0316/antigravity-task-sound) 深度改造而来。

原项目实现了通过 CDP 协议精准捕捉 Antigravity AI 状态并播放声音通知的核心架构，为本插件的物联网灯光联动提供了坚实的基础与灵感。感谢原作者的开源贡献！

---

## 📄 License

[MIT](./LICENSE) © cshitian
